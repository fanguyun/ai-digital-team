import type { TaskRun } from 'api/db/generated/prisma/client.mts'
import type { PubSub } from '@cedarjs/realtime'

export type TaskRuntimeChannels = {
  taskRunChanged: [taskRunId: string, payload: TaskRun]
  taskRunsChanged: [payload: TaskRun]
}

export type TaskRuntimePubSub = PubSub<TaskRuntimeChannels>

export const publishTaskRun = async (
  pubSub: TaskRuntimePubSub | undefined,
  taskRun: TaskRun
) => {
  if (!pubSub) return

  await Promise.all([
    pubSub.publish('taskRunChanged', taskRun.id, taskRun),
    pubSub.publish('taskRunsChanged', taskRun),
  ])
}
