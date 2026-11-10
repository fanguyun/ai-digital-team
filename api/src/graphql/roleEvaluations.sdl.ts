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
    startedAt: DateTime!
    prompt: String!
    reportPath: String!
    logPath: String!
    resultPath: String!
    pid: Int
  }

  input DispatchRoleEvaluationInput {
    agentSlug: String!
    tool: String!
  }

  type Query {
    roleEvaluationTools: [RoleEvaluationTool!]! @requireAuth
  }

  type Mutation {
    dispatchRoleEvaluation(
      input: DispatchRoleEvaluationInput!
    ): RoleEvaluationDispatch! @requireAuth
  }
`
