export const schema = gql`
  type RemoteApp {
    id: ID!
    name: String!
    url: String!
    icon: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input CreateRemoteAppInput {
    name: String!
    url: String!
    icon: String
  }

  input UpdateRemoteAppInput {
    name: String
    url: String
    icon: String
  }

  type Query {
    remoteApps: [RemoteApp!]! @requireAuth
    remoteApp(id: ID!): RemoteApp @requireAuth
  }

  type Mutation {
    createRemoteApp(input: CreateRemoteAppInput!): RemoteApp! @requireAuth
    updateRemoteApp(id: ID!, input: UpdateRemoteAppInput!): RemoteApp!
      @requireAuth
    deleteRemoteApp(id: ID!): RemoteApp! @requireAuth
  }
`
