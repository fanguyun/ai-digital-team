export const schema = gql`
  type RagKnowledgeAgent {
    slug: String!
    name: String!
  }

  type RagKnowledgeCheck {
    name: String!
    ok: Boolean!
    latencyMs: Int
    detail: String
  }

  type RagKnowledgeTest {
    at: DateTime
    ok: Boolean!
    latencyMs: Int
    checks: [RagKnowledgeCheck!]!
  }

  type SiYuanNotebook {
    id: String!
    name: String!
    closed: Boolean!
  }

  type SiYuanNotebookList {
    ok: Boolean!
    notebooks: [SiYuanNotebook!]!
    error: String
  }

  type RagKnowledgeSource {
    enabled: Boolean!
    baseUrl: String!
    hasToken: Boolean!
    tokenHint: String
    "bridge = 自建检索桥；siyuan = 直连思源 API"
    provider: String!
    mode: String!
    timeoutMs: Int!
    agentSlugs: [String!]!
    "直连模式下的思源笔记本白名单（box id），空表示不限制"
    notebooks: [String!]!
    pathPrefixes: [String!]!
    "生效来源：database / env / none"
    configSource: String!
    updatedAt: DateTime
    lastTest: RagKnowledgeTest
    availableAgents: [RagKnowledgeAgent!]!
  }

  input RagKnowledgeSourceInput {
    enabled: Boolean
    baseUrl: String
    "不传=保持原令牌；空字符串=清除；其它=新令牌"
    token: String
    provider: String
    mode: String
    timeoutMs: Int
    agentSlugs: [String!]
    notebooks: [String!]
    pathPrefixes: [String!]
  }

  type Query {
    ragKnowledgeSource: RagKnowledgeSource! @requireAuth
    siyuanNotebooks: SiYuanNotebookList! @requireAuth
  }

  type Mutation {
    saveRagKnowledgeSource(
      input: RagKnowledgeSourceInput!
    ): RagKnowledgeSource! @requireAuth
    "ad-hoc 令牌仅用于尚未保存的新令牌；地址固定取已保存配置"
    testRagKnowledgeSource(token: String): RagKnowledgeTest! @requireAuth
    clearRagKnowledgeSource: RagKnowledgeSource! @requireAuth
  }
`
