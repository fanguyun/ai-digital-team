export const schema = gql`
  type KnowledgePublication {
    id: ID!
    taskId: ID
    artifactId: ID
    title: String!
    markdown: String!
    contentHash: String!
    notebookId: String!
    documentPath: String!
    status: String!
    documentId: String
    documentUrl: String
    error: String
    confirmedAt: DateTime
    verifiedAt: DateTime
    createdAt: DateTime!
  }
  type KnowledgePublicationTargets {
    available: Boolean!
    reason: String
    notebooks: [SiYuanNotebook!]!
    pathPrefixes: [String!]!
  }
  input PrepareKnowledgePublicationInput {
    taskId: ID
    artifactId: ID
    title: String!
    markdown: String
    notebookId: String!
    directory: String!
  }
  type Query {
    knowledgePublicationTargets(taskId: ID): KnowledgePublicationTargets!
      @requireAuth
    knowledgePublications(taskId: ID): [KnowledgePublication!]! @requireAuth
  }
  type Mutation {
    prepareKnowledgePublication(
      input: PrepareKnowledgePublicationInput!
    ): KnowledgePublication! @requireAuth
    publishKnowledgePublication(
      id: ID!
      contentHash: String!
    ): KnowledgePublication! @requireAuth
  }
`
