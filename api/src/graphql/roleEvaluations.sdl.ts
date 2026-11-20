export const schema = gql`
  type RoleEvaluationTool {
    id: ID!
    name: String!
    available: Boolean!
    version: String
    reason: String
  }

  type RoleEvaluationDispatch {
    id: ID!
    agentSlug: String!
    agentName: String!
    tool: String!
    projectKey: String!
    projectRoot: String!
    sessionId: String
    startedAt: DateTime!
    prompt: String!
    reportPath: String!
    logPath: String!
    resultPath: String!
    pid: Int
  }

  type RoleEvaluation {
    id: ID!
    agentSlug: String!
    agentName: String!
    projectKey: String!
    projectRoot: String!
    tool: String!
    status: String!
    sessionId: String
    pid: Int
    reportPath: String!
    logPath: String!
    startedAt: DateTime!
    finishedAt: DateTime
    taskId: ID
    """失败时从日志尾部取到的真实报错（成功或运行中为 null）"""
    failureReason: String
  }

  type RoleEvaluationMessage {
    role: String!
    content: String!
    createdAt: DateTime!
  }

  input DispatchRoleEvaluationInput {
    agentSlug: String!
    tool: String!
  }

  type Query {
    roleEvaluationTools: [RoleEvaluationTool!]! @requireAuth
    roleEvaluations(agentSlug: String): [RoleEvaluation!]! @requireAuth
    roleEvaluationReport(id: ID!): String! @requireAuth
    roleEvaluationMessages(id: ID!): [RoleEvaluationMessage!]! @requireAuth
  }

  type Mutation {
    dispatchRoleEvaluation(
      input: DispatchRoleEvaluationInput!
    ): RoleEvaluationDispatch! @requireAuth
    sendRoleEvaluationMessage(id: ID!, message: String!): RoleEvaluation!
      @requireAuth
  }
`
