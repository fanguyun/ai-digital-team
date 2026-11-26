export const schema = gql`
  type WorkflowTemplateStep {
    key: String!
    name: String!
    kind: String!
    agentSlug: String!
  }
  type WorkflowTemplate {
    key: String!
    version: Int!
    name: String!
    steps: [WorkflowTemplateStep!]!
  }
  type WorkflowAttempt {
    id: ID!
    number: Int!
    status: String!
    sessionId: String
    logPath: String
    startedAt: DateTime!
    finishedAt: DateTime
    error: String
    artifactId: ID
    contentHash: String
    inputTokens: Int
    outputTokens: Int
    cachedTokens: Int
    output: JSON
  }
  type WorkflowStep {
    id: ID!
    ordinal: Int!
    key: String!
    name: String!
    kind: String!
    agentSlug: String!
    status: String!
    attemptCount: Int!
    attempts: [WorkflowAttempt!]!
  }
  type TaskWorkflow {
    id: ID!
    taskId: ID!
    runId: ID
    templateKey: String!
    templateVersion: Int!
    status: String!
    currentStep: Int!
    version: Int!
    reworkCount: Int!
    note: String
    publicationId: ID
    input: JSON!
    steps: [WorkflowStep!]!
  }
  input CreateWorkflowTaskInput {
    templateKey: String!
    title: String!
    questions: String!
    scope: String!
    audience: String
    materials: String
  }
  type Query {
    workflowTemplates: [WorkflowTemplate!]! @requireAuth
  }
  type Mutation {
    createWorkflowTask(input: CreateWorkflowTaskInput!): Task! @requireAuth
    startWorkflow(taskId: ID!, version: Int!, tool: String): Task! @requireAuth
    retryWorkflowStep(
      taskId: ID!
      version: Int!
      note: String
      sourceMode: String
      target: String
    ): Task! @requireAuth
  }
`
