import { db } from 'src/lib/db'

import {
  appendTaskEvent,
  createTaskRun,
  taskRun,
  taskRuns,
  teamRuntimeOverview,
} from './taskRuns'

const publish = jest.fn().mockResolvedValue(undefined)

const context = {
  context: {
    pubSub: {
      publish,
    },
  },
} as never

const createInput = (suffix: string) => ({
  title: `Task ${suffix}`,
  platform: 'codex',
  primaryAgent: 'software-engineer-agent',
  status: 'RUNNING' as const,
  stage: 'EXECUTION' as const,
  summary: `Started ${suffix}`,
  skills: ['base-guidelines'],
  evidence: { path: `/tmp/${suffix}.json` },
  idempotencyKey: `create-${suffix}`,
})

describe('taskRuns service', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
  })

  it('creates a task and its first event atomically', async () => {
    const created = await createTaskRun(
      { input: createInput('atomic') },
      context
    )
    const stored = await taskRun({ id: created.id })

    expect(stored).toMatchObject({
      status: 'RUNNING',
      currentStage: 'EXECUTION',
      version: 1,
    })
    expect(stored?.events).toHaveLength(1)
    expect(stored?.events[0]).toMatchObject({
      sequence: 1,
      eventType: 'task.created',
      idempotencyKey: 'create-atomic',
    })
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('returns the original task when create is retried', async () => {
    const first = await createTaskRun({ input: createInput('retry') }, context)
    const second = await createTaskRun({ input: createInput('retry') }, context)

    expect(second.id).toBe(first.id)
    expect(await db.taskRun.count()).toBe(1)
    expect(await db.taskEvent.count()).toBe(1)
  })

  it('updates the snapshot and appends one event per idempotency key', async () => {
    const created = await createTaskRun(
      { input: createInput('append') },
      context
    )
    const input = {
      eventType: 'task.waiting_confirmation',
      status: 'WAITING_CONFIRMATION' as const,
      stage: 'VERIFICATION' as const,
      agent: 'qa-security-engineer-agent',
      skills: ['project-security-scan'],
      summary: '等待用户确认完整构建',
      evidence: { path: 'reports/qa.json' },
      idempotencyKey: 'append-waiting',
    }

    const first = await appendTaskEvent(
      { taskRunId: created.id, input },
      context
    )
    const retry = await appendTaskEvent(
      { taskRunId: created.id, input },
      context
    )

    expect(first).toMatchObject({ duplicate: false })
    expect(first.taskRun).toMatchObject({
      status: 'WAITING_CONFIRMATION',
      currentStage: 'VERIFICATION',
      version: 2,
    })
    expect(retry).toMatchObject({ duplicate: true })
    expect(await db.taskEvent.count()).toBe(2)
  })

  it('rolls back an invalid transition without changing the snapshot', async () => {
    const created = await createTaskRun(
      { input: createInput('rollback') },
      context
    )

    await expect(
      appendTaskEvent(
        {
          taskRunId: created.id,
          input: {
            eventType: 'planning.reopened',
            status: 'RUNNING',
            stage: 'PLANNING',
            agent: 'product-solution-agent',
            summary: '非法回退',
            idempotencyKey: 'rollback-invalid',
          },
        },
        context
      )
    ).rejects.toThrow('Task stage cannot move backwards')

    const stored = await taskRun({ id: created.id })
    expect(stored).toMatchObject({
      status: 'RUNNING',
      currentStage: 'EXECUTION',
      version: 1,
    })
    expect(stored?.events).toHaveLength(1)
  })

  it('filters and paginates task runs with stable cursors', async () => {
    await createTaskRun({ input: createInput('one') }, context)
    await createTaskRun(
      {
        input: {
          ...createInput('two'),
          platform: 'deepseek-harness',
          primaryAgent: 'automation-tools-agent',
        },
      },
      context
    )
    await createTaskRun({ input: createInput('three') }, context)

    const filtered = await taskRuns({
      filter: { platform: 'deepseek-harness' },
      first: 10,
    })
    expect(filtered.edges).toHaveLength(1)
    expect(filtered.edges[0].node.primaryAgent).toBe('automation-tools-agent')

    const firstPage = await taskRuns({ first: 2 })
    const secondPage = await taskRuns({
      first: 2,
      after: firstPage.pageInfo.endCursor,
    })
    expect(firstPage.pageInfo.hasNextPage).toBe(true)
    expect(secondPage.edges).toHaveLength(1)
    expect(
      new Set([
        ...firstPage.edges.map(({ node }) => node.id),
        ...secondPage.edges.map(({ node }) => node.id),
      ]).size
    ).toBe(3)
  })

  it('returns 20 task runs by default', async () => {
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        createTaskRun({ input: createInput(`default-page-${index}`) }, context)
      )
    )

    const page = await taskRuns({})

    expect(page.edges).toHaveLength(20)
    expect(page.pageInfo.hasNextPage).toBe(true)
  })

  it('supports skip-based pagination with a stable totalCount', async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createTaskRun({ input: createInput(`offset-page-${index}`) }, context)
      )
    )

    const firstPage = await taskRuns({ first: 2, skip: 0 })
    const secondPage = await taskRuns({ first: 2, skip: 2 })
    const lastPage = await taskRuns({ first: 2, skip: 4 })

    expect(firstPage.totalCount).toBe(5)
    expect(secondPage.totalCount).toBe(5)
    expect(lastPage.totalCount).toBe(5)
    expect(firstPage.edges).toHaveLength(2)
    expect(secondPage.edges).toHaveLength(2)
    expect(lastPage.edges).toHaveLength(1)
    expect(firstPage.pageInfo.hasNextPage).toBe(true)
    expect(secondPage.pageInfo.hasNextPage).toBe(true)
    expect(lastPage.pageInfo.hasNextPage).toBe(false)
    expect(
      new Set([
        ...firstPage.edges.map(({ node }) => node.id),
        ...secondPage.edges.map(({ node }) => node.id),
        ...lastPage.edges.map(({ node }) => node.id),
      ]).size
    ).toBe(5)

    // after 与 skip 同时传时以 after 为准，且游标页与 skip 页等价。
    const cursorPage = await taskRuns({
      first: 2,
      after: firstPage.pageInfo.endCursor,
      skip: 100,
    })
    expect(cursorPage.edges.map(({ node }) => node.id)).toEqual(
      secondPage.edges.map(({ node }) => node.id)
    )
  })

  it('searches title, summary, primaryAgent and platform case-insensitively', async () => {
    await createTaskRun(
      { input: { ...createInput('search-title'), title: 'Alpha LOGIN page' } },
      context
    )
    await createTaskRun(
      {
        input: {
          ...createInput('search-summary'),
          title: 'Beta',
          summary: '关于 login 的说明',
        },
      },
      context
    )
    await createTaskRun(
      {
        input: {
          ...createInput('search-agent'),
          title: 'Gamma',
          summary: 'plain',
          primaryAgent: 'design-engineer-agent',
        },
      },
      context
    )
    await createTaskRun(
      {
        input: {
          ...createInput('search-platform'),
          title: 'Delta',
          summary: 'plain',
          platform: 'deepseek-harness',
        },
      },
      context
    )

    const login = await taskRuns({ filter: { search: 'login' } })
    expect(login.totalCount).toBe(2)
    expect(login.edges.map(({ node }) => node.title).sort()).toEqual([
      'Alpha LOGIN page',
      'Beta',
    ])
    expect(
      login.statusCounts.find((entry) => entry.status === 'RUNNING')?.count
    ).toBe(2)

    const byAgent = await taskRuns({ filter: { search: 'DESIGN-ENGINEER' } })
    expect(byAgent.totalCount).toBe(1)

    const byPlatform = await taskRuns({
      filter: { search: 'deepseek-harness' },
    })
    expect(byPlatform.totalCount).toBe(1)
    expect(byPlatform.edges[0].node.title).toBe('Delta')

    const combined = await taskRuns({
      filter: { search: 'login', platform: 'missing-platform' },
    })
    expect(combined.totalCount).toBe(0)
    expect(combined.edges).toHaveLength(0)
  })

  it('returns global statusCounts for all six statuses regardless of statuses filter', async () => {
    await createTaskRun(
      { input: { ...createInput('status-running'), status: 'RUNNING' } },
      context
    )
    await createTaskRun(
      {
        input: {
          ...createInput('status-queued'),
          status: 'QUEUED',
          stage: 'INTAKE',
        },
      },
      context
    )
    const completed = await createTaskRun(
      { input: createInput('status-completed') },
      context
    )
    await appendTaskEvent(
      {
        taskRunId: completed.id,
        input: {
          eventType: 'task.completed',
          status: 'COMPLETED',
          stage: 'EXECUTION',
          agent: 'qa-security-engineer-agent',
          skills: [],
          summary: '完成',
          idempotencyKey: 'status-completed-event',
        },
      },
      context
    )

    const all = await taskRuns({})
    expect(all.totalCount).toBe(3)
    expect(all.statusCounts.map((entry) => entry.status)).toEqual([
      'QUEUED',
      'RUNNING',
      'WAITING_CONFIRMATION',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ])
    const counts = Object.fromEntries(
      all.statusCounts.map((entry) => [entry.status, entry.count])
    )
    expect(counts).toEqual({
      QUEUED: 1,
      RUNNING: 1,
      WAITING_CONFIRMATION: 0,
      COMPLETED: 1,
      FAILED: 0,
      CANCELLED: 0,
    })

    const onlyRunning = await taskRuns({ filter: { statuses: ['RUNNING'] } })
    expect(onlyRunning.totalCount).toBe(1)
    expect(onlyRunning.edges).toHaveLength(1)
    // chips 的数字是全局口径：不随 statuses 过滤收缩。
    expect(onlyRunning.statusCounts).toEqual(all.statusCounts)
  })

  it('keeps startedAt ordering stable when updatedAt is refreshed', async () => {
    for (let index = 0; index < 3; index += 1) {
      await createTaskRun({ input: createInput(`stable-${index}`) }, context)
    }

    const before = await taskRuns({ first: 10 })
    const beforeIds = before.edges.map(({ node }) => node.id)
    expect(beforeIds).toHaveLength(3)

    // 模拟会话同步直接刷新 updatedAt（旧实现每 20 秒对全部会话执行一次）。
    await db.taskRun.update({
      where: { id: beforeIds.at(-1) as string },
      data: { updatedAt: new Date(Date.now() + 60_000) },
    })

    const after = await taskRuns({ first: 10 })
    expect(after.edges.map(({ node }) => node.id)).toEqual(beforeIds)

    const firstPage = await taskRuns({ first: 2 })
    const secondPage = await taskRuns({
      first: 2,
      after: firstPage.pageInfo.endCursor,
    })
    expect(
      new Set([
        ...firstPage.edges.map(({ node }) => node.id),
        ...secondPage.edges.map(({ node }) => node.id),
      ]).size
    ).toBe(3)
  })

  it('aggregates work, token usage, and latest model by agent', async () => {
    const created = await createTaskRun(
      {
        input: {
          ...createInput('metrics'),
          inputTokens: 1000,
          outputTokens: 200,
          cachedTokens: 400,
          modelId: 'gpt-6.1-sol',
        },
      },
      context
    )
    await appendTaskEvent(
      {
        taskRunId: created.id,
        input: {
          eventType: 'verification.completed',
          stage: 'VERIFICATION',
          agent: 'qa-security-engineer-agent',
          summary: '验证完成',
          inputTokens: 300,
          outputTokens: 80,
          modelId: 'gpt-6-astra',
          idempotencyKey: 'metrics-verification',
        },
      },
      context
    )

    const overview = await teamRuntimeOverview()
    expect(overview).toMatchObject({
      totalWorkCount: 1,
      totalTaskCount: 1,
      trackedWorkCount: 1,
      inputTokens: 1300,
      outputTokens: 280,
      cachedTokens: 400,
      totalTokens: 1580,
      inputTokenCoverage: 'COMPLETE',
      outputTokenCoverage: 'COMPLETE',
      cachedTokenCoverage: 'COMPLETE',
      totalTokenCoverage: 'COMPLETE',
    })
    expect(overview.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agent: 'software-engineer-agent',
          workCount: 1,
          trackedWorkCount: 1,
          totalTokens: 1200,
          totalTokenCoverage: 'COMPLETE',
          latestModelId: 'gpt-6.1-sol',
        }),
        expect.objectContaining({
          agent: 'qa-security-engineer-agent',
          workCount: 0,
          trackedWorkCount: 1,
          totalTokens: 380,
          cachedTokenCoverage: 'NONE',
          totalTokenCoverage: 'COMPLETE',
          latestModelId: 'gpt-6-astra',
        }),
      ])
    )
  })

  it('keeps missing token dimensions unknown while preserving known subtotals', async () => {
    await createTaskRun(
      {
        input: {
          ...createInput('cached-only'),
          cachedTokens: 400,
        },
      },
      context
    )

    const overview = await teamRuntimeOverview()
    expect(overview).toMatchObject({
      totalTaskCount: 1,
      trackedWorkCount: 1,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 400,
      totalTokens: 0,
      inputTokenCoverage: 'NONE',
      outputTokenCoverage: 'NONE',
      cachedTokenCoverage: 'COMPLETE',
      totalTokenCoverage: 'NONE',
    })
    expect(overview.agents[0]).toMatchObject({
      inputTokenCoverage: 'NONE',
      outputTokenCoverage: 'NONE',
      cachedTokenCoverage: 'COMPLETE',
      totalTokenCoverage: 'NONE',
    })
  })

  it('treats explicit zero token reports as collected data', async () => {
    await createTaskRun(
      {
        input: {
          ...createInput('zero-usage'),
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
        },
      },
      context
    )

    const overview = await teamRuntimeOverview()
    expect(overview).toMatchObject({
      trackedWorkCount: 1,
      totalTokens: 0,
      inputTokenCoverage: 'COMPLETE',
      outputTokenCoverage: 'COMPLETE',
      cachedTokenCoverage: 'COMPLETE',
      totalTokenCoverage: 'COMPLETE',
    })
  })

  it('marks usage as partial when only some tasks report token data', async () => {
    await createTaskRun(
      {
        input: {
          ...createInput('tracked'),
          inputTokens: 100,
          outputTokens: 20,
        },
      },
      context
    )
    await createTaskRun({ input: createInput('untracked') }, context)

    const overview = await teamRuntimeOverview()
    expect(overview).toMatchObject({
      totalWorkCount: 2,
      totalTaskCount: 2,
      trackedWorkCount: 1,
      totalTokens: 120,
      inputTokenCoverage: 'PARTIAL',
      outputTokenCoverage: 'PARTIAL',
      cachedTokenCoverage: 'NONE',
      totalTokenCoverage: 'PARTIAL',
    })
    expect(overview.agents[0]).toMatchObject({
      workCount: 2,
      trackedWorkCount: 1,
      totalTokenCoverage: 'PARTIAL',
    })
  })

  it('retains real usage for cancelled tasks but excludes them from work count', async () => {
    const created = await createTaskRun(
      {
        input: {
          ...createInput('cancelled'),
          inputTokens: 50,
          outputTokens: 10,
        },
      },
      context
    )
    await appendTaskEvent(
      {
        taskRunId: created.id,
        input: {
          eventType: 'task.cancelled',
          status: 'CANCELLED',
          stage: 'EXECUTION',
          agent: 'software-engineer-agent',
          summary: '任务取消，但保留已发生用量',
          idempotencyKey: 'cancelled-finish',
        },
      },
      context
    )

    const overview = await teamRuntimeOverview()
    expect(overview).toMatchObject({
      totalWorkCount: 0,
      totalTaskCount: 1,
      trackedWorkCount: 1,
      totalTokens: 60,
      totalTokenCoverage: 'COMPLETE',
    })
    expect(overview.agents[0]).toMatchObject({
      workCount: 0,
      trackedWorkCount: 1,
      totalTokens: 60,
    })
  })

  it('limits work and token totals to the requested time range', async () => {
    const inside = await createTaskRun(
      {
        input: {
          ...createInput('inside-range'),
          inputTokens: 100,
          outputTokens: 20,
        },
      },
      context
    )
    const outside = await createTaskRun(
      {
        input: {
          ...createInput('outside-range'),
          inputTokens: 900,
          outputTokens: 90,
        },
      },
      context
    )
    await db.taskRun.update({
      where: { id: inside.id },
      data: { startedAt: new Date('2026-10-10T02:00:00.000Z') },
    })
    await db.taskEvent.updateMany({
      where: { taskRunId: inside.id },
      data: { createdAt: new Date('2026-10-10T02:00:00.000Z') },
    })
    await db.taskRun.update({
      where: { id: outside.id },
      data: { startedAt: new Date('2026-09-01T02:00:00.000Z') },
    })
    await db.taskEvent.updateMany({
      where: { taskRunId: outside.id },
      data: { createdAt: new Date('2026-09-01T02:00:00.000Z') },
    })

    const overview = await teamRuntimeOverview({
      range: {
        from: new Date('2026-10-01T00:00:00+08:00'),
        to: new Date('2026-10-16T00:00:00+08:00'),
      },
    })

    expect(overview).toMatchObject({
      totalWorkCount: 1,
      totalTaskCount: 1,
      totalTokens: 120,
    })
    await expect(
      teamRuntimeOverview({
        range: {
          from: new Date('2026-10-16T00:00:00+08:00'),
          to: new Date('2026-10-01T00:00:00+08:00'),
        },
      })
    ).rejects.toThrow('开始时间必须早于结束时间')
  })

  it('returns duplicate true for concurrent retries with the same key', async () => {
    const created = await createTaskRun(
      { input: createInput('concurrent') },
      context
    )
    const input = {
      eventType: 'execution.progressed',
      stage: 'EXECUTION' as const,
      agent: 'software-engineer-agent',
      summary: '并发幂等写入',
      idempotencyKey: 'concurrent-append',
    }

    const results = await Promise.all([
      appendTaskEvent({ taskRunId: created.id, input }, context),
      appendTaskEvent({ taskRunId: created.id, input }, context),
    ])

    expect(results.map(({ duplicate }) => duplicate).sort()).toEqual([
      false,
      true,
    ])
    expect(await db.taskEvent.count()).toBe(2)
  })
})
