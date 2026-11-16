import { existsSync, readFileSync, statSync } from 'node:fs'
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
import { logger } from 'src/lib/logger'
import { readTeamAgent, resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'
import {
  discoverSession,
  readThreadMessages,
  sessionIdFromLog,
} from 'src/lib/roleEvaluationSessions'
import { parseTaskRunOutput } from 'src/lib/taskOutput'
import { startTaskTicker } from 'src/lib/taskTicker'
import { changedFiles, snapshotWorkspace } from 'src/lib/taskWorkspace'
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
const reconcileTask = async (task: {
  id: string
  status: string
  runs: Array<{
    id: string
    pid: number | null
    status: string
    platform: string
    mode: string
    summary: string | null
    logPath: string | null
    baselineFiles: unknown
  }>
}) => {
  if (!ACTIVE_STATUSES.has(task.status as never))
    return { row: task, changed: false }
  const run = task.runs[0]
  if (!run) return { row: task, changed: false }
  if (alive(run.pid)) return { row: task, changed: false }

  const finishedAt = new Date()

  // 进程结束后解析日志：交付摘要 + artifact: 约定行
  const repoRoot = resolveRepoRoot()
  const logAbsolute = run.logPath
    ? path.join(repoRoot, run.logPath)
    : path.join(repoRoot, 'docs/tasks/logs')
  const output = run.logPath
    ? parseTaskRunOutput({
        logPath: logAbsolute,
        tool: run.platform as AgentToolId,
      })
    : { summary: '', artifacts: [] }

  const failed = Boolean(output.error)

  await db.taskRun
    .update({
      where: { id: run.id },
      data: {
        status: failed ? 'FAILED' : 'COMPLETED',
        completedAt: finishedAt,
        summary: output.error || output.summary || run.summary || null,
        inputTokens: output.usage?.inputTokens ?? null,
        outputTokens: output.usage?.outputTokens ?? null,
        cachedTokens: output.usage?.cachedTokens ?? null,
      },
    })
    .catch((error) => logger.warn({ error }, 'task run reconcile failed'))

  // 产物兜底：比较工作区快照，把这次真正改动过的文件登记为产物
  if (run.baselineFiles) {
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

  if (output.artifacts.length || output.summary) {
    const existing = await db.taskArtifact.findMany({
      where: { taskId: task.id },
      select: { path: true },
    })
    const known = new Set(existing.map((item) => item.path))
    const fresh = output.artifacts.filter((item) => !known.has(item.path))

    if (fresh.length) {
      await db.taskArtifact
        .createMany({
          data: fresh.map((item) => ({
            taskId: task.id,
            kind: item.kind,
            source: item.source || 'item',
            path: item.path,
            label: item.label,
          })),
        })
        .catch((error) =>
          logger.warn({ error }, 'task artifact auto register failed')
        )
    }

    await db.taskEvent
      .create({
        data: {
          taskRunId: run.id,
          sequence: 2,
          eventType: 'task.finished',
          status: 'COMPLETED',
          stage: 'DELIVERY',
          agent: task.agentSlug,
          summary: output.summary || '执行结束',
          idempotencyKey: `${run.id}:finished`,
        },
      })
      .catch(() => {
        // 事件重复写入（多次查询触发）时忽略
      })
  }

  const isPlanRun = run.mode === 'plan'
  const nextStatus = failed
    ? STATUS.FAILED
    : run.status === 'CANCELLED'
      ? STATUS.CANCELLED
      : isPlanRun
        ? STATUS.AWAITING_APPROVAL
        : STATUS.AWAITING_REVIEW
  const planArtifact = output.artifacts.find(
    (item) => item.kind === 'report' && /^docs\/plans\//.test(item.path)
  )

  await db.task
    .update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        ...(isPlanRun && planArtifact ? { planPath: planArtifact.path } : {}),
      },
    })
    .catch((error) => logger.warn({ error }, 'task reconcile failed'))

  // 该岗位腾出来了：把排队中的下一个任务自动拉起来
  await promoteQueuedFor(task.agentSlug as string)

  return {
    row: {
      ...task,
      status: nextStatus,
      runs: [{ ...run, status: 'COMPLETED' }],
    },
    changed: true,
  }
}

const withRelations = {
  runs: { orderBy: { startedAt: 'desc' as const }, take: 5 },
  artifacts: { orderBy: { createdAt: 'asc' as const } },
}

export const tasks = async ({
  status,
  agentSlug,
}: { status?: string | null; agentSlug?: string | null } = {}) => {
  const where = {
    ...(status ? { status } : {}),
    ...(agentSlug ? { agentSlug } : {}),
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
  if (!result.changed) return result.row

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
  if (row.status === STATUS.RUNNING) {
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

  return db.task.update({ where: { id }, data, include: withRelations })
}

/** 派发：生成一次 TaskRun 并拉起本地 agent */
export const dispatchTask = async ({
  id,
  tool = 'codex',
  mode,
  revisionNote,
  planTarget,
}: {
  id: string
  tool?: string
  mode?: TaskMode
  revisionNote?: string
  planTarget?: string
}) => {
  const row = await db.task.findUnique({
    where: { id },
    include: withRelations,
  })
  if (!row) throw new UserInputError('任务不存在')
  if (!DISPATCHABLE.has(row.status as never)) {
    throw new UserInputError(`当前状态（${row.status}）不能派发`)
  }

  const runMode: TaskMode = mode || ((row.mode as TaskMode) ?? 'auto')
  if (row.status === STATUS.AWAITING_APPROVAL && runMode === 'auto') {
    throw new UserInputError('方案待确认：请先批准方案再执行')
  }

  const { repoRoot } = requireAgent(row.agentSlug)

  const active = await db.taskRun.findFirst({
    where: {
      primaryAgent: row.agentSlug,
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    orderBy: { startedAt: 'desc' },
  })

  // 同岗位已有任务在跑：进队列，等它结束自动接着跑
  if (active && alive(active.pid)) {
    return db.task.update({
      where: { id: row.id },
      data: { status: STATUS.QUEUED },
      include: withRelations,
    })
  }

  const stamp = new Date()
  const planFile =
    planTarget ||
    (runMode === 'plan' && row.planPath
      ? `${row.id}-${stamp.getHours()}${stamp.getMinutes()}${stamp.getSeconds()}.md`
      : `${row.id}.md`)
  const prompt = buildTaskPrompt({
    title: row.title,
    brief: row.brief,
    acceptance: row.acceptance,
    agentSlug: row.agentSlug,
    readOnly: runMode === 'plan' ? true : row.readOnly,
    mode: runMode,
    planPath: runMode === 'execute' ? row.planPath : `plans/${planFile}`,
    revisionNote,
    reviewNote: row.reviewNote,
    previousSummary: row.runs[0]?.summary,
    previousArtifacts: row.artifacts.map((item) => item.path),
  })

  const startedAt = new Date()
  // 派发前记一次工作区快照，结束时对比得到真实改动
  const baseline = await snapshotWorkspace(repoRoot)
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
  try {
    spawned = spawnTaskAgent({
      tool: tool as AgentToolId,
      projectRoot: repoRoot,
      prompt: promptWithImages,
      logAbsolute,
      readOnly: runMode === 'plan' ? true : row.readOnly,
      images,
    })
  } catch (error) {
    throw new UserInputError(
      `派发失败：${error instanceof Error ? error.message : String(error)}`
    )
  }

  const run = await db.taskRun.create({
    data: {
      title: row.title,
      platform: tool,
      primaryAgent: row.agentSlug,
      status: 'RUNNING',
      currentStage: 'EXECUTION',
      taskId: row.id,
      logPath: logRelative,
      pid: spawned.pid,
      mode: runMode,
      dirtyAtDispatch: Object.keys(baseline).length > 0,
      baselineFiles: baseline,
      externalReference: `task:${row.id}`,
      startedAt,
    },
  })

  await db.taskEvent.create({
    data: {
      taskRunId: run.id,
      sequence: 1,
      eventType: 'task.dispatched',
      status: 'RUNNING',
      stage: 'EXECUTION',
      agent: row.agentSlug,
      summary: `派发到 ${tool}（PID ${spawned.pid}）`,
      idempotencyKey: `${run.id}:dispatched`,
    },
  })

  await db.task.update({
    where: { id: row.id },
    data: { status: STATUS.DISPATCHED },
  })

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
}

/** 方案待确认时，按修正意见重新出一版方案 */
export const reviseTaskPlan = async ({
  id,
  note,
  tool = 'codex',
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

  await db.task.update({
    where: { id },
    data: { planNote: revisionNote },
  })

  return dispatchTask({ id, tool, mode: 'plan', revisionNote })
}

/** 方案已确认：按方案执行（可写） */
export const executeTaskPlan = async ({
  id,
  tool = 'codex',
}: {
  id: string
  tool?: string
}) => {
  const row = await db.task.findUnique({ where: { id } })
  if (!row) throw new UserInputError('任务不存在')
  if (row.status !== STATUS.AWAITING_APPROVAL) {
    throw new UserInputError('这条任务当前没有待确认的方案')
  }
  if (!row.planPath) {
    throw new UserInputError('没有找到方案文件，无法执行')
  }

  return dispatchTask({ id, tool, mode: 'execute' })
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

  const run = row.runs[0]
  if (run && alive(run.pid)) {
    try {
      process.kill(run.pid as number, 'SIGTERM')
    } catch (error) {
      logger.warn({ error, id }, 'task cancel kill failed')
    }
  }
  if (run) {
    await db.taskRun.update({
      where: { id: run.id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    })
  }

  return db.task.update({
    where: { id },
    data: { status: STATUS.CANCELLED },
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
  const reviewedAt = new Date()

  if (decision === 'APPROVE') {
    return db.task.update({
      where: { id },
      data: {
        status: STATUS.DONE,
        completedAt: reviewedAt,
        reviewedAt,
        reviewNote,
      },
      include: withRelations,
    })
  }

  if (decision === 'REJECT') {
    if (!reviewNote) throw new UserInputError('打回需要填写原因')
    return db.task.update({
      where: { id },
      data: { status: STATUS.DRAFT, reviewedAt, reviewNote },
      include: withRelations,
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

/** 读取某次执行的会话线程（复用岗位评估的会话解析） */
export const taskRunMessages = async ({ runId }: { runId: string }) => {
  const run = await db.taskRun.findUnique({ where: { id: runId } })
  if (!run) throw new UserInputError('执行记录不存在')

  const parts = (run.externalReference || '').split(':')
  const sessionId = parts.length >= 3 ? parts.slice(2).join(':') : ''
  if (!sessionId) return []

  return readThreadMessages({
    tool: run.platform as AgentToolId,
    sessionId,
    projectRoot: resolveRepoRoot(),
  })
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

/** 只读读取产物内容：必须落在仓库内、非敏感目录、单文件 ≤200KB */
export const taskArtifactContent = async ({ id }: { id: string }) => {
  const artifact = await db.taskArtifact.findUnique({ where: { id } })
  if (!artifact) throw new UserInputError('产物不存在')
  if (artifact.kind === 'url') throw new UserInputError('链接类产物不能读内容')

  const repoRoot = resolveRepoRoot()
  const absolute = path.resolve(repoRoot, artifact.path)
  const relative = path.relative(repoRoot, absolute)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UserInputError('产物路径不在仓库内')
  }
  if (isDenied(relative)) throw new UserInputError('该路径不允许读取')
  if (!existsSync(absolute)) throw new UserInputError('产物文件不存在')
  if (statSync(absolute).size > CONTENT_MAX_BYTES) {
    throw new UserInputError('产物超过 200KB，请在本地打开')
  }

  return readFileSync(absolute, 'utf8')
}

// 后台巡检：页面关掉也能回收执行并推进队列（测试环境不启动）
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.JEST_WORKER_ID === undefined
) {
  startTaskTicker(sweepTasks)
}
