import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'

import { UserInputError } from '@cedarjs/graphql-server'

import {
  buildTaskPrompt,
  spawnTaskAgent,
  taskLogPath,
  type AgentToolId,
  type TaskMode,
} from 'src/lib/agentDispatch'
import { db } from 'src/lib/db'
import { findSessionSnapshot } from 'src/lib/deepseekSessionSync'
import { logger } from 'src/lib/logger'
import { readTeamAgent, resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'
import { logAgeMs } from 'src/lib/roleEvaluationLog'
import {
  discoverSession,
  sessionIdFromLog,
} from 'src/lib/roleEvaluationSessions'
import { syncEvaluationTasks } from 'src/lib/roleEvaluationTasks'
import {
  parseSessionReference,
  readSessionTurnTrace,
} from 'src/lib/sessionTrace'
import { parseTaskRunOutput, type TaskRunOutput } from 'src/lib/taskOutput'
import { saveTaskPlan } from 'src/lib/taskPlans'
import { missingDeliverables, precheckTask } from 'src/lib/taskPrecheck'
import { startTaskTicker } from 'src/lib/taskTicker'
import {
  changedFiles,
  computeRunDiffStat,
  snapshotDiffStat,
  snapshotWorkspace,
} from 'src/lib/taskWorkspace'
import { reconcileRunningEvaluations } from 'src/services/roleEvaluations/roleEvaluations'
import { resolveTaskImages } from 'src/services/taskImages/taskImages'

const STATUS = {
  DRAFT: 'DRAFT',
  DISPATCHED: 'DISPATCHED',
  RUNNING: 'RUNNING',
  QUEUED: 'QUEUED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  AWAITING_REVIEW: 'AWAITING_REVIEW',
  DONE: 'DONE',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const

const ACTIVE_STATUSES = new Set([STATUS.DISPATCHED, STATUS.RUNNING])
const DISPATCHABLE = new Set([
  STATUS.DRAFT,
  STATUS.QUEUED,
  STATUS.AWAITING_APPROVAL,
  STATUS.FAILED,
  STATUS.AWAITING_REVIEW,
  STATUS.CANCELLED,
])
const ARTIFACT_KINDS = new Set(['file', 'dir', 'url', 'report'])
const CONTENT_MAX_BYTES = 200_000
const DENY_SEGMENTS = [
  '.git',
  'node_modules',
  '.dsh',
  '.ssh',
  'api/db/generated',
]

const alive = (pid: number | null | undefined) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === 'EPERM'
  }
}

const text = (value: unknown, max: number, label: string) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (raw.length > max)
    throw new UserInputError(`${label}不能超过 ${max} 个字符`)
  return raw
}

const requireAgent = (slug: string) => {
  const repoRoot = resolveRepoRoot()
  const agent = readTeamAgent(slug, repoRoot)
  if (!agent) throw new UserInputError(`岗位清单里没有 ${slug}`)
  return { agent, repoRoot }
}

/** 进程已退出的运行 → 任务转为待验收，运行标记完成 */
const reconcileTask = async (
  task: {
    id: string
    agentSlug: string
    title: string
    brief?: string
    acceptance?: string
    status: string
    updatedAt: Date
    runs: Array<{
      id: string
      pid: number | null
      status: string
      platform: string
      mode: string
      summary: string | null
      logPath: string | null
      baselineFiles: unknown
      baselineDiff?: unknown
      diffStat?: unknown
      startedAt: Date
    }>
  },
  options: { force?: boolean } = {}
) => {
  if (!ACTIVE_STATUSES.has(task.status as never))
    return { row: task, changed: false }
  const run = task.runs[0]
  if (!run) return { row: task, changed: false }
  const pendingStartup = run.status === 'QUEUED' && !run.pid
  if (
    pendingStartup &&
    Date.now() - new Date(run.startedAt).getTime() < 120_000
  ) {
    return { row: task, changed: false }
  }
  // force：手动刷新时即使 pid 还活着也按日志判断（识别 pid 复用/僵死）
  if (!options.force && alive(run.pid)) return { row: task, changed: false }

  const finishedAt = new Date()

  // 进程结束后解析日志：交付摘要 + artifact: 约定行
  const repoRoot = resolveRepoRoot()
  const logAbsolute = run.logPath
    ? path.join(repoRoot, run.logPath)
    : path.join(repoRoot, 'docs/tasks/logs')
  const output: TaskRunOutput = run.logPath
    ? parseTaskRunOutput({
        logPath: logAbsolute,
        tool: run.platform as AgentToolId,
      })
    : { summary: '', artifacts: [] }
  if (pendingStartup) output.error = '执行进程未能在两分钟内启动，请重新派发'

  const isPlanRun = run.mode === 'plan'
  if (isPlanRun && !output.error && !output.completed) {
    output.error = '方案生成未正常结束，请重新生成方案'
  }
  let planPath: string | undefined
  if (isPlanRun && !output.error && run.status !== 'CANCELLED') {
    try {
      planPath = saveTaskPlan({
        repoRoot,
        taskId: task.id,
        runId: run.id,
        content: output.finalText || '',
      })
      output.artifacts = [{ path: planPath, label: '执行方案', kind: 'report' }]
    } catch (error) {
      output.error = `方案保存失败：${error instanceof Error ? error.message : String(error)}`
      output.artifacts = []
    }
  }
  const failed = Boolean(output.error)

  // 产物兜底：比较工作区快照，把这次真正改动过的文件登记为产物
  if (run.baselineFiles && !isPlanRun) {
    const after = await snapshotWorkspace(repoRoot)
    const touched = changedFiles(run.baselineFiles as never, after)
    for (const file of touched.slice(0, 30)) {
      if (output.artifacts.some((item) => item.path === file)) continue
      output.artifacts.push({
        path: file,
        label: path.basename(file),
        kind: /\.md$/i.test(file) ? 'report' : 'file',
        source: 'git',
      })
    }
  }

  // 交付物统计：结束值减派发基线，按顶层目录分组（幂等，已有则不重算）
  // 没有派发基线的运行（会话同步、CLI 创建）无法归因，跳过
  if (!run.diffStat && run.baselineDiff) {
    // 不按文件列表收窄：脏工作区里"改动已脏文件"不会改变 git 状态，
    // 只看状态差集会漏掉这部分，因此用整树 numstat 再减基线归因。
    const diffStat = await computeRunDiffStat({
      repoRoot,
      baseline: run.baselineDiff as never,
    })
    if (diffStat) {
      await db.taskRun
        .update({ where: { id: run.id }, data: { diffStat } })
        .catch((error) => logger.warn({ error }, 'task run diffStat failed'))
    }
  }

  // 验收标准里点名的交付物没生成 → 在结论里说清楚，别让人自己翻
  const missing =
    failed || isPlanRun
      ? []
      : missingDeliverables(
          {
            title: task.title as string,
            brief: (task as { brief?: string }).brief,
            acceptance: (task as { acceptance?: string }).acceptance,
          },
          repoRoot
        )
  const nextStatus = failed
    ? STATUS.FAILED
    : run.status === 'CANCELLED'
      ? STATUS.CANCELLED
      : isPlanRun
        ? STATUS.AWAITING_APPROVAL
        : STATUS.AWAITING_REVIEW
  const runStatus =
    nextStatus === STATUS.CANCELLED
      ? 'CANCELLED'
      : failed
        ? 'FAILED'
        : 'COMPLETED'
  const changed = await db.$transaction(async (transaction) => {
    const claimed = await transaction.task.updateMany({
      where: { id: task.id, status: task.status, updatedAt: task.updatedAt },
      data: {
        status: nextStatus,
        ...(isPlanRun ? { planPath: planPath || null } : {}),
        ...(failed
          ? { reviewNote: output.error }
          : missing.length
            ? { reviewNote: `缺少验收标准里的交付物：${missing.join('、')}` }
            : {}),
      },
    })
    if (!claimed.count) return false

    await transaction.taskRun.update({
      where: { id: run.id },
      data: {
        status: runStatus,
        completedAt: finishedAt,
        summary: output.error || output.summary || run.summary || null,
        inputTokens: output.usage?.inputTokens ?? null,
        outputTokens: output.usage?.outputTokens ?? null,
        cachedTokens: output.usage?.cachedTokens ?? null,
      },
    })
    const existing = await transaction.taskArtifact.findMany({
      where: { taskId: task.id },
      select: { path: true },
    })
    const known = new Set(existing.map((item) => item.path))
    const fresh = output.artifacts.filter((item) => !known.has(item.path))
    if (fresh.length) {
      await transaction.taskArtifact.createMany({
        data: fresh.map((item) => ({
          taskId: task.id,
          kind: item.kind,
          source: item.source || 'item',
          path: item.path,
          label: item.label,
        })),
      })
    }
    const lastEvent = await transaction.taskEvent.findFirst({
      where: { taskRunId: run.id },
      orderBy: { sequence: 'desc' },
    })
    await transaction.taskEvent.create({
      data: {
        taskRunId: run.id,
        sequence: (lastEvent?.sequence || 0) + 1,
        eventType: 'task.finished',
        status: runStatus,
        stage: isPlanRun ? 'PLANNING' : 'DELIVERY',
        agent: task.agentSlug,
        summary: output.error || output.summary || '执行结束',
        idempotencyKey: `${run.id}:finished`,
      },
    })
    return true
  })
  if (!changed) return { row: task, changed: true }

  // 该岗位腾出来了：把排队中的下一个任务自动拉起来
  await promoteQueuedFor(task.agentSlug as string)

  return {
    row: {
      ...task,
      status: nextStatus,
      runs: [{ ...run, status: runStatus }],
    },
    changed: true,
  }
}

const withRelations = {
  runs: { orderBy: { startedAt: 'desc' as const }, take: 5 },
  artifacts: { orderBy: { createdAt: 'asc' as const } },
}

const EVALUATION_SYNC_INTERVAL_MS = 5_000
let evaluationSyncedAt = 0

/** 评估任务的结论同步：读看板时最多 5 秒触发一次，避免每次轮询都扫库 */
const syncEvaluationTasksForRead = async () => {
  if (Date.now() - evaluationSyncedAt < EVALUATION_SYNC_INTERVAL_MS) return
  evaluationSyncedAt = Date.now()
  await syncEvaluationTasks()
}

export const tasks = async ({
  status,
  statuses,
  agentSlug,
  from,
  to,
}: {
  status?: string | null
  statuses?: string[] | null
  agentSlug?: string | null
  from?: Date | string | null
  to?: Date | string | null
} = {}) => {
  if (status && statuses)
    throw new UserInputError('status 与 statuses 不能同时传入')
  if (
    statuses?.some((value) => !Object.values(STATUS).includes(value as never))
  ) {
    throw new UserInputError('任务状态无效')
  }
  await syncEvaluationTasksForRead()

  const where = {
    ...(status ? { status } : {}),
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(agentSlug ? { agentSlug } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  }

  const rows = await db.task.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    take: 100,
    include: withRelations,
  })

  let changed = false
  for (const row of rows) {
    const result = await reconcileTask(row as never)
    changed = changed || result.changed
  }

  if (!changed) return rows

  // 有执行刚结束：重新取一次，带上自动登记的产物与新状态
  return db.task.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    take: 100,
    include: withRelations,
  })
}

export const task = async ({ id }: { id: string }) => {
  const row = await db.task.findUnique({
    where: { id },
    include: withRelations,
  })
  if (!row) throw new UserInputError('任务不存在')

  const result = await reconcileTask(row as never)
  if (!result.changed) return row

  return db.task.findUnique({ where: { id }, include: withRelations })
}

export type CreateTaskInput = {
  title: string
  brief: string
  acceptance?: string | null
  agentSlug: string
  priority?: string | null
  dueAt?: string | null
  readOnly?: boolean | null
  mode?: string | null
}

export const createTask = async ({ input }: { input: CreateTaskInput }) => {
  const title = text(input?.title, 120, '标题')
  if (!title) throw new UserInputError('标题不能为空')

  const brief = text(input?.brief, 4000, '需求正文')
  if (!brief) throw new UserInputError('需求正文不能为空')

  const agentSlug = text(input?.agentSlug, 120, '岗位')
  if (!agentSlug) throw new UserInputError('请选择执行岗位')
  requireAgent(agentSlug)

  const priority = text(input?.priority || 'P1', 8, '优先级') || 'P1'
  if (!['P0', 'P1', 'P2'].includes(priority)) {
    throw new UserInputError('优先级只能是 P0 / P1 / P2')
  }

  return db.task.create({
    data: {
      title,
      brief,
      acceptance: text(input?.acceptance, 2000, '验收标准'),
      agentSlug,
      priority,
      status: STATUS.DRAFT,
      readOnly: Boolean(input?.readOnly),
      mode: input?.mode === 'plan' ? 'plan' : 'auto',
      dueAt: input?.dueAt ? new Date(input.dueAt) : null,
    },
    include: withRelations,
  })
}

export const updateTask = async ({
  id,
  input,
}: {
  id: string
  input: Partial<CreateTaskInput>
}) => {
  const row = await db.task.findUnique({ where: { id } })
  if (!row) throw new UserInputError('任务不存在')
  if (ACTIVE_STATUSES.has(row.status as never)) {
    throw new UserInputError('任务执行中，不能修改需求')
  }

  const data: Record<string, unknown> = {}
  if (input?.title !== undefined) {
    const title = text(input.title, 120, '标题')
    if (!title) throw new UserInputError('标题不能为空')
    data.title = title
  }
  if (input?.brief !== undefined) {
    const brief = text(input.brief, 4000, '需求正文')
    if (!brief) throw new UserInputError('需求正文不能为空')
    data.brief = brief
  }
  if (input?.acceptance !== undefined) {
    data.acceptance = text(input.acceptance, 2000, '验收标准')
  }
  if (input?.agentSlug !== undefined) {
    requireAgent(text(input.agentSlug, 120, '岗位'))
    data.agentSlug = input.agentSlug
  }
  if (input?.priority !== undefined) data.priority = input.priority
  if (input?.readOnly !== undefined) data.readOnly = Boolean(input.readOnly)
  if (input?.mode !== undefined)
    data.mode = input.mode === 'plan' ? 'plan' : 'auto'
  if (input?.dueAt !== undefined) {
    data.dueAt = input.dueAt ? new Date(input.dueAt) : null
  }

  const changesPlan = (
    ['title', 'brief', 'acceptance', 'agentSlug', 'readOnly', 'mode'] as const
  ).some((field) => data[field] !== undefined && data[field] !== row[field])
  if (changesPlan && row.status === STATUS.AWAITING_APPROVAL) {
    data.status = STATUS.DRAFT
    data.planPath = null
  }
  const updated = await db.task.updateMany({
    where: { id, status: row.status, updatedAt: row.updatedAt },
    data,
  })
  if (!updated.count) throw new UserInputError('任务状态已变化，请刷新后重试')
  return db.task.findUnique({ where: { id }, include: withRelations })
}

/** 派发：生成一次 TaskRun 并拉起本地 agent */
export const dispatchTask = async ({
  id,
  tool,
  mode,
  revisionNote,
  expectedPlanPath,
}: {
  id: string
  tool?: string
  mode?: TaskMode
  revisionNote?: string
  expectedPlanPath?: string | null
}) => {
  const row = await db.task.findUnique({
    where: { id },
    include: withRelations,
  })
  if (!row) throw new UserInputError('任务不存在')
  tool = tool || row.runs[0]?.platform || 'codex'
  if (!['codex', 'deepseek-harness'].includes(tool)) {
    throw new UserInputError('不支持的执行平台')
  }
  if (!DISPATCHABLE.has(row.status as never)) {
    throw new UserInputError(`当前状态（${row.status}）不能派发`)
  }

  const runMode: TaskMode = mode || ((row.mode as TaskMode) ?? 'auto')
  if (row.status === STATUS.AWAITING_APPROVAL && runMode === 'auto') {
    throw new UserInputError('方案待确认：请先批准方案再执行')
  }
  if (runMode === 'execute') {
    if (row.status !== STATUS.AWAITING_APPROVAL || !row.planPath) {
      throw new UserInputError('没有可批准的方案')
    }
    if (!expectedPlanPath || row.planPath !== expectedPlanPath) {
      throw new UserInputError('方案版本已变化，请重新审阅后批准')
    }
    if (!readRepoText(row.planPath).trim()) {
      throw new UserInputError('方案正文为空，不能执行')
    }
  }

  const { repoRoot } = requireAgent(row.agentSlug)

  const prompt = buildTaskPrompt({
    title: row.title,
    brief: row.brief,
    acceptance: row.acceptance,
    agentSlug: row.agentSlug,
    readOnly: runMode === 'plan' ? true : row.readOnly,
    mode: runMode,
    planPath: row.planPath,
    revisionNote,
    reviewNote: row.reviewNote,
    previousSummary: row.runs[0]?.summary,
    previousArtifacts: row.artifacts.map((item) => item.path),
  })

  const startedAt = new Date()
  // 派发前记一次工作区快照，结束时对比得到真实改动
  const baseline = await snapshotWorkspace(repoRoot)
  // 同时记下行数基线，用于扣除派发前就存在的未提交改动
  const baselineDiff = await snapshotDiffStat(repoRoot)
  const logRelative = taskLogPath(row.id, startedAt)
  const logAbsolute = path.join(repoRoot, logRelative)

  // 需求/验收标准里引用的图片 → codex --image 附件
  const images = await resolveTaskImages(`${row.brief}\n${row.acceptance}`)
  const promptWithImages =
    tool === 'codex' || !images.length
      ? prompt
      : `${prompt}\n\n## 参考图片（本地路径）\n${images
          .map((file) => `- ${file}`)
          .join('\n')}`

  let spawned
  const run = await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`task-agent:${row.agentSlug}`}))::text`
    const active = await transaction.taskRun.findMany({
      where: {
        primaryAgent: row.agentSlug,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
    })
    if (
      active.some(
        (candidate) =>
          alive(candidate.pid) ||
          (candidate.status === 'QUEUED' && !candidate.pid)
      )
    ) {
      if (runMode !== 'auto') {
        throw new UserInputError('该岗位忙碌，方案状态已保留，请稍后重试')
      }
      const queued = await transaction.task.updateMany({
        where: { id: row.id, status: row.status, updatedAt: row.updatedAt },
        data: { status: STATUS.QUEUED },
      })
      if (!queued.count)
        throw new UserInputError('任务状态已变化，请刷新后重试')
      return null
    }
    const claimed = await transaction.task.updateMany({
      where: { id: row.id, status: row.status, updatedAt: row.updatedAt },
      data: {
        status: STATUS.DISPATCHED,
        ...(runMode === 'plan' ? { planPath: null } : {}),
        ...(revisionNote ? { planNote: revisionNote } : {}),
      },
    })
    if (!claimed.count) throw new UserInputError('任务状态已变化，请刷新后重试')
    const reserved = await transaction.taskRun.create({
      data: {
        title: row.title,
        platform: tool,
        primaryAgent: row.agentSlug,
        status: 'QUEUED',
        currentStage: runMode === 'plan' ? 'PLANNING' : 'EXECUTION',
        taskId: row.id,
        logPath: logRelative,
        mode: runMode,
        dirtyAtDispatch: Object.keys(baseline).length > 0,
        baselineFiles: baseline,
        baselineDiff: baselineDiff as never,
        externalReference: `task:${row.id}`,
        startedAt,
      },
    })
    const reservedTask = await transaction.task.findUniqueOrThrow({
      where: { id: row.id },
    })
    return { ...reserved, taskVersion: reservedTask.updatedAt }
  })
  if (!run)
    return db.task.findUnique({ where: { id: row.id }, include: withRelations })
  try {
    spawned = spawnTaskAgent({
      tool: tool as AgentToolId,
      projectRoot: repoRoot,
      prompt: promptWithImages,
      logAbsolute,
      readOnly: runMode === 'plan' ? true : row.readOnly,
      images,
    })
    await db.$transaction(async (transaction) => {
      const claimed = await transaction.task.updateMany({
        where: {
          id: row.id,
          status: STATUS.DISPATCHED,
          updatedAt: run.taskVersion,
          runs: { some: { id: run.id, status: 'QUEUED' } },
        },
        data: { status: STATUS.DISPATCHED },
      })
      if (!claimed.count) throw new UserInputError('任务已取消或状态已变化')
      await transaction.taskRun.updateMany({
        where: { id: run.id, status: 'QUEUED' },
        data: { pid: spawned.pid, status: 'RUNNING' },
      })
      await transaction.taskEvent.create({
        data: {
          taskRunId: run.id,
          sequence: 1,
          eventType: 'task.dispatched',
          status: 'RUNNING',
          stage: runMode === 'plan' ? 'PLANNING' : 'EXECUTION',
          agent: row.agentSlug,
          summary: `派发到 ${tool}（PID ${spawned.pid}）`,
          idempotencyKey: `${run.id}:dispatched`,
        },
      })
    })
  } catch (error) {
    if (spawned?.pid) {
      try {
        process.kill(-spawned.pid, 'SIGTERM')
      } catch (killError) {
        logger.warn(
          { error: killError, runId: run.id },
          'failed dispatch cleanup'
        )
      }
    }
    await db.taskRun.updateMany({
      where: { id: run.id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        summary: String(error).slice(0, 1000),
      },
    })
    await db.task.updateMany({
      where: {
        id: row.id,
        status: STATUS.DISPATCHED,
        updatedAt: run.taskVersion,
        runs: { some: { id: run.id } },
      },
      data:
        runMode === 'plan'
          ? {
              status: STATUS.FAILED,
              planPath: null,
              reviewNote: `方案生成失败：${String(error).slice(0, 1000)}`,
            }
          : {
              status: row.status,
              planPath: row.planPath,
              planNote: row.planNote,
            },
    })
    throw new UserInputError(
      `派发失败：${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (process.env.NODE_ENV !== 'test')
    void captureSession(
      run.id,
      tool as AgentToolId,
      repoRoot,
      startedAt,
      logAbsolute
    )

  return db.task.findUnique({
    where: { id: row.id },
    include: withRelations,
  })
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    ;(timer as unknown as { unref?: () => void }).unref?.()
  })

const captureSession = async (
  runId: string,
  tool: AgentToolId,
  projectRoot: string,
  startedAt: Date,
  logAbsolute: string
) => {
  for (const delay of [500, 1_500, 3_000, 6_000, 12_000]) {
    await sleep(delay)
    try {
      const fromLog = sessionIdFromLog(logAbsolute, tool)
      if (fromLog) {
        await db.taskRun.update({
          where: { id: runId },
          data: { externalReference: `task:${runId}:${fromLog}` },
        })
        return
      }
      const found = await discoverSession({
        tool,
        projectRoot,
        since: startedAt,
      })
      if (found) {
        await db.taskRun.update({
          where: { id: runId },
          data: { externalReference: `task:${runId}:${found.sessionId}` },
        })
        return
      }
    } catch (error) {
      logger.warn({ error, runId }, 'task session discovery failed')
    }
  }
}

/** 同岗位串行：把最早排队的任务拉起来（防重入） */
const promoting = new Set<string>()

const promoteQueuedFor = async (agentSlug: string) => {
  if (!agentSlug || promoting.has(agentSlug)) return
  promoting.add(agentSlug)
  try {
    const next = await db.task.findFirst({
      where: { agentSlug, status: STATUS.QUEUED },
      orderBy: { createdAt: 'asc' },
    })
    if (next) await dispatchTask({ id: next.id })
  } catch (error) {
    logger.warn({ error, agentSlug }, 'promote queued task failed')
  } finally {
    promoting.delete(agentSlug)
  }
}

/**
 * 后台巡检：回收已退出的执行、推进排队任务。
 * 由定时器调用，不再依赖前端查询。
 */
/**
 * 进程已退出但没人回收的运行。
 * 正常路径是 reconcileTask 按任务状态回收；但如果任务被别的逻辑改成终态
 * （例如评估结论回写），reconcileTask 就不再遍历它，运行会永远停在"执行中"。
 * 这里按 pid + 日志独立收尾，不依赖任务状态。
 */
/** 进程还活着但日志长时间不动 → 判定为僵死（例如 pid 被系统复用） */
const RUN_LOG_STALE_MS = 15 * 60 * 1000
/** 会话同步的运行：这么久没有新记录就认为已经结束 */
const SESSION_IDLE_MS = 2 * 60 * 1000

const logLooksStale = (logPath: string | null) => {
  const age = logAgeMs(logPath)
  return age !== null && age > RUN_LOG_STALE_MS
}

type ActiveRun = {
  id: string
  pid: number | null
  platform: string
  summary: string | null
  logPath: string | null
  baselineDiff?: unknown
  diffStat?: unknown
}

/** 按日志把运行收尾（没有日志就按"进程已退出"收尾） */
const closeRunFromLog = async (run: ActiveRun) => {
  const repoRoot = resolveRepoRoot()
  let output: ReturnType<typeof parseTaskRunOutput> | null = null
  if (run.logPath) {
    try {
      output = parseTaskRunOutput({
        logPath: path.join(repoRoot, run.logPath),
        tool: run.platform as AgentToolId,
      })
    } catch (error) {
      logger.warn({ error, runId: run.id }, 'run log parse failed')
    }
  }

  const failed = Boolean(output?.error)

  // 没有派发基线的运行（会话同步、CLI 创建）无法归因，留空由页面提示覆盖率
  let diffStat: Awaited<ReturnType<typeof computeRunDiffStat>> = null
  if (!run.diffStat && run.baselineDiff) {
    diffStat = await computeRunDiffStat({
      repoRoot,
      baseline: run.baselineDiff as never,
    })
  }

  return db.taskRun
    .update({
      where: { id: run.id },
      data: {
        status: failed ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        summary:
          output?.error ||
          output?.summary ||
          run.summary ||
          (failed ? '执行失败' : '执行结束'),
        ...(output?.usage
          ? {
              inputTokens: output.usage.inputTokens ?? null,
              outputTokens: output.usage.outputTokens ?? null,
              cachedTokens: output.usage.cachedTokens ?? null,
            }
          : {}),
        ...(diffStat ? { diffStat } : {}),
      },
    })
    .catch((error) => {
      logger.warn({ error, runId: run.id }, 'run close failed')
      return null
    })
}

const sweepOrphanRuns = async () => {
  const rows = await db.taskRun.findMany({
    where: { status: { in: ['RUNNING', 'QUEUED'] }, pid: { not: null } },
    orderBy: { startedAt: 'asc' },
    take: 50,
  })

  for (const run of rows) {
    if (run.pid && alive(run.pid) && !logLooksStale(run.logPath)) continue
    await closeRunFromLog(run)
  }
}

export const sweepTasks = async () => {
  const rows = await db.task.findMany({
    where: { status: { in: [STATUS.DISPATCHED, STATUS.RUNNING] } },
    include: withRelations,
    take: 50,
  })

  for (const row of rows) {
    try {
      await reconcileTask(row as never)
    } catch (error) {
      logger.warn({ error, id: row.id }, 'task sweep failed')
    }
  }

  // 没有运行中任务的岗位，也可能有排队任务（例如上次推进中断）
  const queuedAgents = await db.task.findMany({
    where: { status: STATUS.QUEUED },
    select: { agentSlug: true },
    distinct: ['agentSlug'],
  })
  for (const { agentSlug } of queuedAgents) {
    await promoteQueuedFor(agentSlug)
  }

  await sweepOrphanRuns()
}

/** 方案待确认时，按修正意见重新出一版方案 */
export const reviseTaskPlan = async ({
  id,
  note,
  tool,
}: {
  id: string
  note: string
  tool?: string
}) => {
  const row = await db.task.findUnique({ where: { id } })
  if (!row) throw new UserInputError('任务不存在')
  if (row.status !== STATUS.AWAITING_APPROVAL) {
    throw new UserInputError('只有待确认方案的任务才能修订')
  }

  const revisionNote = (note || '').trim()
  if (!revisionNote) throw new UserInputError('请填写修正意见')
  if (revisionNote.length > 2000) {
    throw new UserInputError('修正意见不能超过 2000 字')
  }

  return dispatchTask({ id, tool, mode: 'plan', revisionNote })
}

/** 方案已确认：按任务原有权限执行 */
export const executeTaskPlan = async ({
  id,
  tool,
  planPath,
}: {
  id: string
  tool?: string
  planPath: string
}) => {
  const row = await db.task.findUnique({ where: { id } })
  if (!row) throw new UserInputError('任务不存在')
  if (row.status !== STATUS.AWAITING_APPROVAL) {
    throw new UserInputError('这条任务当前没有待确认的方案')
  }
  if (!row.planPath) {
    throw new UserInputError('没有找到方案文件，无法执行')
  }

  return dispatchTask({
    id,
    tool,
    mode: 'execute',
    expectedPlanPath: planPath,
  })
}

/** 批量派发：逐个派发，忙碌的自动进队列 */
export const dispatchTasks = async ({
  ids,
  tool = 'codex',
}: {
  ids: string[]
  tool?: string
}) => {
  if (!Array.isArray(ids) || !ids.length) {
    throw new UserInputError('请至少选择一个任务')
  }
  for (const id of ids.slice(0, 20)) {
    await dispatchTask({ id, tool })
  }
  return db.task.findMany({
    where: { id: { in: ids } },
    include: withRelations,
    orderBy: [{ updatedAt: 'desc' }],
  })
}

export const cancelTask = async ({ id }: { id: string }) => {
  const row = await db.task.findUnique({
    where: { id },
    include: withRelations,
  })
  if (!row) throw new UserInputError('任务不存在')
  if (row.status === STATUS.DONE)
    throw new UserInputError('已验收完成的任务不能取消')
  if (row.status === STATUS.CANCELLED) return row

  const run = row.runs[0]
  await db.$transaction(async (transaction) => {
    const cancelled = await transaction.task.updateMany({
      where: { id, status: row.status, updatedAt: row.updatedAt },
      data: { status: STATUS.CANCELLED },
    })
    if (!cancelled.count)
      throw new UserInputError('任务状态已变化，请刷新后重试')
    if (run) {
      await transaction.taskRun.updateMany({
        where: { id: run.id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'CANCELLED', completedAt: new Date() },
      })
    }
  })
  if (run && ['QUEUED', 'RUNNING'].includes(run.status) && alive(run.pid)) {
    try {
      process.kill(-(run.pid as number), 'SIGTERM')
    } catch (error) {
      logger.warn({ error, id }, 'task cancel kill failed')
    }
  }
  return db.task.findUnique({
    where: { id },
    include: withRelations,
  })
}

export const reviewTask = async ({
  id,
  decision,
  note,
}: {
  id: string
  decision: string
  note?: string | null
}) => {
  const row = await db.task.findUnique({
    where: { id },
    include: withRelations,
  })
  if (!row) throw new UserInputError('任务不存在')

  const reviewNote = text(note, 2000, '结论')
  if (row.status !== STATUS.AWAITING_REVIEW) {
    throw new UserInputError('只有待验收的任务才能提交验收结论')
  }
  const reviewedAt = new Date()
  const saveReview = async (data: {
    status: string
    reviewedAt: Date
    reviewNote: string
    completedAt: Date | null
  }) => {
    const changed = await db.task.updateMany({
      where: { id, status: row.status, updatedAt: row.updatedAt },
      data,
    })
    if (!changed.count) throw new UserInputError('任务状态已变化，请刷新后重试')
    return db.task.findUnique({ where: { id }, include: withRelations })
  }

  if (decision === 'APPROVE') {
    // 验收通过不能悄悄放过"零产物"：要么把产物补上，要么在结论里说明交付物在哪
    const artifactCount = await db.taskArtifact.count({ where: { taskId: id } })
    if (artifactCount === 0 && !reviewNote) {
      throw new UserInputError(
        '这次执行没有登记任何产物：请在验收结论里写明交付物在哪（例如 git 改动），或先补充产物再通过。'
      )
    }

    return saveReview({
      status: STATUS.DONE,
      completedAt: reviewedAt,
      reviewedAt,
      reviewNote,
    })
  }

  if (decision === 'REJECT') {
    if (!reviewNote) throw new UserInputError('打回需要填写原因')
    // 打回=退回重做：清掉完成时间，避免"待派发"的卡还带着旧的完成时间
    return saveReview({
      status: STATUS.DRAFT,
      reviewedAt,
      reviewNote,
      completedAt: null,
    })
  }

  throw new UserInputError('decision 只能是 APPROVE 或 REJECT')
}

export const addTaskArtifact = async ({
  taskId,
  input,
}: {
  taskId: string
  input: { kind?: string | null; path: string; label?: string | null }
}) => {
  const row = await db.task.findUnique({ where: { id: taskId } })
  if (!row) throw new UserInputError('任务不存在')

  const kind = text(input?.kind || 'file', 16, '类型') || 'file'
  if (!ARTIFACT_KINDS.has(kind)) {
    throw new UserInputError('产物类型只能是 file / dir / url / report')
  }

  const artifactPath = text(input?.path, 500, '产物路径')
  if (!artifactPath) throw new UserInputError('产物路径不能为空')

  const label = text(input?.label, 200, '名称') || path.basename(artifactPath)

  await db.taskArtifact.create({
    data: { taskId, kind, path: artifactPath, label, source: 'manual' },
  })

  return db.task.findUnique({ where: { id: taskId }, include: withRelations })
}

/** 读取某次执行所属轮次的会话消息（团队派发与会话同步两种 reference 都支持） */
export const taskRunMessages = async ({ runId }: { runId: string }) => {
  const run = await db.taskRun.findUnique({ where: { id: runId } })
  if (!run) throw new UserInputError('执行记录不存在')

  const reference = parseSessionReference(run.externalReference)
  if (!reference.sessionId) return []

  const trace = await readSessionTurnTrace({
    tool: run.platform,
    sessionId: reference.sessionId,
    turn: reference.turn,
    projectRoot: resolveRepoRoot(),
    limits: { messages: 200 },
  })

  return trace.messages.map((message) => ({
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    step: message.step ?? null,
  }))
}

/** 读取某次执行的日志尾部，用于页面内失败诊断 */
export const taskRunLog = async ({ runId }: { runId: string }) => {
  const run = await db.taskRun.findUnique({ where: { id: runId } })
  if (!run) throw new UserInputError('执行记录不存在')
  if (!run.logPath) throw new UserInputError('这次执行没有日志文件')

  const repoRoot = resolveRepoRoot()
  const absolute = path.resolve(repoRoot, run.logPath)
  const relative = path.relative(repoRoot, absolute)

  if (relative.startsWith('..') || !relative.startsWith('docs/tasks/logs/')) {
    throw new UserInputError('日志路径不在允许的目录内')
  }
  if (!existsSync(absolute)) throw new UserInputError('日志文件已不存在')

  const text = readFileSync(absolute, 'utf8')
  return text.slice(-65_536).split('\n').slice(-200).join('\n')
}

/** 总览页用的任务脉搏：待验收 / 执行中 / 排队 / 今日完成与失败 */
export const taskPulse = async () => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [awaitingReview, running, queued, completedToday, failedToday] =
    await Promise.all([
      db.task.count({ where: { status: STATUS.AWAITING_REVIEW } }),
      db.task.count({
        where: { status: { in: [STATUS.DISPATCHED, STATUS.RUNNING] } },
      }),
      db.task.count({ where: { status: STATUS.QUEUED } }),
      db.task.count({
        where: { status: STATUS.DONE, completedAt: { gte: startOfDay } },
      }),
      db.task.count({
        where: { status: STATUS.FAILED, updatedAt: { gte: startOfDay } },
      }),
    ])

  return { awaitingReview, running, queued, completedToday, failedToday }
}

/** 当前工作区是否有未提交改动（派发前提示用） */
export const workspaceStatus = async () => {
  const repoRoot = resolveRepoRoot()
  const snapshot = await snapshotWorkspace(repoRoot)
  const changedCount = Object.keys(snapshot).length
  return { dirty: changedCount > 0, changedCount }
}

/** 删除一条产物（手动清理噪音） */
export const removeTaskArtifact = async ({ id }: { id: string }) => {
  const artifact = await db.taskArtifact.findUnique({ where: { id } })
  if (!artifact) throw new UserInputError('产物不存在')

  await db.taskArtifact.delete({ where: { id } })
  return db.task.findUnique({
    where: { id: artifact.taskId },
    include: withRelations,
  })
}

const isDenied = (relative: string) =>
  DENY_SEGMENTS.some(
    (segment) => relative === segment || relative.startsWith(`${segment}/`)
  )

/** 只读读取仓库内文本文件：仓库内、非敏感目录、单文件 ≤200KB */
const readRepoText = (relativePath: string) => {
  const repoRoot = resolveRepoRoot()
  const absolute = path.resolve(repoRoot, relativePath)
  const relative = path.relative(repoRoot, absolute)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UserInputError('路径不在仓库内')
  }
  if (isDenied(relative)) throw new UserInputError('该路径不允许读取')
  if (!existsSync(absolute)) throw new UserInputError('文件不存在')
  const canonical = path.relative(
    realpathSync(repoRoot),
    realpathSync(absolute)
  )
  if (
    canonical.startsWith('..') ||
    path.isAbsolute(canonical) ||
    isDenied(canonical.split(path.sep).join('/'))
  ) {
    throw new UserInputError('该路径不允许读取')
  }
  if (!statSync(absolute).isFile()) throw new UserInputError('路径不是文件')
  if (statSync(absolute).size > CONTENT_MAX_BYTES) {
    throw new UserInputError('文件超过 200KB，请在本地打开')
  }

  return readFileSync(absolute, 'utf8')
}

/** 只读读取产物内容 */
export const taskArtifactContent = async ({ id }: { id: string }) => {
  const artifact = await db.taskArtifact.findUnique({ where: { id } })
  if (!artifact) throw new UserInputError('产物不存在')
  if (artifact.kind === 'url') throw new UserInputError('链接类产物不能读内容')

  return readRepoText(artifact.path)
}

/**
 * 手动刷新一条任务的状态：进程已退出或日志长时间不动时，按日志收尾并推进任务。
 * 用于"本地已经跑完但页面还停在执行中"的场景。
 */
export const refreshTask = async ({ id }: { id: string }) => {
  const row = await db.task.findUnique({
    where: { id },
    include: withRelations,
  })
  if (!row) throw new UserInputError('任务不存在')

  const run = row.runs[0]
  const looksDone =
    run &&
    ['RUNNING', 'QUEUED'].includes(run.status) &&
    (!run.pid || !alive(run.pid) || logLooksStale(run.logPath))

  if (looksDone) {
    await reconcileTask(row as never, { force: true })
  }

  return db.task.findUnique({ where: { id }, include: withRelations })
}

/** 手动刷新一条运行的状态，返回值是刷新后的运行 */
export const refreshRun = async ({ runId }: { runId: string }) => {
  const run = await db.taskRun.findUnique({ where: { id: runId } })
  if (!run) throw new UserInputError('执行记录不存在')
  if (!['RUNNING', 'QUEUED'].includes(run.status)) return run

  // 会话同步来的运行没有 pid：现场读一次会话快照再判断（只读，不触发清理）
  if (!run.pid) {
    const snapshot = await findSessionSnapshot(run.externalReference || '')

    if (snapshot && snapshot.status !== 'RUNNING') {
      return db.taskRun.update({
        where: { id: runId },
        data: {
          status: snapshot.status,
          currentStage: snapshot.stage,
          completedAt: snapshot.updatedAt,
          summary: run.summary,
        },
      })
    }

    // 会话还在产生记录 → 确实还在跑
    if (
      snapshot &&
      Date.now() - snapshot.updatedAt.getTime() < SESSION_IDLE_MS
    ) {
      return run
    }

    return db.taskRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        summary: run.summary || '会话已结束',
      },
    })
  }

  // 进程还在跑且日志还在写 → 状态是对的，不动它
  if (alive(run.pid) && !logLooksStale(run.logPath)) return run

  const task = run.taskId
    ? await db.task.findUnique({
        where: { id: run.taskId },
        include: withRelations,
      })
    : null
  if (task) {
    await reconcileTask(task as never, { force: true })
  } else {
    await closeRunFromLog(run)
  }

  return db.taskRun.findUnique({ where: { id: runId } })
}

/**
 * 派发前预检：验收标准是否可核对、交付物目录是否存在、只读任务是否要求写文件等。
 * 只做确定性判断，不调用模型。
 */
export const taskPrecheck = async ({ id }: { id: string }) => {
  const row = await db.task.findUnique({
    where: { id },
    select: {
      title: true,
      brief: true,
      acceptance: true,
      readOnly: true,
      agentSlug: true,
    },
  })
  if (!row) throw new UserInputError('任务不存在')

  const result = precheckTask(row, resolveRepoRoot())

  // 岗位评估的镜像任务：直接用普通任务派发不会走评估流程，也就不会产出报告
  const evaluation = await db.roleEvaluation.findFirst({
    where: { taskId: id },
    select: { id: true, tool: true },
  })
  if (evaluation) {
    result.warnings.push(
      '这张卡是岗位评估的镜像记录：评估请到岗位档案点「岗位评估更新」执行，用普通任务派发不会生成评估报告。'
    )
  }

  return result
}

/** 只读读取任务方案文件（docs/plans/*.md），用于阶段详情的「方案规划」 */
export const taskPlanContent = async ({
  taskId,
  planPath,
}: {
  taskId: string
  planPath?: string | null
}) => {
  const row = await db.task.findUnique({ where: { id: taskId } })
  if (!row) throw new UserInputError('任务不存在')
  if (!row.planPath) throw new UserInputError('这条任务还没有方案文件')
  if (planPath && row.planPath !== planPath) {
    throw new UserInputError('方案版本已变化，请刷新任务')
  }

  return readRepoText(row.planPath)
}

// 后台巡检：页面关掉也能回收执行并推进队列（测试环境不启动）
// 顺带回收岗位评估：没人打开面板时也要把结论写回任务看板
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.JEST_WORKER_ID === undefined
) {
  startTaskTicker(async () => {
    await sweepTasks()
    await reconcileRunningEvaluations().catch((error) =>
      logger.warn({ error }, 'role evaluation sweep failed')
    )
    await syncEvaluationTasks()
  })
}
