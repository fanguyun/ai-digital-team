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
    logPath: String
    mode: String!
    dirtyAtDispatch: Boolean!
    inputTokens: Int
    outputTokens: Int
    cachedTokens: Int
    version: Int!
    startedAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
    taskId: ID
    task: Task @requireAuth
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
    runningCount: Int!
    waitingCount: Int!
    queuedCount: Int!
  }

  type ActiveTaskRun {
    id: ID!
    taskId: ID
    title: String!
    primaryAgent: String!
    status: TaskRunStatus!
    currentStage: TaskRunStage!
    updatedAt: DateTime!
  }

  type TeamRuntimeOverview {
    totalWorkCount: Int!
    totalTaskCount: Int!
    trackedWorkCount: Int!
    runningCount: Int!
    waitingCount: Int!
    queuedCount: Int!
    inputTokens: Float!
    outputTokens: Float!
    cachedTokens: Float!
    totalTokens: Float!
    inputTokenCoverage: RuntimeMetricCoverage!
    outputTokenCoverage: RuntimeMetricCoverage!
    cachedTokenCoverage: RuntimeMetricCoverage!
    totalTokenCoverage: RuntimeMetricCoverage!
    agents: [AgentRuntimeMetric!]!
    activeTasks: [ActiveTaskRun!]!
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

  type DeliveryStat {
    files: Int!
    added: Int!
    removed: Int!
  }

  type DeliveryDirectoryStat {
    directory: String!
    files: Int!
    added: Int!
    removed: Int!
  }

  type TeamDeliveryStat {
    files: Int!
    added: Int!
    removed: Int!
    byDirectory: [DeliveryDirectoryStat!]!
    uncategorized: DeliveryStat!
    """
    有交付统计的运行数
    """
    coveredRuns: Int!
    totalRuns: Int!
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
    delivery: TeamDeliveryStat!
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
    totalCount: Int!
    statusCounts: [TaskRunStatusCount!]!
  }

  type TaskRunStatusCount {
    status: TaskRunStatus!
    count: Int!
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
    search: String
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

  type TaskRunTool {
    name: String!
    detail: String!
    result: String!
    resultTruncated: Boolean!
    redacted: Boolean!
    createdAt: DateTime!
    step: Int
  }

  type TaskRunTrace {
    turn: Int
    source: String!
    messages: [TaskRunMessage!]!
    tools: [TaskRunTool!]!
    truncated: Boolean!
  }

  type Query {
    taskRuns(
      filter: TaskRunFilter
      after: String
      first: Int = 20
      skip: Int = 0
    ): TaskRunConnection! @requireSessionOrRuntimeWriter
    taskRun(id: ID!): TaskRun @requireSessionOrRuntimeWriter
    taskRunTrace(runId: ID!): TaskRunTrace! @requireAuth
    runtimeHealth: RuntimeHealth! @requireAuth
    teamRuntimeOverview(range: RuntimeTimeRange): TeamRuntimeOverview!
      @requireSessionOrTeamReader
    teamWeeklyReport(range: RuntimeTimeRange!): TeamWeeklyReport!
      @requireSessionOrTeamReader
  }

  type Mutation {
    createTaskRun(input: CreateTaskRunInput!): TaskRun! @requireRuntimeWriter
    appendTaskEvent(
      taskRunId: ID!
      input: AppendTaskEventInput!
    ): AppendTaskEventResult! @requireRuntimeWriter
  }
`
