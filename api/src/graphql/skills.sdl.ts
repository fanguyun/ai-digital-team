export const schema = gql`
  type InstalledSkill {
    id: ID!
    name: String!
    description: String!
    source: String!
    tags: [String!]!
    path: String!
    updatedAt: DateTime!
    updatable: Boolean!
    body: String!
  }

  type UpdateInstalledSkillResult {
    skill: InstalledSkill!
    message: String!
  }

  type Query {
    installedSkills: [InstalledSkill!]! @requireAuth
  }

  type Mutation {
    updateInstalledSkill(id: ID!): UpdateInstalledSkillResult! @requireAuth
  }
`
