export const schema = gql`
  enum TaskRunStatus {
    QUEUED
    RUNNING
    WAITING_CONFIRMATION
    COMPLETED
    FAILED
    CANCELLED
  }

  enum TaskRunStage {
    INTAKE
    PLANNING
    EXECUTION
    VERIFICATION
    DELIVERY
  }

  enum RuntimeMetricCoverage {
    NONE
    PARTIAL
    COMPLETE
  }

  type TaskRun {
    id: ID!
    title: String!
    platform: String!
    externalReference: String
    primaryAgent: String!
    status: TaskRunStatus!
    currentStage: TaskRunStage!
    summary: String
    version: Int!
    startedAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
    events: [TaskEvent!]!
  }

  type TaskEvent {
    id: ID!
    taskRunId: ID!
    sequence: Int!
    eventType: String!
    status: TaskRunStatus
    stage: TaskRunStage!
    agent: String!
    skills: [String!]!
    summary: String!
    evidence: JSON
    inputTokens: Int
    outputTokens: Int
    cachedTokens: Int
    modelId: String
    idempotencyKey: String!
    createdAt: DateTime!
  }

  type AgentRuntimeMetric {
    agent: String!
    workCount: Int!
    trackedWorkCount: Int!
    inputTokens: Float!
    outputTokens: Float!
    cachedTokens: Float!
    totalTokens: Float!
    inputTokenCoverage: RuntimeMetricCoverage!
    outputTokenCoverage: RuntimeMetricCoverage!
    cachedTokenCoverage: RuntimeMetricCoverage!
    totalTokenCoverage: RuntimeMetricCoverage!
    latestModelId: String
    firstTaskAt: DateTime
    lastTaskAt: DateTime
  }

  type TeamRuntimeOverview {
    totalWorkCount: Int!
    totalTaskCount: Int!
    trackedWorkCount: Int!
    inputTokens: Float!
    outputTokens: Float!
    cachedTokens: Float!
    totalTokens: Float!
    inputTokenCoverage: RuntimeMetricCoverage!
    outputTokenCoverage: RuntimeMetricCoverage!
    cachedTokenCoverage: RuntimeMetricCoverage!
    totalTokenCoverage: RuntimeMetricCoverage!
    agents: [AgentRuntimeMetric!]!
  }

  type WeeklyAgentContribution {
    agent: String!
    workCount: Int!
    trackedWorkCount: Int!
    totalTokens: Float!
    tokenCoverage: RuntimeMetricCoverage!
  }

  type WeeklyTaskItem {
    id: ID!
    title: String!
    primaryAgent: String!
    status: TaskRunStatus!
    currentStage: TaskRunStage!
    summary: String
    updatedAt: DateTime!
  }

  type TeamWeeklyReport {
    from: DateTime!
    to: DateTime!
    generatedAt: DateTime!
    totalTasks: Int!
    completedTasks: Int!
    failedTasks: Int!
    cancelledTasks: Int!
    pendingTasks: Int!
    inputTokens: Float!
    outputTokens: Float!
    cachedTokens: Float!
    totalTokens: Float!
    totalTokenCoverage: RuntimeMetricCoverage!
    headline: String!
    contributions: [WeeklyAgentContribution!]!
    completed: [WeeklyTaskItem!]!
    failures: [WeeklyTaskItem!]!
    pending: [WeeklyTaskItem!]!
  }

  type TaskRunEdge {
    cursor: String!
    node: TaskRun!
  }

  type TaskRunPageInfo {
    endCursor: String
    hasNextPage: Boolean!
  }

  type TaskRunConnection {
    edges: [TaskRunEdge!]!
    pageInfo: TaskRunPageInfo!
  }

  type RuntimeComponentHealth {
    status: String!
    message: String
  }

  type RuntimeHealth {
    database: RuntimeComponentHealth!
    realtime: RuntimeComponentHealth!
    serverTime: DateTime!
  }

  input RuntimeTimeRange {
    from: DateTime
    to: DateTime
  }

  input TaskRunFilter {
    statuses: [TaskRunStatus!]
    platform: String
    primaryAgent: String
  }

  input CreateTaskRunInput {
    title: String!
    platform: String!
    externalReference: String
    primaryAgent: String!
    status: TaskRunStatus
    stage: TaskRunStage
    summary: String
    skills: [String!]
    evidence: JSON
    inputTokens: Int
    outputTokens: Int
    cachedTokens: Int
    modelId: String
    idempotencyKey: String!
  }

  input AppendTaskEventInput {
    eventType: String!
    status: TaskRunStatus
    stage: TaskRunStage!
    agent: String!
    skills: [String!]
    summary: String!
    evidence: JSON
    inputTokens: Int
    outputTokens: Int
    cachedTokens: Int
    modelId: String
    idempotencyKey: String!
  }

  type AppendTaskEventResult {
    taskRun: TaskRun!
    event: TaskEvent!
    duplicate: Boolean!
  }

  type Query {
    taskRuns(
      filter: TaskRunFilter
      after: String
      first: Int = 20
    ): TaskRunConnection! @requireAuth
    taskRun(id: ID!): TaskRun @requireAuth
    runtimeHealth: RuntimeHealth! @requireAuth
    teamRuntimeOverview(range: RuntimeTimeRange): TeamRuntimeOverview! @requireAuth
    teamWeeklyReport(range: RuntimeTimeRange!): TeamWeeklyReport! @requireAuth
  }

  type Mutation {
    createTaskRun(input: CreateTaskRunInput!): TaskRun! @requireRuntimeWriter
    appendTaskEvent(
      taskRunId: ID!
      input: AppendTaskEventInput!
    ): AppendTaskEventResult! @requireRuntimeWriter
  }
`
