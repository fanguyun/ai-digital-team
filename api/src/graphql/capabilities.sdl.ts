export const schema = gql`
  type CapabilitySkillCheck {
    name: String!
    available: Boolean!
    bound: Boolean!
    path: String
  }

  type CapabilityToolCheck {
    name: String!
    available: Boolean!
    path: String
  }

  type AgentCapabilityHealth {
    slug: String!
    name: String!
    status: String!
    platformSupported: Boolean!
    agentInstalled: Boolean!
    missingRequiredSkills: [String!]!
    missingOptionalSkills: [String!]!
    missingRequiredTools: [String!]!
    unboundRequiredSkills: [String!]!
    requiredSkills: [CapabilitySkillCheck!]!
    optionalSkills: [CapabilitySkillCheck!]!
    requiredTools: [CapabilityToolCheck!]!
    assessment: String!
    suggestions: [String!]!
  }

  type CapabilitySummary {
    total: Int!
    complete: Int!
    partial: Int!
    notInstalled: Int!
    unbound: Int!
  }

  type CapabilityPlatformReport {
    platform: String!
    generatedAt: DateTime!
    summary: CapabilitySummary!
    agents: [AgentCapabilityHealth!]!
  }

  type CapabilityCliCheck {
    id: ID!
    name: String!
    status: String!
    path: String!
    message: String!
  }

  type CapabilityHealth {
    generatedAt: DateTime!
    reports: [CapabilityPlatformReport!]!
    cli: [CapabilityCliCheck!]!
  }

  type CapabilityFixStep {
    title: String!
    detail: String
  }

  type CapabilityFixItem {
    kind: String!
    name: String!
    severity: String!
    title: String!
    steps: [CapabilityFixStep!]!
    canApply: Boolean!
    blockedReason: String
    source: String
    linkPath: String
  }

  type CapabilityFixPlan {
    agentSlug: String!
    agentName: String!
    items: [CapabilityFixItem!]!
  }

  type CapabilityFixResult {
    skill: String!
    ok: Boolean!
    changed: Boolean!
    message: String!
    linkPath: String!
    source: String
  }

  type CapabilityApplyResult {
    agentSlug: String!
    applied: [CapabilityFixResult!]!
  }

  type Query {
    capabilityHealth: CapabilityHealth! @requireAuth
  }

  type Mutation {
    capabilityFixPlan(agentSlug: String!): CapabilityFixPlan! @requireAuth
    capabilityApplyFixes(agentSlug: String!): CapabilityApplyResult!
      @requireAuth
  }
`
