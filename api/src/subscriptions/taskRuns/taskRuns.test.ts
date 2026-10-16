import { taskRunsSubscriptions } from './taskRuns'

describe('task run subscriptions', () => {
  it('subscribes to a single task channel', () => {
    const subscribe = jest.fn().mockReturnValue('single-task-stream')

    const result = taskRunsSubscriptions.taskRunChanged.subscribe(
      undefined,
      { taskRunId: 'task-1' },
      { pubSub: { subscribe } as never }
    )

    expect(subscribe).toHaveBeenCalledWith('taskRunChanged', 'task-1')
    expect(result).toBe('single-task-stream')
  })

  it('subscribes to the task list channel', () => {
    const subscribe = jest.fn().mockReturnValue('task-list-stream')

    const result = taskRunsSubscriptions.taskRunsChanged.subscribe(
      undefined,
      undefined,
      { pubSub: { subscribe } as never }
    )

    expect(subscribe).toHaveBeenCalledWith('taskRunsChanged')
    expect(result).toBe('task-list-stream')
  })
})
