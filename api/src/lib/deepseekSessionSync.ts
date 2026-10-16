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
  const tokens = {
    inputTokens: bounded(snapshot.inputTokens),
    outputTokens: bounded(snapshot.outputTokens),
    cachedTokens: bounded(snapshot.cachedTokens),
    modelId: snapshot.modelId,
  }

  const taskRun = existingEvent
    ? await db.taskRun.update({
        where: { id: existingEvent.taskRunId },
        data: {
          title: snapshot.title,
          status: snapshot.status,
          currentStage: snapshot.stage,
          summary,
          completedAt: snapshot.status === 'COMPLETED' ? snapshot.updatedAt : null,
        },
      })
    : await db.taskRun.create({
        data: {
          title: snapshot.title,
          platform: snapshot.platform,
          externalReference,
          primaryAgent: snapshot.primaryAgent,
          status: snapshot.status,
          currentStage: snapshot.stage,
          summary,
          startedAt: snapshot.startedAt,
          completedAt: snapshot.status === 'COMPLETED' ? snapshot.updatedAt : null,
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

  const usage = await db.taskEvent.findUnique({ where: { idempotencyKey: usageKey } })
  const usageData = {
    status: snapshot.status,
    stage: snapshot.stage,
    agent: snapshot.primaryAgent,
    summary: '已同步模型与 Token',
    ...tokens,
  }
  if (usage) {
    await db.taskEvent.update({ where: { id: usage.id }, data: usageData })
  } else if (
    tokens.modelId ||
    tokens.inputTokens !== undefined ||
    tokens.outputTokens !== undefined ||
    tokens.cachedTokens !== undefined
  ) {
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
  }

  await publishTaskRun(pubSub, taskRun)
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
