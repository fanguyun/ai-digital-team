import { describeWorkflowStage } from './workflowFlow'

const task = (
  id: string,
  status: 'RUNNING' | 'FAILED' | 'COMPLETED' | 'QUEUED',
  updatedAt: string
) => ({
  id,
  status,
  currentStage: 'EXECUTION' as const,
  primaryAgent: 'software-engineer-agent',
  updatedAt,
  events: [
    {
      stage: 'INTAKE' as const,
      agent: 'main-agent',
      summary: '接收需求',
    },
  ],
})

describe('workflow flow', () => {
  it('未到达阶段不显示主责岗位，当前阶段区分待确认和失败', () => {
    const current = {
      ...task('waiting', 'RUNNING', '2026-10-15T02:00:00Z'),
      status: 'WAITING_CONFIRMATION' as const,
    }

    expect(describeWorkflowStage(current, 'INTAKE', 0)).toMatchObject({
      state: 'done',
      agent: 'main-agent',
      summary: '接收需求',
    })
    expect(describeWorkflowStage(current, 'EXECUTION', 2)).toMatchObject({
      state: 'waiting',
      agent: 'software-engineer-agent',
      summary: '等待确认',
      flowing: true,
    })
    expect(describeWorkflowStage(current, 'DELIVERY', 4)).toMatchObject({
      state: 'next',
      agent: '',
      summary: '尚未到达',
      flowing: false,
    })
    expect(
      describeWorkflowStage({ ...current, status: 'FAILED' }, 'EXECUTION', 2)
    ).toMatchObject({ state: 'failed', summary: '阶段执行失败' })
  })

  it('uses status copy when a stage has no event record', () => {
    const completed = {
      ...task('completed', 'COMPLETED', '2026-10-15T02:00:00Z'),
      events: [],
    }
    const running = {
      ...task('running', 'RUNNING', '2026-10-15T02:00:00Z'),
      events: [],
    }

    expect(describeWorkflowStage(completed, 'INTAKE', 0).summary).toBe(
      '阶段已完成'
    )
    expect(describeWorkflowStage(running, 'EXECUTION', 2).summary).toBe(
      '正在执行'
    )
  })
})
