import gql from 'graphql-tag'

import type { ValidatorDirectiveFunc } from '@cedarjs/graphql-server'
import { AuthenticationError, createValidatorDirective } from '@cedarjs/graphql-server'

export const schema = gql`
  """
  Use to check whether or not a user is authenticated and is associated
  with an optional set of roles.
  """
  directive @requireAuth(roles: [String]) on FIELD_DEFINITION
`

type AuthContext = { currentUser?: { id?: string } | null }

export const assertAuthenticated = (context?: AuthContext | null) => {
  if (!context?.currentUser?.id) throw new AuthenticationError('请先登录')
}

type RequireAuthValidate = ValidatorDirectiveFunc<{ roles?: string[] }>

const validate: RequireAuthValidate = ({ context }) => {
  assertAuthenticated(context as AuthContext)
}

const requireAuth = createValidatorDirective(schema, validate)

export default requireAuth
