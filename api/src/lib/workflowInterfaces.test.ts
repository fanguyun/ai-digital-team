import { db } from 'src/lib/db'
import {
  advanceWorkflow,
  cancelWorkflow,
  syncWorkflowPublication,
} from 'src/lib/workflowRuntime'
import { appendTaskEvent } from 'src/services/taskRuns/taskRuns'
import {
  cancelTask,
  dispatchTask,
  refreshRun,
  refreshTask,
  removeTaskArtifact,
  reviewTask,
  updateTask,
} from 'src/services/tasks/tasks'

jest.mock('src/lib/db', () => ({
  db: {
    task: { findUnique: jest.fn() },
    taskRun: { findUnique: jest.fn(), update: jest.fn() },
    taskArtifact: { findUnique: jest.fn(), delete: jest.fn() },
    taskEvent: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}))
jest.mock('src/lib/workflowRuntime', () => ({
  advanceWorkflow: jest.fn(),
  syncWorkflowPublication: jest.fn(),
  cancelWorkflow: jest.fn(),
  getWorkflow: jest.fn(),
}))
const database = db as unknown as Record<string, any>
beforeEach(() => {
  jest.clearAllMocks()
  database.task.findUnique.mockResolvedValue({
    id: 'task',
    workflow: { id: 'wf', version: 5 },
  })
  database.taskRun.findUnique.mockResolvedValue({
    id: 'run',
    taskId: 'task',
    mode: 'workflow',
    status: 'RUNNING',
  })
  database.taskArtifact.findUnique.mockResolvedValue({
    id: 'artifact',
    source: 'workflow',
  })
  database.taskEvent.findUnique.mockResolvedValue(null)
  database.$transaction.mockImplementation((fn) => fn(database))
})
it.each([
  () => dispatchTask({ id: 'task' }),
  () => reviewTask({ id: 'task', decision: 'APPROVE' }),
  () => updateTask({ id: 'task', input: { brief: '试图修改' } }),
])('普通任务操作不能跳过工作流步骤', async (operation) => {
  await expect(operation()).rejects.toThrow('工作流任务请使用步骤操作')
})
it('刷新没有 PID 的工作流运行不触发旧的自动完成逻辑', async () => {
  await refreshRun({ runId: 'run' })
  expect(advanceWorkflow).toHaveBeenCalledWith('task')
  expect(syncWorkflowPublication).toHaveBeenCalledWith('task')
  expect(database.taskRun.update).not.toHaveBeenCalled()
})
it('刷新任务使用工作流恢复入口', async () => {
  await refreshTask({ id: 'task' })
  expect(advanceWorkflow).toHaveBeenCalledWith('task')
})
it('保留工作流历史产物，取消需明确当前版本', async () => {
  await expect(removeTaskArtifact({ id: 'artifact' })).rejects.toThrow(
    '保留追溯'
  )
  expect(database.taskArtifact.delete).not.toHaveBeenCalled()
  await expect(cancelTask({ id: 'task' })).rejects.toThrow('需携带当前版本')
  await cancelTask({ id: 'task', version: 5 })
  expect(cancelWorkflow).toHaveBeenCalledWith('task', 5)
})
it('执行会话不能通过运行时事件自行结束工作流', async () => {
  await expect(
    appendTaskEvent(
      {
        taskRunId: 'run',
        input: {
          idempotencyKey: 'finish',
          eventType: 'task.completed',
          stage: 'DELIVERY',
          status: 'COMPLETED',
          agent: 'main-agent',
          summary: '完成',
        },
      },
      {}
    )
  ).rejects.toThrow('由后端编排维护')
  expect(database.taskRun.update).not.toHaveBeenCalled()
})
