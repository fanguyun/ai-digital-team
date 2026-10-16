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

  type Query {
    capabilityHealth: CapabilityHealth! @requireAuth
  }
`
