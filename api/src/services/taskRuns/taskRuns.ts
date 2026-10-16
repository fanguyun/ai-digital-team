import type { Prisma } from 'api/db/generated/prisma/client.mts'
import type {
  AppendTaskEventInput,
  CreateTaskRunInput,
  TaskRunFilter,
} from 'types/graphql'
import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'
import { syncDeepSeekSessions } from 'src/lib/deepseekSessionSync'
import { publishTaskRun, type TaskRuntimePubSub } from 'src/lib/runtimeEvents'
import {
  isTerminalStatus,
  normalizeCreateTaskRunInput,
  normalizeTaskEventInput,
  TaskRuntimeValidationError,
  type TaskRunStageValue,
  type TaskRunStatusValue,
} from 'src/lib/taskState'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

type ServiceContext = {
  context?: {
    pubSub?: TaskRuntimePubSub
  }
}

type TaskRunCursor = {
  updatedAt: string
  id: string
}

const encodeCursor = (cursor: TaskRunCursor) =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url')

const decodeCursor = (cursor: string): TaskRunCursor => {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as TaskRunCursor
    if (
      !parsed.updatedAt ||
      !parsed.id ||
      Number.isNaN(Date.parse(parsed.updatedAt))
    ) {
      throw new Error('invalid cursor')
    }
    return parsed
  } catch {
    throw new UserInputError('Invalid task run cursor')
  }
}

const normalizeFilterText = (value?: string | null) => {
  const normalized = value?.trim()
  return normalized || undefined
}

const isUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'P2002'

const asUserInput = <T>(operation: () => T) => {
  try {
    return operation()
  } catch (error) {
    if (error instanceof TaskRuntimeValidationError) {
      throw new UserInputError(error.message)
    }
    throw error
  }
}

export const taskRuns = async (
  {
    filter,
    after,
    first = DEFAULT_PAGE_SIZE,
  }: {
    filter?: TaskRunFilter | null
    after?: string | null
    first?: number | null
  },
  { context }: ServiceContext = {}
) => {
  await syncDeepSeekSessions({ pubSub: context?.pubSub })
  const pageSize = Math.min(
    Math.max(first ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  )
  const cursor = after ? decodeCursor(after) : undefined
  const platform = normalizeFilterText(filter?.platform)
  const primaryAgent = normalizeFilterText(filter?.primaryAgent)

  const where: Prisma.TaskRunWhereInput = {
    ...(filter?.statuses?.length
      ? { status: { in: filter.statuses as TaskRunStatusValue[] } }
      : {}),
    ...(platform ? { platform } : {}),
    ...(primaryAgent ? { primaryAgent } : {}),
    ...(cursor
      ? {
          OR: [
            { updatedAt: { lt: new Date(cursor.updatedAt) } },
            {
              updatedAt: new Date(cursor.updatedAt),
              id: { lt: cursor.id },
            },
          ],
        }
      : {}),
  }

  const rows = await db.taskRun.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
  })
  const hasNextPage = rows.length > pageSize
  const nodes = hasNextPage ? rows.slice(0, pageSize) : rows
  const lastNode = nodes.at(-1)

  return {
    edges: nodes.map((node) => ({
      cursor: encodeCursor({
        updatedAt: node.updatedAt.toISOString(),
        id: node.id,
      }),
      node,
    })),
    pageInfo: {
      hasNextPage,
      endCursor: lastNode
        ? encodeCursor({
            updatedAt: lastNode.updatedAt.toISOString(),
            id: lastNode.id,
          })
        : null,
    },
  }
}

export const taskRun = ({ id }: { id: string }) =>
  db.taskRun.findUnique({
    where: { id },
    include: { events: { orderBy: { sequence: 'asc' } } },
  })

export const runtimeHealth = async (
  _args: unknown,
  { context }: ServiceContext
) => {
  let database = { status: 'UP', message: null as string | null }
  try {
    await db.$queryRaw`SELECT 1`
  } catch (error) {
    database = {
      status: 'DOWN',
      message: error instanceof Error ? error.message : 'Database unavailable',
    }
  }

  return {
    database,
    realtime: {
      status: context?.pubSub ? 'UP' : 'DOWN',
      message: context?.pubSub ? null : 'Realtime PubSub is unavailable',
    },
    serverTime: new Date(),
  }
}

const overviewTimeBound = (range?: {
  from?: Date | string | null
  to?: Date | string | null
}) => {
  if (!range?.from && !range?.to) return undefined
  const from = range.from ? new Date(range.from) : undefined
  const to = range.to ? new Date(range.to) : undefined
  if (
    (from && Number.isNaN(from.getTime())) ||
    (to && Number.isNaN(to.getTime()))
  ) {
    throw new UserInputError('时间范围无效')
  }
  if (from && to && from >= to) {
    throw new UserInputError('开始时间必须早于结束时间')
  }
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lt: to } : {}),
  }
}

export const teamRuntimeOverview = async (
  {
    range,
  }: {
    range?: { from?: Date | string | null; to?: Date | string | null }
  } = {},
  { context }: ServiceContext = {}
) => {
  await syncDeepSeekSessions({ pubSub: context?.pubSub })
  const occurredAt = overviewTimeBound(range)
  const [taskGroups, totalTaskCount, events] = await Promise.all([
    db.taskRun.groupBy({
      by: ['primaryAgent'],
      where: {
        status: { not: 'CANCELLED' },
        ...(occurredAt ? { startedAt: occurredAt } : {}),
      },
      _count: { _all: true },
      _min: { startedAt: true },
      _max: { updatedAt: true },
    }),
    db.taskRun.count({
      where: occurredAt ? { startedAt: occurredAt } : undefined,
    }),
    db.taskEvent.findMany({
      where: occurredAt ? { createdAt: occurredAt } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        agent: true,
        taskRunId: true,
        inputTokens: true,
        outputTokens: true,
        cachedTokens: true,
        modelId: true,
      },
    }),
  ])

  const metrics = new Map<
    string,
    {
      agent: string
      workCount: number
      taskIds: Set<string>
      trackedTaskIds: Set<string>
      inputTrackedTaskIds: Set<string>
      outputTrackedTaskIds: Set<string>
      cachedTrackedTaskIds: Set<string>
      inputTokens: number
      outputTokens: number
      cachedTokens: number
      latestModelId: string | null
      firstTaskAt: Date | null
      lastTaskAt: Date | null
    }
  >()
  const metricFor = (agent: string) => {
    const existing = metrics.get(agent)
    if (existing) return existing
    const created = {
      agent,
      workCount: 0,
      taskIds: new Set<string>(),
      trackedTaskIds: new Set<string>(),
      inputTrackedTaskIds: new Set<string>(),
      outputTrackedTaskIds: new Set<string>(),
      cachedTrackedTaskIds: new Set<string>(),
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      latestModelId: null,
      firstTaskAt: null,
      lastTaskAt: null,
    }
    metrics.set(agent, created)
    return created
  }

  const coverageFor = ({
    knownTaskCount,
    completeTaskCount = knownTaskCount,
    totalTaskCount,
  }: {
    knownTaskCount: number
    completeTaskCount?: number
    totalTaskCount: number
  }) => {
    if (knownTaskCount === 0) return 'NONE'
    if (totalTaskCount === 0 || completeTaskCount < totalTaskCount) {
      return 'PARTIAL'
    }
    return 'COMPLETE'
  }

  for (const group of taskGroups) {
    const metric = metricFor(group.primaryAgent)
    metric.workCount = group._count._all
    metric.firstTaskAt = group._min.startedAt
    metric.lastTaskAt = group._max.updatedAt
  }
  for (const event of events) {
    const metric = metricFor(event.agent)
    metric.taskIds.add(event.taskRunId)
    if (event.inputTokens != null) {
      metric.inputTrackedTaskIds.add(event.taskRunId)
      metric.trackedTaskIds.add(event.taskRunId)
    }
    if (event.outputTokens != null) {
      metric.outputTrackedTaskIds.add(event.taskRunId)
      metric.trackedTaskIds.add(event.taskRunId)
    }
    if (event.cachedTokens != null) {
      metric.cachedTrackedTaskIds.add(event.taskRunId)
      metric.trackedTaskIds.add(event.taskRunId)
    }
    metric.inputTokens += event.inputTokens ?? 0
    metric.outputTokens += event.outputTokens ?? 0
    metric.cachedTokens += event.cachedTokens ?? 0
    if (!metric.latestModelId && event.modelId) {
      metric.latestModelId = event.modelId
    }
  }

  const agents = [...metrics.values()]
    .map((metric) => {
      const totalKnownTaskIds = new Set([
        ...metric.inputTrackedTaskIds,
        ...metric.outputTrackedTaskIds,
      ])
      const completeTotalTaskCount = [...metric.inputTrackedTaskIds].filter(
        (taskRunId) => metric.outputTrackedTaskIds.has(taskRunId)
      ).length

      return {
        agent: metric.agent,
        workCount: metric.workCount,
        trackedWorkCount: metric.trackedTaskIds.size,
        inputTokens: metric.inputTokens,
        outputTokens: metric.outputTokens,
        cachedTokens: metric.cachedTokens,
        totalTokens: metric.inputTokens + metric.outputTokens,
        inputTokenCoverage: coverageFor({
          knownTaskCount: metric.inputTrackedTaskIds.size,
          totalTaskCount: metric.taskIds.size,
        }),
        outputTokenCoverage: coverageFor({
          knownTaskCount: metric.outputTrackedTaskIds.size,
          totalTaskCount: metric.taskIds.size,
        }),
        cachedTokenCoverage: coverageFor({
          knownTaskCount: metric.cachedTrackedTaskIds.size,
          totalTaskCount: metric.taskIds.size,
        }),
        totalTokenCoverage: coverageFor({
          knownTaskCount: totalKnownTaskIds.size,
          completeTaskCount: completeTotalTaskCount,
          totalTaskCount: metric.taskIds.size,
        }),
        latestModelId: metric.latestModelId,
        firstTaskAt: metric.firstTaskAt,
        lastTaskAt: metric.lastTaskAt,
      }
    })
    .sort((left, right) => right.workCount - left.workCount)

  const totals = agents.reduce(
    (overview, metric) => ({
      totalWorkCount: overview.totalWorkCount + metric.workCount,
      inputTokens: overview.inputTokens + metric.inputTokens,
      outputTokens: overview.outputTokens + metric.outputTokens,
      cachedTokens: overview.cachedTokens + metric.cachedTokens,
      totalTokens: overview.totalTokens + metric.totalTokens,
    }),
    {
      totalWorkCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
    }
  )
  const trackedTaskIds = new Set<string>()
  const inputTrackedTaskIds = new Set<string>()
  const outputTrackedTaskIds = new Set<string>()
  const cachedTrackedTaskIds = new Set<string>()
  for (const event of events) {
    if (event.inputTokens != null) {
      trackedTaskIds.add(event.taskRunId)
      inputTrackedTaskIds.add(event.taskRunId)
    }
    if (event.outputTokens != null) {
      trackedTaskIds.add(event.taskRunId)
      outputTrackedTaskIds.add(event.taskRunId)
    }
    if (event.cachedTokens != null) {
      trackedTaskIds.add(event.taskRunId)
      cachedTrackedTaskIds.add(event.taskRunId)
    }
  }
  const totalKnownTaskIds = new Set([
    ...inputTrackedTaskIds,
    ...outputTrackedTaskIds,
  ])
  const completeTotalTaskCount = [...inputTrackedTaskIds].filter((taskRunId) =>
    outputTrackedTaskIds.has(taskRunId)
  ).length

  return {
    ...totals,
    totalTaskCount,
    trackedWorkCount: trackedTaskIds.size,
    inputTokenCoverage: coverageFor({
      knownTaskCount: inputTrackedTaskIds.size,
      totalTaskCount,
    }),
    outputTokenCoverage: coverageFor({
      knownTaskCount: outputTrackedTaskIds.size,
      totalTaskCount,
    }),
    cachedTokenCoverage: coverageFor({
      knownTaskCount: cachedTrackedTaskIds.size,
      totalTaskCount,
    }),
    totalTokenCoverage: coverageFor({
      knownTaskCount: totalKnownTaskIds.size,
      completeTaskCount: completeTotalTaskCount,
      totalTaskCount,
    }),
    agents,
  }
}

export const teamWeeklyReport = async (
  {
    range,
  }: {
    range: { from?: Date | string | null; to?: Date | string | null }
  },
  serviceContext: ServiceContext = {}
) => {
  const occurredAt = overviewTimeBound(range)
  if (!occurredAt?.gte || !occurredAt.lt) {
    throw new UserInputError('总结需要完整的开始和结束时间')
  }

  const overview = await teamRuntimeOverview({ range }, serviceContext)
  const [periodTasks, pendingTasks] = await Promise.all([
    db.taskRun.findMany({
      where: {
        OR: [{ startedAt: occurredAt }, { completedAt: occurredAt }],
      },
      include: { events: { orderBy: { sequence: 'desc' }, take: 1 } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }),
    db.taskRun.findMany({
      where: {
        status: { in: ['QUEUED', 'RUNNING', 'WAITING_CONFIRMATION'] },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 12,
    }),
  ])

  const completed = periodTasks.filter(
    (task) => task.status === 'COMPLETED' && task.completedAt
  )
  const failed = periodTasks.filter(
    (task) => task.status === 'FAILED' && task.completedAt
  )
  const cancelled = periodTasks.filter(
    (task) => task.status === 'CANCELLED' && task.completedAt
  )
  const contributions = overview.agents
    .filter(
      (agent) => agent.workCount > 0 || agent.totalTokenCoverage !== 'NONE'
    )
    .map((agent) => ({
      agent: agent.agent,
      workCount: agent.workCount,
      trackedWorkCount: agent.trackedWorkCount,
      totalTokens: agent.totalTokens,
      tokenCoverage: agent.totalTokenCoverage,
    }))
    .sort(
      (left, right) =>
        right.workCount - left.workCount || right.totalTokens - left.totalTokens
    )

  const headline =
    periodTasks.length === 0
      ? '当前统计周期还没有数字团队任务记录。'
      : `当前统计周期记录 ${periodTasks.length} 个任务，完成 ${completed.length} 个，失败 ${failed.length} 个，当前仍有 ${pendingTasks.length} 个事项待推进。`

  return {
    from: occurredAt.gte,
    to: occurredAt.lt,
    generatedAt: new Date(),
    totalTasks: periodTasks.length,
    completedTasks: completed.length,
    failedTasks: failed.length,
    cancelledTasks: cancelled.length,
    pendingTasks: pendingTasks.length,
    inputTokens: overview.inputTokens,
    outputTokens: overview.outputTokens,
    cachedTokens: overview.cachedTokens,
    totalTokens: overview.totalTokens,
    totalTokenCoverage: overview.totalTokenCoverage,
    headline,
    contributions,
    completed: completed.slice(0, 12),
    failures: failed.slice(0, 8).map((task) => ({
      ...task,
      summary: task.events[0]?.summary || task.summary,
    })),
    pending: pendingTasks,
  }
}

export const createTaskRun = async (
  { input }: { input: CreateTaskRunInput },
  { context }: ServiceContext
) => {
  const normalized = asUserInput(() =>
    normalizeCreateTaskRunInput({
      ...input,
      status: input.status as TaskRunStatusValue | null | undefined,
      stage: input.stage as TaskRunStageValue | null | undefined,
      evidence: input.evidence as Record<string, unknown> | null | undefined,
    })
  )
  const existing = await db.taskEvent.findUnique({
    where: { idempotencyKey: normalized.idempotencyKey },
    include: { taskRun: true },
  })
  if (existing) return existing.taskRun

  try {
    const result = await db.$transaction(async (tx) => {
      const createdTaskRun = await tx.taskRun.create({
        data: {
          title: normalized.title,
          platform: normalized.platform,
          externalReference: normalized.externalReference,
          primaryAgent: normalized.primaryAgent,
          status: normalized.status,
          currentStage: normalized.stage,
          summary: normalized.summary,
        },
      })
      await tx.taskEvent.create({
        data: {
          taskRunId: createdTaskRun.id,
          sequence: 1,
          eventType: 'task.created',
          status: normalized.status,
          stage: normalized.stage,
          agent: normalized.primaryAgent,
          skills: normalized.skills,
          summary: normalized.summary ?? `Task created: ${normalized.title}`,
          evidence: normalized.evidence as Prisma.InputJsonValue | undefined,
          inputTokens: normalized.inputTokens,
          outputTokens: normalized.outputTokens,
          cachedTokens: normalized.cachedTokens,
          modelId: normalized.modelId,
          idempotencyKey: normalized.idempotencyKey,
        },
      })
      return createdTaskRun
    })

    await publishTaskRun(context?.pubSub, result)
    return result
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await db.taskEvent.findUnique({
        where: { idempotencyKey: normalized.idempotencyKey },
        include: { taskRun: true },
      })
      if (duplicate) return duplicate.taskRun
    }
    throw error
  }
}

export const appendTaskEvent = async (
  { taskRunId, input }: { taskRunId: string; input: AppendTaskEventInput },
  { context }: ServiceContext
) => {
  const duplicate = await db.taskEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey.trim() },
    include: { taskRun: true },
  })
  if (duplicate) {
    if (duplicate.taskRunId !== taskRunId) {
      throw new UserInputError('Idempotency key belongs to another task run')
    }
    return { taskRun: duplicate.taskRun, event: duplicate, duplicate: true }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TaskRun" WHERE "id" = ${taskRunId}::uuid FOR UPDATE`

      const lockedDuplicate = await tx.taskEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey.trim() },
        include: { taskRun: true },
      })
      if (lockedDuplicate) {
        if (lockedDuplicate.taskRunId !== taskRunId) {
          throw new UserInputError(
            'Idempotency key belongs to another task run'
          )
        }
        return {
          taskRun: lockedDuplicate.taskRun,
          event: lockedDuplicate,
          duplicate: true,
        }
      }

      const current = await tx.taskRun.findUnique({
        where: { id: taskRunId },
        include: { _count: { select: { events: true } } },
      })
      if (!current) throw new UserInputError('Task run not found')

      const normalized = asUserInput(() =>
        normalizeTaskEventInput(
          {
            status: current.status as TaskRunStatusValue,
            currentStage: current.currentStage as TaskRunStageValue,
          },
          {
            ...input,
            status: input.status as TaskRunStatusValue | null | undefined,
            stage: input.stage as TaskRunStageValue,
            evidence: input.evidence as
              | Record<string, unknown>
              | null
              | undefined,
          }
        )
      )
      const completedAt = isTerminalStatus(normalized.status)
        ? new Date()
        : null

      const event = await tx.taskEvent.create({
        data: {
          taskRunId,
          sequence: current._count.events + 1,
          eventType: normalized.eventType,
          status: normalized.eventStatus,
          stage: normalized.stage,
          agent: normalized.agent,
          skills: normalized.skills,
          summary: normalized.summary,
          evidence: normalized.evidence as Prisma.InputJsonValue | undefined,
          inputTokens: normalized.inputTokens,
          outputTokens: normalized.outputTokens,
          cachedTokens: normalized.cachedTokens,
          modelId: normalized.modelId,
          idempotencyKey: normalized.idempotencyKey,
        },
      })
      const updatedTaskRun = await tx.taskRun.update({
        where: { id: taskRunId },
        data: {
          status: normalized.status,
          currentStage: normalized.stage,
          summary: normalized.summary,
          completedAt,
          version: { increment: 1 },
        },
      })
      return { taskRun: updatedTaskRun, event, duplicate: false }
    })

    if (!result.duplicate) {
      await publishTaskRun(context?.pubSub, result.taskRun)
    }
    return result
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const concurrentDuplicate = await db.taskEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey.trim() },
        include: { taskRun: true },
      })
      if (concurrentDuplicate) {
        if (concurrentDuplicate.taskRunId !== taskRunId) {
          throw new UserInputError(
            'Idempotency key belongs to another task run'
          )
        }
        return {
          taskRun: concurrentDuplicate.taskRun,
          event: concurrentDuplicate,
          duplicate: true,
        }
      }
    }
    throw error
  }
}

export const TaskRun = {
  events: (_obj: unknown, { root }: { root: { id: string } }) =>
    db.taskEvent.findMany({
      where: { taskRunId: root.id },
      orderBy: { sequence: 'asc' },
    }),
}
