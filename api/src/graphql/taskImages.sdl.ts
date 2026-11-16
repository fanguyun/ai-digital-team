export const schema = gql`
  type TaskImage {
    id: ID!
    path: String!
    label: String!
    mime: String!
    bytes: Int!
    url: String!
    createdAt: DateTime!
  }

  input UploadTaskImageInput {
    dataUrl: String!
    name: String
  }

  type Query {
    taskImageDataUrl(id: ID!): String! @requireAuth
  }

  type Mutation {
    uploadTaskImage(input: UploadTaskImageInput!): TaskImage! @requireAuth
  }
`
