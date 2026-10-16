import { buildActionCenterModel, STALE_TASK_THRESHOLD_MS } from './actionItems'

const now = new Date('2026-10-16T08:00:00.000Z')

describe('action center model', () => {
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
