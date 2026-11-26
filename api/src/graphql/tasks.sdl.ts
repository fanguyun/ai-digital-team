export const schema = gql`
  type TaskArtifact {
    id: ID!
    taskId: ID!
    kind: String!
    source: String!
    lastRunId: ID
    projectName: String
    availability: String!
    path: String!
    label: String!
    createdAt: DateTime!
  }

  type TaskPrecheck {
    warnings: [String!]!
    expectedPaths: [String!]!
    environment: TaskEnvironment!
  }

  type TaskEnvironmentCheck {
    key: String!
    label: String!
    status: String!
    detail: String!
    remedy: String!
  }

  type TaskEnvironment {
    ready: Boolean!
    checks: [TaskEnvironmentCheck!]!
  }

  type TaskEnvironmentBlock {
    prompt: String!
  }

  type TaskConfirmation {
    runId: ID!
    prompt: String!
  }

  type Task {
    workflow: TaskWorkflow
    id: ID!
    title: String!
    brief: String!
    acceptance: String!
    agentSlug: String!
    priority: String!
    status: String!
    readOnly: Boolean!
    "派发时是否检索外部知识库"
    useKnowledge: Boolean!
    mode: String!
    planPath: String
    planNote: String
    dueAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
    reviewNote: String
    reviewedAt: DateTime
    confirmation: TaskConfirmation
    blocker: TaskEnvironmentBlock
    runs: [TaskRun!]!
    artifacts: [TaskArtifact!]!
  }

  input CreateTaskInput {
    title: String!
    brief: String!
    acceptance: String
    agentSlug: String!
    priority: String
    dueAt: DateTime
    readOnly: Boolean
    useKnowledge: Boolean
    mode: String
  }

  input UpdateTaskInput {
    title: String
    brief: String
    acceptance: String
    agentSlug: String
    priority: String
    dueAt: DateTime
    readOnly: Boolean
    useKnowledge: Boolean
    mode: String
  }

  input AddTaskArtifactInput {
    kind: String
    path: String!
    label: String
  }

  type TaskPulse {
    awaitingReview: Int!
    running: Int!
    queued: Int!
    completedToday: Int!
    failedToday: Int!
  }

  type WorkspaceStatus {
    dirty: Boolean!
    changedCount: Int!
  }

  type TaskTemplate {
    id: ID!
    name: String!
    title: String!
    brief: String!
    acceptance: String!
    agentSlug: String!
    priority: String!
    readOnly: Boolean!
    createdAt: DateTime!
  }

  input CreateTaskTemplateInput {
    name: String!
    title: String!
    brief: String!
    acceptance: String
    agentSlug: String!
    priority: String
    readOnly: Boolean
  }

  input UpdateTaskTemplateInput {
    name: String
    title: String
    brief: String
    acceptance: String
    agentSlug: String
    priority: String
    readOnly: Boolean
  }

  type TaskRunMessage {
    role: String!
    content: String!
    createdAt: DateTime!
    step: Int
  }

  type Query {
    """
    按创建时间筛选：from/to 为 ISO 时间
    """
    tasks(
      status: String
      statuses: [String!]
      agentSlug: String
      from: DateTime
      to: DateTime
    ): [Task!]! @requireAuth
    taskRunMessages(runId: ID!): [TaskRunMessage!]! @requireAuth
    taskRunLog(runId: ID!): String! @requireAuth
    taskPrecheck(id: ID!): TaskPrecheck! @requireAuth
    taskPlanContent(taskId: ID!, planPath: String): String! @requireAuth
    workspaceStatus: WorkspaceStatus! @requireAuth
    taskPulse: TaskPulse! @requireAuth
    task(id: ID!): Task @requireAuth
    taskArtifactContent(id: ID!): String! @requireAuth
    taskTemplates: [TaskTemplate!]! @requireAuth
  }

  type Mutation {
    retryTaskEnvironment(id: ID!): Task! @requireAuth
    createTask(input: CreateTaskInput!): Task! @requireAuth
    updateTask(id: ID!, input: UpdateTaskInput!): Task! @requireAuth
    """
    note：本轮修改要求，独立保存并随排队续接
    """
    dispatchTask(id: ID!, tool: String, note: String): Task! @requireAuth
    confirmTaskContinuation(id: ID!, runId: ID!, note: String): Task!
      @requireAuth
    dispatchTasks(ids: [ID!]!, tool: String): [Task!]! @requireAuth
    executeTaskPlan(id: ID!, tool: String, planPath: String!): Task!
      @requireAuth
    reviseTaskPlan(id: ID!, note: String!, tool: String): Task! @requireAuth
    createTaskTemplate(input: CreateTaskTemplateInput!): TaskTemplate!
      @requireAuth
    updateTaskTemplate(id: ID!, input: UpdateTaskTemplateInput!): TaskTemplate!
      @requireAuth
    deleteTaskTemplate(id: ID!): TaskTemplate! @requireAuth
    cancelTask(id: ID!, version: Int): Task! @requireAuth
    reviewTask(id: ID!, decision: String!, note: String): Task! @requireAuth
    """
    手动刷新任务状态：进程已退出/日志不动时按日志收尾并推进任务
    """
    refreshTask(id: ID!): Task! @requireAuth
    """
    手动刷新运行状态：重新读取会话快照，必要时按已结束收尾
    """
    refreshRun(runId: ID!): TaskRun! @requireAuth
    addTaskArtifact(taskId: ID!, input: AddTaskArtifactInput!): Task!
      @requireAuth
    removeTaskArtifact(id: ID!): Task! @requireAuth
  }
`
