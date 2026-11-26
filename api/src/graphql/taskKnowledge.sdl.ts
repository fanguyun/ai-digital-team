export const schema = gql`
  type TaskKnowledgeSource {
    citation: String!
    blockId: String!
    documentId: String!
    title: String
    documentPath: String
    content: String
    contentHash: String!
    retrievedAt: String
    sourceUri: String!
    citationStatus: String!
  }

  type TaskKnowledge {
    status: String!
    mode: String
    elapsedMs: Int
    filteredOut: Int!
    answerAvailable: Boolean!
    unknownCitations: [String!]!
    sources: [TaskKnowledgeSource!]!
  }

  type Query {
    taskRunKnowledge(taskId: ID!, runId: ID!): TaskKnowledge! @requireAuth
  }
`
