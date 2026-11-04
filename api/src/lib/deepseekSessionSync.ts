import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { publishTaskRun, type TaskRuntimePubSub } from 'src/lib/runtimeEvents'

import { loadCodexSessions } from './codexSessions'
import {
  loadDeepSeekSessions,
  type DeepSeekSessionSnapshot,
} from './deepseekSessions'

const SYNC_INTERVAL_MS = 20_000
const TOKEN_LIMIT = 2_147_483_647

let syncedAt = 0
let pending: Promise<void> | null = null

const bounded = (value: number | undefined) =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0 && value <= TOKEN_LIMIT
    ? value
    : undefined

const referenceFor = (snapshot: DeepSeekSessionSnapshot) =>
  snapshot.platform === 'codex'
    ? `codex-task:${snapshot.sessionId}`
    : `dsh-task:${snapshot.sessionId}`

const summaryFor = (snapshot: DeepSeekSessionSnapshot) => {
  const platform = snapshot.platform === 'codex' ? 'Codex' : 'DeepSeek Harness'
  return snapshot.cwdName ? `${platform} · ${snapshot.cwdName}` : platform
}

const sameInstant = (
  left: Date | null | undefined,
  right: Date | null | undefined
) => {
  if (left == null || right == null) return left == null && right == null
  return left.getTime() === right.getTime()
}

export const upsertDeepSeekSession = async (
  snapshot: DeepSeekSessionSnapshot,
  pubSub?: TaskRuntimePubSub
) => {
  const externalReference = referenceFor(snapshot)
  const createdKey = `${externalReference}:created`
  const usageKey = `${externalReference}:usage`
  const existingEvent = await db.taskEvent.findUnique({
    where: { idempotencyKey: createdKey },
    include: { taskRun: true },
  })
  const summary = summaryFor(snapshot)
  const completedAt =
    snapshot.status === 'COMPLETED' ? snapshot.updatedAt : null
  const taskRunData = {
    title: snapshot.title,
    status: snapshot.status,
    currentStage: snapshot.stage,
    summary,
    completedAt,
  }
  const tokens = {
    inputTokens: bounded(snapshot.inputTokens) ?? null,
    outputTokens: bounded(snapshot.outputTokens) ?? null,
    cachedTokens: bounded(snapshot.cachedTokens) ?? null,
    modelId: snapshot.modelId ?? null,
  }

  let taskRun
  let taskRunChanged = false
  if (!existingEvent) {
    taskRun = await db.taskRun.create({
      data: {
        ...taskRunData,
        platform: snapshot.platform,
        externalReference,
        primaryAgent: snapshot.primaryAgent,
        startedAt: snapshot.startedAt,
        events: {
          create: {
            sequence: 1,
            eventType: 'task.created',
            status: snapshot.status,
            stage: snapshot.stage,
            agent: snapshot.primaryAgent,
            skills: [],
            summary,
            idempotencyKey: createdKey,
          },
        },
      },
    })
    taskRunChanged = true
  } else {
    const current = existingEvent.taskRun
    // 只有快照字段真的变化时才 update；否则 @updatedAt 会被每 20 秒的同步
    // 刷新一次，导致 updatedAt 排序漂移和订阅风暴。
    taskRunChanged =
      current.title !== taskRunData.title ||
      current.status !== taskRunData.status ||
      current.currentStage !== taskRunData.currentStage ||
      current.summary !== taskRunData.summary ||
      !sameInstant(current.completedAt, taskRunData.completedAt)
    taskRun = taskRunChanged
      ? await db.taskRun.update({
          where: { id: current.id },
          data: taskRunData,
        })
      : current
  }

  const usage = await db.taskEvent.findUnique({
    where: { idempotencyKey: usageKey },
  })
  const usageData = {
    status: snapshot.status,
    stage: snapshot.stage,
    agent: snapshot.primaryAgent,
    summary: '已同步模型与 Token',
    ...tokens,
  }
  const hasTokenData =
    tokens.modelId !== null ||
    tokens.inputTokens !== null ||
    tokens.outputTokens !== null ||
    tokens.cachedTokens !== null
  let usageChanged = false
  if (usage) {
    usageChanged =
      usage.status !== usageData.status ||
      usage.stage !== usageData.stage ||
      usage.agent !== usageData.agent ||
      usage.summary !== usageData.summary ||
      usage.modelId !== usageData.modelId ||
      usage.inputTokens !== usageData.inputTokens ||
      usage.outputTokens !== usageData.outputTokens ||
      usage.cachedTokens !== usageData.cachedTokens
    if (usageChanged) {
      await db.taskEvent.update({ where: { id: usage.id }, data: usageData })
    }
  } else if (hasTokenData) {
    await db.taskEvent.create({
      data: {
        taskRunId: taskRun.id,
        sequence: 2,
        eventType: 'usage.synced',
        skills: [],
        idempotencyKey: usageKey,
        ...usageData,
      },
    })
    usageChanged = true
  }

  if (taskRunChanged || usageChanged) {
    await publishTaskRun(pubSub, taskRun)
  }
  return taskRun
}

export const syncDeepSeekSessions = async ({
  pubSub,
  force = false,
}: {
  pubSub?: TaskRuntimePubSub
  force?: boolean
} = {}) => {
  if (process.env.NODE_ENV === 'test' && !process.env.DEEPSEEK_SESSION_ROOT) return
  if (!force && pending) return pending
  if (!force && Date.now() - syncedAt < SYNC_INTERVAL_MS) return

  pending = (async () => {
    const snapshots = [
      ...(await loadDeepSeekSessions()),
      ...(await loadCodexSessions()),
    ]
    for (const snapshot of snapshots) {
      await upsertDeepSeekSession(snapshot, pubSub)
    }
    const keep = new Set(snapshots.map((snapshot) => referenceFor(snapshot)))
    const imported = await db.taskRun.findMany({
      where: {
        OR: [
          { externalReference: { startsWith: 'dsh-session:' } },
          { externalReference: { startsWith: 'dsh-task:' } },
          { externalReference: { startsWith: 'codex-thread:' } },
          { externalReference: { startsWith: 'codex-task:' } },
        ],
      },
      select: { id: true, externalReference: true },
    })
    const staleIds = imported
      .filter((run) => run.externalReference && !keep.has(run.externalReference))
      .map((run) => run.id)
    if (staleIds.length > 0) {
      await db.taskEvent.deleteMany({ where: { taskRunId: { in: staleIds } } })
      await db.taskRun.deleteMany({ where: { id: { in: staleIds } } })
    }
  })()
    .catch((error: unknown) => {
      logger.warn({ err: error }, 'DeepSeek Harness 会话同步失败')
    })
    .finally(() => {
      syncedAt = Date.now()
      pending = null
    })

  return pending
}
