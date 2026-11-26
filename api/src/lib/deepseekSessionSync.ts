import path from 'node:path'

import type { Prisma } from 'api/db/generated/prisma/client.mts'

import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { publishTaskRun, type TaskRuntimePubSub } from 'src/lib/runtimeEvents'

import { loadCodexSessions } from './codexSessions'
import {
  loadDeepSeekSessions,
  summarizeDeepSeekLines,
  type DeepSeekSessionSnapshot,
} from './deepseekSessions'
import { resolveRepoRoot } from './roleEvaluationDispatch'
import { findDshSessionFile, sessionIdFromLog } from './roleEvaluationSessions'
import { parseSessionReference } from './sessionTrace'
import { readZstdLines } from './zstdLines'

const SYNC_INTERVAL_MS = 20_000
const TOKEN_LIMIT = 2_147_483_647

let syncedAt = 0
let pending: Promise<void> | null = null

const bounded = (value: number | undefined) =>
  value !== undefined &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= TOKEN_LIMIT
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

const findDispatchedRun = async (
  transaction: Prisma.TransactionClient,
  snapshot: DeepSeekSessionSnapshot
) => {
  const [rawSessionId, turn] = snapshot.sessionId.split(':')
  if (turn && turn !== '1') return null
  const sessionId =
    snapshot.platform === 'deepseek-harness'
      ? rawSessionId.replace(/^session-/, '')
      : rawSessionId
  if (!sessionId) return null
  const sessionIds =
    snapshot.platform === 'deepseek-harness'
      ? [sessionId, `session-${sessionId}`]
      : [sessionId]
  const captured = await transaction.taskRun.findFirst({
    where: {
      platform: snapshot.platform,
      taskId: { not: null },
      OR: sessionIds.map((candidate) => ({
        externalReference: { startsWith: 'task:', endsWith: `:${candidate}` },
      })),
    },
    orderBy: { startedAt: 'desc' },
  })
  if (captured) return captured

  const uncaptured = await transaction.taskRun.findMany({
    where: {
      platform: snapshot.platform,
      taskId: { not: null },
      logPath: { not: null },
      externalReference: { startsWith: 'task:' },
    },
    orderBy: { startedAt: 'desc' },
  })
  return (
    uncaptured.find(
      (run) =>
        !parseSessionReference(run.externalReference).sessionId &&
        run.logPath &&
        sessionIds.includes(
          sessionIdFromLog(
            path.join(resolveRepoRoot(), run.logPath),
            snapshot.platform
          ) ?? ''
        )
    ) ?? null
  )
}

const syncSession = async (
  snapshot: DeepSeekSessionSnapshot,
  transaction: Prisma.TransactionClient
) => {
  // 工作流的所有岗位会话都归入已有顶层运行；由编排器统一记录状态和用量。
  if (transaction.workflowAttempt) {
    const session = snapshot.sessionId.split(':')[0].replace(/^session-/, '')
    const attempts = await transaction.workflowAttempt.findMany({
      where: {
        OR: [
          { sessionId: { in: [session, `session-${session}`] } },
          { sessionId: null, logPath: { not: null } },
        ],
      },
      include: { step: { include: { workflow: { include: { run: true } } } } },
      orderBy: { startedAt: 'desc' },
    })
    const managed = attempts.find(
      (a) =>
        a.sessionId?.replace(/^session-/, '') === session ||
        (a.logPath &&
          sessionIdFromLog(
            path.join(resolveRepoRoot(), a.logPath),
            snapshot.platform
          )?.replace(/^session-/, '') === session)
    )
    if (managed?.step.workflow.run) {
      const parent = managed.step.workflow.run
      const reference = referenceFor(snapshot)
      const mirror = await transaction.taskEvent.findUnique({
        where: { idempotencyKey: `${reference}:created` },
        include: { taskRun: true },
      })
      if (
        mirror &&
        mirror.taskRunId !== parent.id &&
        !mirror.taskRun.taskId &&
        mirror.taskRun.externalReference === reference
      ) {
        await transaction.$queryRaw`SELECT "id" FROM "TaskRun" WHERE "id" IN (${parent.id}::uuid, ${mirror.taskRunId}::uuid) ORDER BY "id" FOR UPDATE`
        const safeMirror = await transaction.taskRun.findFirst({
          where: {
            id: mirror.taskRunId,
            taskId: null,
            externalReference: reference,
            platform: snapshot.platform,
            logPath: null,
            pid: null,
            deliveredArtifacts: { none: {} },
            events: {
              every: {
                idempotencyKey: {
                  in: [`${reference}:created`, `${reference}:usage`],
                },
              },
            },
          },
        })
        if (safeMirror) {
          await transaction.taskEvent.deleteMany({
            where: {
              taskRunId: mirror.taskRunId,
              idempotencyKey: {
                in: [`${reference}:created`, `${reference}:usage`],
              },
            },
          })
          await transaction.taskRun.deleteMany({
            where: {
              id: mirror.taskRunId,
              taskId: null,
              externalReference: reference,
              events: { none: {} },
              deliveredArtifacts: { none: {} },
            },
          })
        }
      }
      return { taskRun: parent, changed: false }
    }
  }
  const externalReference = referenceFor(snapshot)
  const createdKey = `${externalReference}:created`
  const usageKey = `${externalReference}:usage`
  const existingEvent = await transaction.taskEvent.findUnique({
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

  const dispatched = await findDispatchedRun(transaction, snapshot)
  if (dispatched) {
    const mirror = existingEvent?.taskRun
    const mirrorId = mirror?.id ?? dispatched.id
    await transaction.$queryRaw`SELECT "id" FROM "TaskRun" WHERE "id" IN (${dispatched.id}::uuid, ${mirrorId}::uuid) ORDER BY "id" FOR UPDATE`
    const current = await transaction.taskRun.findUniqueOrThrow({
      where: { id: dispatched.id },
    })
    if (mirror && mirror.id !== dispatched.id) {
      const safeMirror = await transaction.taskRun.findFirst({
        where: {
          id: mirror.id,
          externalReference,
          platform: snapshot.platform,
          taskId: null,
          logPath: null,
          pid: null,
          deliveredArtifacts: { none: {} },
          events: { every: { idempotencyKey: { in: [createdKey, usageKey] } } },
        },
      })
      if (!safeMirror) return { taskRun: current, changed: false }
    }

    const latestEvent = await transaction.taskEvent.findFirst({
      where: { taskRunId: current.id },
      orderBy: { sequence: 'desc' },
    })
    if (current.status === 'QUEUED' && !latestEvent) {
      return { taskRun: current, changed: false }
    }
    const usage = await transaction.taskEvent.findUnique({
      where: { idempotencyKey: usageKey },
    })
    const usageData = {
      status: current.status,
      stage: current.currentStage,
      agent: current.primaryAgent,
      summary: '已同步模型与 Token',
      inputTokens: tokens.inputTokens ?? usage?.inputTokens ?? null,
      outputTokens: tokens.outputTokens ?? usage?.outputTokens ?? null,
      cachedTokens: tokens.cachedTokens ?? usage?.cachedTokens ?? null,
      modelId: tokens.modelId ?? usage?.modelId ?? null,
    }
    const hasTokens = Object.values(tokens).some((value) => value !== null)
    const moving = usage && usage.taskRunId !== dispatched.id
    let changed = false
    if (hasTokens || usage) {
      const destination = {
        taskRunId: dispatched.id,
        sequence: (latestEvent?.sequence ?? 0) + 1,
      }
      if (!usage) {
        await transaction.taskEvent.create({
          data: {
            ...destination,
            eventType: 'usage.synced',
            skills: [],
            idempotencyKey: usageKey,
            ...usageData,
          },
        })
        changed = true
      } else if (
        moving ||
        Object.entries(usageData).some(([key, value]) => usage[key] !== value)
      ) {
        await transaction.taskEvent.update({
          where: { id: usage.id },
          data: { ...(moving ? destination : {}), ...usageData },
        })
        changed = true
      }
    }
    if (mirror && mirror.id !== dispatched.id) {
      await transaction.taskEvent.deleteMany({
        where: { taskRunId: mirror.id, idempotencyKey: createdKey },
      })
      await transaction.taskRun.deleteMany({
        where: {
          id: mirror.id,
          taskId: null,
          events: { none: {} },
          deliveredArtifacts: { none: {} },
        },
      })
      changed = true
    }
    return { taskRun: current, changed }
  }

  let taskRun
  let taskRunChanged = false
  if (!existingEvent) {
    taskRun = await transaction.taskRun.create({
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
      ? await transaction.taskRun.update({
          where: { id: current.id },
          data: taskRunData,
        })
      : current
  }

  const usage = await transaction.taskEvent.findUnique({
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
      await transaction.taskEvent.update({
        where: { id: usage.id },
        data: usageData,
      })
    }
  } else if (hasTokenData) {
    await transaction.taskEvent.create({
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

  return { taskRun, changed: taskRunChanged || usageChanged }
}

export const upsertDeepSeekSession = async (
  snapshot: DeepSeekSessionSnapshot,
  pubSub?: TaskRuntimePubSub
) => {
  const result = await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${referenceFor(snapshot)}))::text`
    return syncSession(snapshot, transaction)
  })
  if (result.changed) await publishTaskRun(pubSub, result.taskRun)
  return result.taskRun
}

/** 按运行记录的 externalReference 找回它对应的会话快照（找不到说明会话已被清理） */
export const findSessionSnapshot = async (reference: string) => {
  if (!reference) return null

  // dsh 会话能按 sessionId 直接定位文件，只读这一份，避免全量扫描上百个会话
  const parsed = parseSessionReference(reference)
  if (parsed.platform === 'dsh' && parsed.sessionId) {
    const filePath = await findDshSessionFile(parsed.sessionId)
    if (!filePath) return null
    const lines: string[] = []
    try {
      for await (const line of readZstdLines(filePath)) lines.push(line)
    } catch {
      return null
    }
    return (
      summarizeDeepSeekLines(lines, parsed.sessionId).find(
        (snapshot) => referenceFor(snapshot) === reference
      ) ?? null
    )
  }

  const snapshots = [
    ...(await loadDeepSeekSessions()),
    ...(await loadCodexSessions()),
  ]
  return (
    snapshots.find((snapshot) => referenceFor(snapshot) === reference) ?? null
  )
}

export const syncDeepSeekSessions = async ({
  pubSub,
  force = false,
}: {
  pubSub?: TaskRuntimePubSub
  force?: boolean
} = {}) => {
  if (process.env.NODE_ENV === 'test' && !process.env.DEEPSEEK_SESSION_ROOT)
    return
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
      .filter(
        (run) => run.externalReference && !keep.has(run.externalReference)
      )
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
