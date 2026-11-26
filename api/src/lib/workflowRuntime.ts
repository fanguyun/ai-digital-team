import { randomUUID } from 'node:crypto'
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import path from 'node:path'

import type { Prisma } from 'api/db/generated/prisma/client.mts'

import { UserInputError } from '@cedarjs/graphql-server'

import { spawnTaskAgent, taskLogPath, type AgentToolId } from './agentDispatch'
import { db } from './db'
import { knowledgeContext } from './knowledgeContext'
import { retrieveKnowledge } from './knowledgeRetrieval'
import { logger } from './logger'
import {
  probeBinary,
  readTeamAgent,
  resolveRepoRoot,
} from './roleEvaluationDispatch'
import { sessionIdFromLog } from './roleEvaluationSessions'
import {
  normalizePublicationMarkdown,
  publicationHash,
} from './siyuanPublication'
import { parseTaskRunOutput } from './taskOutput'
import {
  buildWorkflowPrompt,
  parseWorkflowOutput,
  RESEARCH_WORKFLOW,
  WORKFLOW_TIMEOUT,
  workflowHash,
  workflowInputsFor,
  type ResearchInput,
  type WorkflowOutput,
} from './workflowDefinition'

const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
export const workflowInclude = {
  task: true,
  steps: {
    orderBy: { ordinal: 'asc' as const },
    include: { attempts: { orderBy: { number: 'desc' as const } } },
  },
}
export const getWorkflow = (taskId: string) =>
  db.taskWorkflow.findUnique({ where: { taskId }, include: workflowInclude })
type Workflow = NonNullable<Awaited<ReturnType<typeof getWorkflow>>>
type Tx = Prisma.TransactionClient

const alive = (pid: number | null) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
const stop = (pid: number | null) => {
  if (!pid || !alive(pid)) return
  try {
    process.kill(-pid, 'SIGTERM')
  } catch (error) {
    logger.warn({ error, pid }, 'workflow process stop failed')
  }
}
const stageFor = (index: number) =>
  index === 0
    ? ('PLANNING' as const)
    : index === 3
      ? ('VERIFICATION' as const)
      : index >= 4
        ? ('DELIVERY' as const)
        : ('EXECUTION' as const)

const event = async (
  tx: Tx,
  w: Workflow,
  action: string,
  summary: string,
  usage?: { inputTokens?: number; outputTokens?: number; cachedTokens?: number }
) => {
  if (!w.runId) return
  await tx.$queryRaw`SELECT "id" FROM "TaskRun" WHERE "id" = ${w.runId}::uuid FOR UPDATE`
  const key = `workflow:${w.id}:${w.version}:${action}`
  if (await tx.taskEvent.findUnique({ where: { idempotencyKey: key } })) return
  const last = await tx.taskEvent.findFirst({
    where: { taskRunId: w.runId },
    orderBy: { sequence: 'desc' },
  })
  await tx.taskEvent.create({
    data: {
      taskRunId: w.runId,
      sequence: (last?.sequence || 0) + 1,
      idempotencyKey: key,
      eventType: `workflow.${action}`,
      stage: stageFor(w.currentStep),
      agent: w.steps[w.currentStep]?.agentSlug || 'main-agent',
      summary: summary.slice(0, 1000),
      ...usage,
    },
  })
}

const claim = async (
  tx: Tx,
  w: Workflow,
  data: Prisma.TaskWorkflowUpdateManyMutationInput
) => {
  const changed = await tx.taskWorkflow.updateMany({
    where: { id: w.id, version: w.version, status: w.status },
    data: { ...data, version: { increment: 1 } },
  })
  if (!changed.count) throw new UserInputError('工作流状态已变化，请刷新后重试')
}

const setState = async (
  tx: Tx,
  w: Workflow,
  status: string,
  note: string | null = null,
  currentStep = w.currentStep
) => {
  await claim(tx, w, { status, currentStep, note })
  const taskStatus =
    {
      RUNNING: 'RUNNING',
      QUEUED: 'QUEUED',
      WAITING_CONFIRMATION: 'WAITING_CONFIRMATION',
      BLOCKED: 'ENVIRONMENT_BLOCKED',
      FAILED: 'FAILED',
      COMPLETED: 'DONE',
      CANCELLED: 'CANCELLED',
      PUBLISHING: 'RUNNING',
      PUBLICATION_FAILED: 'ENVIRONMENT_BLOCKED',
      NEEDS_INPUT: 'WAITING_CONFIRMATION',
      REVIEW_FAILED: 'AWAITING_REVIEW',
    }[status] || 'AWAITING_REVIEW'
  await tx.task.update({
    where: { id: w.taskId },
    data: {
      status: taskStatus,
      reviewNote: note,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
  })
  if (w.runId)
    await tx.taskRun.update({
      where: { id: w.runId },
      data: {
        status:
          status === 'COMPLETED'
            ? 'COMPLETED'
            : status === 'CANCELLED'
              ? 'CANCELLED'
              : status === 'QUEUED'
                ? 'QUEUED'
                : [
                      'WAITING_CONFIRMATION',
                      'BLOCKED',
                      'FAILED',
                      'NEEDS_INPUT',
                      'REVIEW_FAILED',
                      'PUBLICATION_FAILED',
                    ].includes(status)
                  ? 'WAITING_CONFIRMATION'
                  : 'RUNNING',
        currentStage: stageFor(currentStep),
        summary: note?.slice(0, 1000),
        completedAt: ['COMPLETED', 'CANCELLED'].includes(status)
          ? new Date()
          : null,
      },
    })
}

export const workflowTemplates = () =>
  process.env.WORKFLOWS_ENABLED === 'false' ? [] : [RESEARCH_WORKFLOW]
export const createResearchWorkflow = async (
  input: Record<string, unknown>
) => {
  if (!workflowTemplates().length) throw new UserInputError('工作流入口已停用')
  const text = (key: string, fallback = '', max = 2000) => {
    const value =
      typeof input[key] === 'string' ? (input[key] as string).trim() : fallback
    if (value.length > max) throw new UserInputError(`${key} 超过${max}字符`)
    return value
  }
  if (input.templateKey !== RESEARCH_WORKFLOW.key)
    throw new UserInputError('不支持的工作流模板')
  const data: ResearchInput = {
    title: text('title', '', 120),
    questions: text('questions'),
    audience: text('audience', '个人及团队内部', 300),
    scope: text('scope'),
    materials: text('materials', '', 2000),
    sourceMode: 'knowledge-web',
  }
  if (!data.title || !data.questions || !data.scope)
    throw new UserInputError('请填写主题、研究问题及范围与时效要求')
  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: data.title,
        brief: `${data.questions}\n范围：${data.scope}`,
        acceptance: '证据、报告、独立核验齐全；人工确认后思源入库回读一致。',
        agentSlug: 'main-agent',
        status: 'DRAFT',
        readOnly: true,
        useKnowledge: true,
      },
    })
    await tx.taskWorkflow.create({
      data: {
        taskId: task.id,
        templateKey: RESEARCH_WORKFLOW.key,
        templateVersion: RESEARCH_WORKFLOW.version,
        definition: json(RESEARCH_WORKFLOW),
        input: json(data),
        steps: {
          create: RESEARCH_WORKFLOW.steps.map((step, ordinal) => ({
            ...step,
            ordinal,
          })),
        },
      },
    })
    return task
  })
}

export const startWorkflow = async ({
  taskId,
  version,
  tool = 'codex',
}: {
  taskId: string
  version: number
  tool?: string
}) => {
  const w = await getWorkflow(taskId)
  if (!w || w.version !== version || w.status !== 'DRAFT')
    throw new UserInputError('只有当前版本的草稿可以启动，请刷新')
  if (!['codex', 'deepseek-harness'].includes(tool))
    throw new UserInputError('不支持的执行工具')
  const probe = probeBinary(tool as AgentToolId)
  if (!('bin' in probe)) throw new UserInputError(probe.reason)
  for (const step of w.steps.filter((s) => s.kind === 'AGENT')) {
    if (!readTeamAgent(step.agentSlug, resolveRepoRoot()))
      throw new UserInputError(`执行岗位不可用：${step.agentSlug}`)
  }
  await db.$transaction(async (tx) => {
    await claim(tx, w, { status: 'RUNNING', tool })
    const run = await tx.taskRun.create({
      data: {
        taskId,
        title: w.task.title,
        platform: tool,
        externalReference: `workflow:${w.id}`,
        primaryAgent: 'main-agent',
        status: 'RUNNING',
        currentStage: 'INTAKE',
        mode: 'workflow',
        projectKey: 'digital-team',
        projectName: '个人数字团队',
      },
    })
    await tx.taskWorkflow.update({
      where: { id: w.id },
      data: { runId: run.id },
    })
    await tx.task.update({ where: { id: taskId }, data: { status: 'RUNNING' } })
    await event(
      tx,
      { ...w, runId: run.id },
      'started',
      '已确认研究范围与固定步骤；仅入库前再次确认。'
    )
  })
  await advanceWorkflow(taskId)
  return db.task.findUniqueOrThrow({ where: { id: taskId } })
}

const upstreamFor = (
  w: Workflow,
  key: string
): Record<
  string,
  { attemptId: string; contentHash: string; output: Prisma.JsonValue }
> =>
  Object.fromEntries(
    workflowInputsFor(key).map((dependency) => {
      const step = w.steps.find((s) => s.key === dependency)
      const attempt = step?.attempts.find(
        (a) => a.number === step.attemptCount && a.status === 'COMPLETED'
      )
      if (!attempt?.output || !attempt.contentHash)
        throw new Error(`上游产物 ${dependency} 不可用`)
      return [
        dependency,
        {
          attemptId: attempt.id,
          contentHash: attempt.contentHash,
          output: attempt.output,
        },
      ]
    })
  )

/** 数据库领取步骤后才启动进程；无 PID 的领取不自动重派，防止崩溃窗口重复执行。 */
export const advanceWorkflow = async (taskId: string) => {
  const w = await getWorkflow(taskId)
  if (!w || !['RUNNING', 'QUEUED'].includes(w.status)) return
  const step = w.steps[w.currentStep]
  if (!step) return
  if (step.kind !== 'AGENT') {
    if (step.key === 'approval' && w.status !== 'WAITING_CONFIRMATION')
      await db.$transaction(async (tx) => {
        await setState(
          tx,
          w,
          'WAITING_CONFIRMATION',
          '研究报告已核验，请预览正文并确认思源笔记本、目录与标题。'
        )
        await tx.workflowStep.update({
          where: { id: step.id },
          data: { status: 'WAITING' },
        })
        await event(
          tx,
          w,
          'waiting_publication',
          '报告已核验，等待人工确认具体入库快照。'
        )
      })
    return
  }
  const previous = step.attempts.find((a) => a.number === step.attemptCount)
  if (['STARTING', 'RUNNING'].includes(step.status) && previous)
    return reconcileAttempt(w, previous)
  if (step.status !== 'PENDING') return
  const upstream = upstreamFor(w, step.key)
  const review = w.steps[3].attempts.find(
    (a) =>
      a.status === 'COMPLETED' &&
      (a.output as unknown as WorkflowOutput)?.verdict === 'REWORK'
  )
  if (['research', 'draft'].includes(step.key) && review)
    upstream.reviewFeedback = {
      attemptId: review.id,
      contentHash: review.contentHash!,
      output: review.output!,
    }
  const attempt = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`task-agent:${step.agentSlug}`}))::text`
    const busy = await tx.workflowAttempt.count({
      where: {
        status: { in: ['QUEUED', 'RUNNING'] },
        step: { agentSlug: step.agentSlug },
      },
    })
    const normal = await tx.taskRun.findMany({
      where: {
        mode: { not: 'workflow' },
        primaryAgent: step.agentSlug,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
    })
    if (busy || normal.some((r) => alive(r.pid) || r.status === 'QUEUED')) {
      if (w.status !== 'QUEUED')
        await setState(tx, w, 'QUEUED', `等待${step.agentSlug}岗位空闲`)
      return null
    }
    await claim(tx, w, { status: 'RUNNING' })
    const id = randomUUID()
    const a = await tx.workflowAttempt.create({
      data: {
        id,
        stepId: step.id,
        number: step.attemptCount + 1,
        input: json({ research: w.input, upstream, note: w.note }),
        logPath: taskLogPath(w.taskId),
      },
    })
    await tx.workflowStep.update({
      where: { id: step.id },
      data: { status: 'STARTING', attemptCount: { increment: 1 } },
    })
    await tx.task.update({ where: { id: taskId }, data: { status: 'RUNNING' } })
    await event(
      tx,
      w,
      `step_started:${a.id}`,
      `开始 ${step.name}（第${a.number}次）`
    )
    return a
  })
  if (!attempt) return
  let spawned: ReturnType<typeof spawnTaskAgent> | undefined
  try {
    let knowledge = ''
    const input = w.input as unknown as ResearchInput
    if (
      ['research', 'verify'].includes(step.key) &&
      input.sourceMode !== 'web'
    ) {
      const result = await retrieveKnowledge({
        agentSlug: step.agentSlug,
        query: `${input.title} ${input.questions}`.slice(0, 1500),
      })
      if (!['hit', 'empty'].includes(result.status))
        throw new Error(
          `知识库不可用（${result.status}）；修复后重试或明确缩小来源范围。`
        )
      knowledge = knowledgeContext(result).prompt
    }
    const prompt = buildWorkflowPrompt({
      input,
      step,
      upstream,
      note: w.note,
      knowledge,
    })
    const current = await getWorkflow(taskId)
    if (
      !current ||
      current.status !== 'RUNNING' ||
      current.currentStep !== w.currentStep
    )
      return
    spawned = spawnTaskAgent({
      tool: w.tool as AgentToolId,
      projectRoot: resolveRepoRoot(),
      prompt,
      logAbsolute: path.join(resolveRepoRoot(), attempt.logPath!),
      readOnly: true,
      managedWorkflow: true,
    })
    const saved = await db.workflowAttempt.updateMany({
      where: { id: attempt.id, status: 'QUEUED' },
      data: { status: 'RUNNING', pid: spawned.pid },
    })
    if (!saved.count) {
      stop(spawned.pid)
      return
    }
    await db.workflowStep.updateMany({
      where: { id: step.id, status: 'STARTING' },
      data: { status: 'RUNNING' },
    })
    const after = await getWorkflow(taskId)
    if (after?.status === 'CANCELLED') stop(spawned.pid)
  } catch (error) {
    stop(spawned?.pid || null)
    const current = await getWorkflow(taskId)
    if (current && current.status !== 'CANCELLED')
      await failAttempt(
        current,
        attempt.id,
        error instanceof Error ? error.message : '步骤启动失败',
        'BLOCKED'
      )
  }
}

const failAttempt = async (
  w: Workflow,
  attemptId: string,
  message: string,
  state = 'FAILED',
  usage?: { inputTokens?: number; outputTokens?: number; cachedTokens?: number }
) =>
  db.$transaction(async (tx) => {
    await setState(tx, w, state, message.slice(0, 2000))
    await tx.workflowAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'FAILED',
        error: message.slice(0, 2000),
        finishedAt: new Date(),
        ...usage,
      },
    })
    await tx.workflowStep.update({
      where: { id: w.steps[w.currentStep].id },
      data: { status: 'FAILED' },
    })
    await event(tx, w, `step_failed:${attemptId}`, message, usage)
    await aggregateUsage(tx, w)
  })

const aggregateUsage = async (tx: Tx, w: Workflow) => {
  if (!w.runId) return
  const attempts = await tx.workflowAttempt.findMany({
    where: {
      step: { workflowId: w.id, kind: 'AGENT' },
      finishedAt: { not: null },
    },
  })
  const total = (key: 'inputTokens' | 'outputTokens' | 'cachedTokens') =>
    attempts.some((a) => a[key] == null)
      ? null
      : attempts.reduce((sum, a) => sum + a[key]!, 0)
  await tx.taskRun.update({
    where: { id: w.runId },
    data: {
      inputTokens: total('inputTokens'),
      outputTokens: total('outputTokens'),
      cachedTokens: total('cachedTokens'),
    },
  })
}

const reconcileAttempt = async (
  w: Workflow,
  attempt: Workflow['steps'][number]['attempts'][number]
) => {
  const step = w.steps[w.currentStep]
  const logAbsolute = path.join(resolveRepoRoot(), attempt.logPath!)
  const sessionId = sessionIdFromLog(logAbsolute, w.tool as AgentToolId)
  if (sessionId && !attempt.sessionId)
    await db.workflowAttempt.update({
      where: { id: attempt.id },
      data: { sessionId },
    })
  const elapsed = Date.now() - attempt.startedAt.getTime()
  const output = parseTaskRunOutput({
    logPath: logAbsolute,
    tool: w.tool as AgentToolId,
  })
  if (elapsed > WORKFLOW_TIMEOUT) {
    stop(attempt.pid)
    return failAttempt(
      w,
      attempt.id,
      '步骤超过15分钟，已停止；可从当前步骤重试。',
      'FAILED',
      output.usage
    )
  }
  if (attempt.status === 'QUEUED' && elapsed < 120_000) return
  // CLI 启动期间可能打印无关 MCP 的 ERROR；进程退出后才按完整日志判定结果。
  if (alive(attempt.pid)) return
  if (output.error || !output.completed) {
    stop(attempt.pid)
    return failAttempt(
      w,
      attempt.id,
      output.error || '执行未正常结束或启动结果未确认；未推进后续步骤。',
      'FAILED',
      output.usage
    )
  }
  let result: WorkflowOutput
  try {
    result = parseWorkflowOutput(
      output.finalText || '',
      step.key,
      (w.input as unknown as ResearchInput).sourceMode
    )
  } catch (error) {
    return failAttempt(
      w,
      attempt.id,
      error instanceof Error ? error.message : '交付结构不合法',
      'FAILED',
      output.usage
    )
  }
  const content = result.markdown
  const hash = workflowHash(content)
  const relative = `docs/tasks/workflows/${w.id}/${step.key}-${attempt.number}-${attempt.id}.md`
  try {
    const absolute = path.join(resolveRepoRoot(), relative)
    mkdirSync(path.dirname(absolute), { recursive: true })
    if (!existsSync(absolute)) {
      try {
        writeFileSync(absolute, content, { encoding: 'utf8', flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
    if (workflowHash(readFileSync(absolute, 'utf8')) !== hash)
      throw new Error('已保存产物与本次交付不一致，未覆盖原文件')
  } catch (error) {
    return failAttempt(
      w,
      attempt.id,
      error instanceof Error ? error.message : '产物保存失败',
      'FAILED',
      output.usage
    )
  }
  await db.$transaction(async (tx) => {
    const waiting = result.status !== 'OK'
    const rework = step.key === 'verify' && result.verdict === 'REWORK'
    const autoRework = rework && w.reworkCount < 1
    const targetIndex = autoRework
      ? result.retryFrom === 'research'
        ? 1
        : 2
      : w.currentStep + 1
    const status = waiting
      ? result.status === 'BLOCKED'
        ? 'BLOCKED'
        : 'NEEDS_INPUT'
      : rework && !autoRework
        ? 'REVIEW_FAILED'
        : 'RUNNING'
    await setState(
      tx,
      w,
      status,
      waiting || rework ? content.slice(0, 2000) : null,
      waiting || (rework && !autoRework) ? w.currentStep : targetIndex
    )
    const artifact = await tx.taskArtifact.create({
      data: {
        taskId: w.taskId,
        kind: 'report',
        source: 'workflow',
        path: relative,
        label: `${step.name} · 第${attempt.number}版`,
        lastRunId: w.runId,
      },
    })
    await tx.workflowAttempt.update({
      where: { id: attempt.id },
      data: {
        status: waiting ? 'WAITING' : 'COMPLETED',
        output: json(result),
        artifactId: artifact.id,
        contentHash: hash,
        finishedAt: new Date(),
        inputTokens: output.usage?.inputTokens,
        outputTokens: output.usage?.outputTokens,
        cachedTokens: output.usage?.cachedTokens,
      },
    })
    await tx.workflowStep.update({
      where: { id: step.id },
      data: { status: waiting ? 'WAITING' : rework ? 'REWORK' : 'COMPLETED' },
    })
    if (autoRework) {
      await tx.taskWorkflow.update({
        where: { id: w.id },
        data: { reworkCount: { increment: 1 }, publicationId: null },
      })
      await tx.workflowStep.updateMany({
        where: { workflowId: w.id, ordinal: { gte: targetIndex } },
        data: { status: 'PENDING' },
      })
    }
    await event(
      tx,
      w,
      `step_finished:${attempt.id}`,
      waiting
        ? content
        : rework
          ? `核验返工：${content}`
          : `${step.name}完成；产物 ${relative}`,
      output.usage
    )
    await aggregateUsage(tx, w)
  })
  if (result.status === 'OK') await advanceWorkflow(w.taskId)
}

export const retryWorkflowStep = async ({
  taskId,
  version,
  note,
  sourceMode,
  target,
}: {
  taskId: string
  version: number
  note?: string
  sourceMode?: string
  target?: string
}) => {
  const w = await getWorkflow(taskId)
  if (!w || w.version !== version)
    throw new UserInputError('工作流版本已变化，请刷新')
  if (
    ![
      'FAILED',
      'BLOCKED',
      'NEEDS_INPUT',
      'REVIEW_FAILED',
      'WAITING_CONFIRMATION',
    ].includes(w.status)
  )
    throw new UserInputError('当前步骤不能重试或退回')
  if (w.publicationId) {
    const publication = await db.knowledgePublication.findUnique({
      where: { id: w.publicationId },
    })
    if (
      publication &&
      publication.status !== 'PREPARED' &&
      publication.status !== 'FAILED'
    )
      throw new UserInputError(
        '已有入库尝试，请先核对原入库记录，不能修改已确认内容'
      )
  }
  let index = target
    ? w.steps.findIndex((s) => s.key === target)
    : w.currentStep
  if (
    sourceMode &&
    sourceMode !== (w.input as unknown as ResearchInput).sourceMode
  )
    index = Math.min(index, 1)
  if (
    index > w.currentStep ||
    index > 3 ||
    index < 0 ||
    (target && !['research', 'draft'].includes(target))
  )
    throw new UserInputError(
      '只能重试当前 Agent 步骤，或退回资料收集、报告成稿'
    )
  const sourceChanged =
    sourceMode &&
    sourceMode !== (w.input as unknown as ResearchInput).sourceMode
  if ((target || sourceChanged || w.status === 'NEEDS_INPUT') && !note?.trim())
    throw new UserInputError('请填写补充资料、范围调整或退回原因')
  if (sourceMode && !['knowledge-web', 'knowledge', 'web'].includes(sourceMode))
    throw new UserInputError('来源范围无效')
  if ((note || '').length > 2000)
    throw new UserInputError('补充内容不能超过2000字符')
  await db.$transaction(async (tx) => {
    await setState(tx, w, 'RUNNING', note?.trim() || w.note, index)
    const last = w.steps[w.currentStep].attempts[0]
    if (
      last?.logPath &&
      last.finishedAt &&
      last.inputTokens == null &&
      last.outputTokens == null &&
      !alive(last.pid)
    ) {
      const parsed = parseTaskRunOutput({
        logPath: path.join(resolveRepoRoot(), last.logPath),
        tool: w.tool as AgentToolId,
      })
      if (parsed.usage) {
        await tx.workflowAttempt.update({
          where: { id: last.id },
          data: parsed.usage,
        })
        await event(
          tx,
          w,
          `usage_recovered:${last.id}`,
          '从已结束步骤的准确日志补齐实际用量。',
          parsed.usage
        )
        await aggregateUsage(tx, w)
      }
    }
    await tx.taskWorkflow.update({
      where: { id: w.id },
      data: {
        publicationId: null,
        ...(sourceMode
          ? { input: json({ ...(w.input as object), sourceMode }) }
          : {}),
      },
    })
    await tx.workflowStep.updateMany({
      where: { workflowId: w.id, ordinal: { gte: index } },
      data: { status: 'PENDING' },
    })
    await event(
      tx,
      w,
      'manual_retry',
      `人工调整或重试：${note || '从当前步骤继续'}`
    )
  })
  await advanceWorkflow(taskId)
  return db.task.findUniqueOrThrow({ where: { id: taskId } })
}

export const cancelWorkflow = async (taskId: string, version?: number) => {
  const w = await getWorkflow(taskId)
  if (!w) return null
  if (version != null && w.version !== version)
    throw new UserInputError('工作流版本已变化，请刷新')
  if (w.status === 'COMPLETED')
    throw new UserInputError('已完成的工作流不能取消')
  if (w.status === 'CANCELLED') return w.task
  await db.$transaction(async (tx) => {
    await setState(
      tx,
      w,
      'CANCELLED',
      '已取消后续派发；已发生的入库结果仍保留核对。'
    )
    await tx.workflowAttempt.updateMany({
      where: {
        step: { workflowId: w.id },
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    })
    await tx.workflowStep.updateMany({
      where: {
        workflowId: w.id,
        status: { in: ['PENDING', 'STARTING', 'RUNNING', 'WAITING'] },
      },
      data: { status: 'CANCELLED' },
    })
    await event(tx, w, 'cancelled', '工作流已取消，保留产物及入库记录。')
  })
  for (const step of w.steps)
    for (const a of step.attempts)
      if (['QUEUED', 'RUNNING'].includes(a.status)) stop(a.pid)
  return db.task.findUniqueOrThrow({ where: { id: taskId } })
}

/** 入库仅接受当前已核验产物；确认后以持久化 PUBLISHING 状态阻止返工。 */
export const assertWorkflowPublication = async (
  taskId: string,
  artifactId?: string | null,
  publicationId?: string
) => {
  const w = await getWorkflow(taskId)
  if (!w) return null
  const draft = w.steps[2]
  const artifact = draft.attempts.find(
    (a) => a.number === draft.attemptCount && a.status === 'COMPLETED'
  )
  const verified = w.steps[3].attempts.find(
    (a) => a.number === w.steps[3].attemptCount && a.status === 'COMPLETED'
  )
  if (w.status === 'CANCELLED') {
    if (publicationId && w.publicationId === publicationId) {
      const record = await db.knowledgePublication.findUnique({
        where: { id: publicationId },
      })
      if (record?.attemptedAt) return w
    }
    throw new UserInputError('工作流已取消，不能发起入库')
  }
  if (
    ![
      'WAITING_CONFIRMATION',
      'PUBLISHING',
      'PUBLICATION_FAILED',
      'COMPLETED',
    ].includes(w.status) ||
    !artifact ||
    !verified ||
    (verified.output as unknown as WorkflowOutput)?.verdict !== 'PASS' ||
    (artifactId && artifact.artifactId !== artifactId) ||
    (!artifactId && !publicationId)
  )
    throw new UserInputError('只能入库当前已通过核验的报告产物')
  const reportText = (artifact.output as unknown as WorkflowOutput).markdown
  const file = await db.taskArtifact.findUnique({
    where: { id: artifact.artifactId! },
  })
  if (file) {
    const relative = path.relative(
      realpathSync(resolveRepoRoot()),
      realpathSync(path.resolve(resolveRepoRoot(), file.path))
    )
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new UserInputError('报告文件不在任务仓库内')
  }
  if (
    !file ||
    workflowHash(
      readFileSync(path.join(resolveRepoRoot(), file.path), 'utf8')
    ) !== artifact.contentHash
  )
    throw new UserInputError('报告文件已变化，请退回成稿并重新核验')
  if (
    (verified.input as { upstream?: { draft?: { attemptId?: string } } })
      ?.upstream?.draft?.attemptId !== artifact.id
  )
    throw new UserInputError('核验对应的报告版本已失效')
  if (publicationId) {
    const record = await db.knowledgePublication.findUnique({
      where: { id: publicationId },
    })
    if (
      !record ||
      record.artifactId !== artifact.artifactId ||
      record.contentHash !==
        publicationHash(normalizePublicationMarkdown(reportText)) ||
      (w.publicationId && w.publicationId !== publicationId)
    )
      throw new UserInputError('报告或入库快照已变化，请重新预览')
    const stored = await db.taskArtifact.findUnique({
      where: { id: artifact.artifactId! },
    })
    if (!stored) throw new UserInputError('报告产物已删除')
  }
  return w
}

export const beginWorkflowPublication = async (
  taskId: string,
  publicationId: string,
  transaction?: Tx
) => {
  const w = await assertWorkflowPublication(taskId, null, publicationId)
  if (!w || ['CANCELLED', 'COMPLETED'].includes(w.status)) return
  const begin = async (tx: Tx) => {
    await setState(tx, w, 'PUBLISHING', '已确认报告及目标，正在入库与回读。', 5)
    await tx.taskWorkflow.update({
      where: { id: w.id },
      data: { publicationId },
    })
    await tx.workflowStep.updateMany({
      where: { workflowId: w.id, ordinal: 4 },
      data: { status: 'COMPLETED' },
    })
    const step = w.steps[5]
    await tx.workflowAttempt.updateMany({
      where: { stepId: step.id, status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'FAILED',
        error: '前次入库执行中断，沿用原快照继续核对。',
        finishedAt: new Date(),
      },
    })
    await tx.workflowAttempt.create({
      data: {
        stepId: step.id,
        number: step.attemptCount + 1,
        status: 'RUNNING',
        input: json({ publicationId }),
      },
    })
    await tx.workflowStep.update({
      where: { id: step.id },
      data: { status: 'RUNNING', attemptCount: { increment: 1 } },
    })
    await event(
      tx,
      w,
      'publication_confirmed',
      '人工确认具体报告快照、笔记本、目录及标题。'
    )
  }
  if (transaction) await begin(transaction)
  else await db.$transaction(begin)
}

export const syncWorkflowPublication = async (taskId: string) => {
  const w = await getWorkflow(taskId)
  if (
    !w?.publicationId ||
    !['PUBLISHING', 'PUBLICATION_FAILED'].includes(w.status)
  )
    return
  let p = await db.knowledgePublication.findUnique({
    where: { id: w.publicationId },
  })
  if (
    p?.status === 'PUBLISHING' &&
    Date.now() - p.updatedAt.getTime() > 120_000
  ) {
    const recovered = await db.knowledgePublication.updateMany({
      where: { id: p.id, status: 'PUBLISHING', updatedAt: p.updatedAt },
      data: {
        status: 'UNCERTAIN',
        error:
          '入库执行中断或核对超时，请沿用原快照重试核对；不会重复创建文档。',
      },
    })
    if (!recovered.count) return
    p = await db.knowledgePublication.findUnique({ where: { id: p.id } })
  }
  if (!p || !['VERIFIED', 'UNCERTAIN', 'FAILED'].includes(p.status)) return
  const success = p.status === 'VERIFIED'
  // 待核对状态不随每次巡检反复递增版本或追加相同事件。
  if (!success && w.status === 'PUBLICATION_FAILED') return
  await db.$transaction(async (tx) => {
    await setState(
      tx,
      w,
      success ? 'COMPLETED' : 'PUBLICATION_FAILED',
      success
        ? `已回读验证：siyuan://blocks/${p.documentId}`
        : p.error || '入库结果待核对',
      5
    )
    await tx.workflowStep.updateMany({
      where: { workflowId: w.id, ordinal: 5 },
      data: { status: success ? 'COMPLETED' : 'FAILED' },
    })
    await tx.workflowAttempt.updateMany({
      where: {
        stepId: w.steps[5].id,
        number: w.steps[5].attemptCount,
        status: 'RUNNING',
      },
      data: {
        status: success ? 'COMPLETED' : 'FAILED',
        finishedAt: new Date(),
        error: success ? null : p.error,
        output: json({
          publicationId: p.id,
          status: p.status,
          documentId: p.documentId,
          documentUrl: success ? `siyuan://blocks/${p.documentId}` : null,
        }),
      },
    })
    await event(
      tx,
      w,
      `publication_result:${p.status}`,
      success
        ? `回读一致，文档链接 siyuan://blocks/${p.documentId}`
        : p.error || '入库失败或结果不确定'
    )
  })
}

export const sweepWorkflows = async () => {
  const rows = await db.taskWorkflow.findMany({
    where: {
      status: { in: ['RUNNING', 'QUEUED', 'PUBLISHING', 'PUBLICATION_FAILED'] },
    },
    select: { taskId: true },
    take: 50,
    orderBy: { updatedAt: 'asc' },
  })
  for (const row of rows)
    try {
      await advanceWorkflow(row.taskId)
      await syncWorkflowPublication(row.taskId)
    } catch (error) {
      logger.warn({ error, taskId: row.taskId }, 'workflow sweep failed')
    }
}
