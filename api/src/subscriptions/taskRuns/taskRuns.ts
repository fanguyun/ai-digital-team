import gql from 'graphql-tag'

import type { TaskRuntimePubSub } from 'src/lib/runtimeEvents'

export const schema = gql`
  type Subscription {
    taskRunChanged(taskRunId: ID!): TaskRun! @requireAuth
    taskRunsChanged: TaskRun! @requireAuth
  }
`

export const taskRunsSubscriptions = {
  taskRunChanged: {
    subscribe: (
      _root: unknown,
      { taskRunId }: { taskRunId: string },
      { pubSub }: { pubSub: TaskRuntimePubSub }
    ) => pubSub.subscribe('taskRunChanged', taskRunId),
    resolve: (payload: unknown) => payload,
  },
  taskRunsChanged: {
    subscribe: (
      _root: unknown,
      _args: unknown,
      { pubSub }: { pubSub: TaskRuntimePubSub }
    ) => pubSub.subscribe('taskRunsChanged'),
    resolve: (payload: unknown) => payload,
  },
}

export default taskRunsSubscriptions
