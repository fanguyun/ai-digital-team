export type WorkflowStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type WorkflowStageName =
  | 'INTAKE'
  | 'PLANNING'
  | 'EXECUTION'
  | 'VERIFICATION'
  | 'DELIVERY'

export type WorkflowVisual = 'done' | 'active' | 'waiting' | 'failed' | 'next'

type WorkflowEvent = {
  stage: WorkflowStageName
  agent: string
  summary: string
}

type WorkflowTask = {
  id: string
  status: WorkflowStatus
  currentStage: WorkflowStageName
  primaryAgent: string
  updatedAt: string
  events: WorkflowEvent[]
}

export const WORKFLOW_STAGES: Array<{
  value: WorkflowStageName
  label: string
}> = [
  { value: 'INTAKE', label: '需求进入' },
  { value: 'PLANNING', label: '方案规划' },
  { value: 'EXECUTION', label: '执行实现' },
  { value: 'VERIFICATION', label: '验证确认' },
  { value: 'DELIVERY', label: '结果交付' },
]

export const describeWorkflowStage = (
  task: WorkflowTask,
  stage: WorkflowStageName,
  index: number
) => {
  const currentIndex = WORKFLOW_STAGES.findIndex(
    (item) => item.value === task.currentStage
  )
  let state: WorkflowVisual = 'next'
  if (task.status === 'COMPLETED' && index <= currentIndex) state = 'done'
  else if (index < currentIndex) state = 'done'
  else if (index === currentIndex) {
    state =
      task.status === 'WAITING_CONFIRMATION'
        ? 'waiting'
        : task.status === 'FAILED' || task.status === 'CANCELLED'
          ? 'failed'
          : 'active'
  }

  const stageEvent = [...task.events]
    .reverse()
    .find((event) => event.stage === stage)

  return {
    state,
    agent: stageEvent?.agent || (state === 'next' ? '' : task.primaryAgent),
    summary:
      stageEvent?.summary ||
      {
        done: '阶段已完成',
        active: '正在执行',
        waiting: '等待确认',
        failed: task.status === 'CANCELLED' ? '阶段已取消' : '阶段执行失败',
        next: '尚未到达',
      }[state],
    flowing: state === 'active' || state === 'waiting',
  }
}
