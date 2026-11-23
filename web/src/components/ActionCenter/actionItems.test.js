import { buildActionCenterModel, STALE_TASK_THRESHOLD_MS } from './actionItems'

const now = new Date('2026-10-16T08:00:00.000Z')

describe('action center model', () => {
  it('shows environment blockers once without offering human approval for the old run', () => {
    const model = buildActionCenterModel({
      now,
      tasks: [
        {
          id: 'blocked-task',
          status: 'ENVIRONMENT_BLOCKED',
          updatedAt: now,
          blocker: { prompt: '团队API未启动' },
        },
      ],
      taskRuns: [
        {
          id: 'old-wait',
          taskId: 'blocked-task',
          status: 'WAITING_CONFIRMATION',
          updatedAt: now,
        },
      ],
    })
    expect(model.items).toEqual([
      expect.objectContaining({
        type: 'blocked',
        actionLabel: '检查执行环境',
        section: 'runs',
        description: '团队API未启动',
      }),
    ])
    expect(model.counts.waiting).toBe(0)
  })
  it('routes both new and historical pending confirmations to the task instead of offering review approval', () => {
    const model = buildActionCenterModel({
      now,
      tasks: ['WAITING_CONFIRMATION', 'AWAITING_REVIEW'].map((status, i) => ({
        id: `task-${i}`,
        status,
        updatedAt: now,
        confirmation: { runId: `run-${i}`, prompt: '确认目标后继续' },
      })),
      taskRuns: [
        {
          id: 'run-0',
          taskId: 'task-0',
          status: 'WAITING_CONFIRMATION',
          updatedAt: now,
        },
      ],
    })
    expect(model.items).toHaveLength(2)
    expect(
      model.items.every(
        (item) =>
          item.type === 'waiting' &&
          item.action === 'tasks' &&
          item.section === 'runs' &&
          item.actionLabel === '查看并确认'
      )
    ).toBe(true)
    expect(model.counts.review).toBe(0)
    expect(model.counts.waiting).toBe(2)
  })
  it('keeps linked runtime confirmations visible when no task approval card exists', () => {
    const model = buildActionCenterModel({
      now,
      taskRuns: [
        {
          id: 'active-run',
          taskId: 'running-task',
          status: 'WAITING_CONFIRMATION',
          updatedAt: now,
        },
      ],
    })
    expect(model.items).toEqual([
      expect.objectContaining({
        type: 'waiting',
        action: 'tasks',
        taskId: 'running-task',
        section: 'runs',
      }),
    ])
  })
  it('links actionable tasks and suppresses previous failed runs for linked tasks', () => {
    const tasks = ['AWAITING_APPROVAL', 'AWAITING_REVIEW', 'FAILED'].map(
      (status, index) => ({
        id: `task-${index}`,
        title: status,
        agentSlug: 'main-agent',
        priority: 'P1',
        status,
        updatedAt: now,
      })
    )
    const model = buildActionCenterModel({
      now,
      tasks,
      taskRuns: [
        { id: 'old-run', taskId: 'task-0', status: 'FAILED', updatedAt: now },
        {
          id: 'done-task-run',
          taskId: 'completed-task',
          status: 'FAILED',
          updatedAt: now,
        },
      ],
    })
    expect(model.items).toHaveLength(3)
    expect(model.items.map((item) => item.section)).toEqual([
      'plan',
      'review',
      'runs',
    ])
    expect(model.counts).toMatchObject({ waiting: 1, review: 1, failed: 1 })
  })

  it('does not claim a healthy empty state when refreshing cached data fails', () => {
    const model = buildActionCenterModel({
      now,
      runtimeHealth: { database: { status: 'UP' } },
      queryError: new Error('同步失败'),
    })
    expect(model.items[0].id).toBe('health-query')
  })

  it('orders health first, task priority and oldest wait next, and skill updates last', () => {
    const model = buildActionCenterModel({
      now,
      tasks: [
        {
          id: 'new',
          priority: 'P1',
          status: 'AWAITING_REVIEW',
          updatedAt: now,
        },
        {
          id: 'old',
          priority: 'P1',
          status: 'AWAITING_REVIEW',
          updatedAt: new Date(0),
        },
        { id: 'urgent', priority: 'P0', status: 'FAILED', updatedAt: now },
      ],
      runtimeHealth: { database: { status: 'DOWN' } },
      skills: [{ name: 'skill', updatable: true }],
    })
    expect(model.items.map((item) => item.id)).toEqual([
      'health-database',
      'task-urgent',
      'task-old',
      'task-new',
      'skill-updates',
    ])
  })
  it('collects actionable tasks and avoids duplicating waiting tasks as stale', () => {
    const model = buildActionCenterModel({
      now,
      taskRuns: [
        {
          id: 'waiting',
          title: '等待确认',
          primaryAgent: 'main-agent',
          status: 'WAITING_CONFIRMATION',
          updatedAt: new Date(now.getTime() - STALE_TASK_THRESHOLD_MS * 2),
        },
        {
          id: 'stale',
          title: '停滞任务',
          primaryAgent: 'software-engineer-agent',
          status: 'RUNNING',
          updatedAt: new Date(now.getTime() - STALE_TASK_THRESHOLD_MS),
        },
        {
          id: 'fresh',
          title: '正常任务',
          primaryAgent: 'main-agent',
          status: 'RUNNING',
          updatedAt: new Date(now.getTime() - 5 * 60 * 1000),
        },
      ],
    })

    expect(model.items.map((item) => item.id)).toEqual([
      'waiting-waiting',
      'stale-stale',
    ])
    expect(model.counts).toMatchObject({ total: 2, waiting: 1, stale: 1 })
  })

  it('collects health and skill updates without treating token coverage as pending', () => {
    const model = buildActionCenterModel({
      now,
      runtimeHealth: {
        database: { status: 'UP' },
        realtime: { status: 'DOWN', message: '连接中断' },
      },
      overview: {
        totalTaskCount: 5,
        trackedWorkCount: 2,
        totalTokenCoverage: 'PARTIAL',
      },
      skills: [
        { name: 'audit', updatable: true },
        { name: 'research', updatable: false },
      ],
    })

    expect(model.items.map((item) => item.id)).toEqual([
      'health-realtime',
      'skill-updates',
    ])
    expect(model.counts.system).toBe(2)
  })
})
