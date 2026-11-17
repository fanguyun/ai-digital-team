import { timingSafeEqual } from 'node:crypto'

import type { ValidatorDirectiveFunc } from '@cedarjs/graphql-server'
import {
  AuthenticationError,
  createValidatorDirective,
} from '@cedarjs/graphql-server'
import gql from 'graphql-tag'

import { assertAuthenticated } from 'src/directives/requireAuth/requireAuth'
import { readTeamReadToken } from 'src/lib/teamReadToken'

export const schema = gql`
  """
  允许两种只读调用方：
    1. 浏览器里的登录会话（currentUser）
    2. 带 TEAM_READ_TOKEN 的只读聚合调用方

  只用于团队级只读聚合查询，不授予任何写权限。
  """
  directive @requireSessionOrTeamReader on FIELD_DEFINITION
`

type RuntimeContext = {
  currentUser?: { id?: string } | null
  request?: { headers?: { get?: (name: string) => string | null } }
  event?: { headers?: Record<string, string | undefined> }
}

const bearerToken = (authorization?: string | null) => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}

const authorizationHeader = (context: RuntimeContext) => {
  const requestAuthorization = context.request?.headers?.get?.('authorization')
  const eventHeaders = context.event?.headers
  const eventAuthorization =
    eventHeaders?.authorization ?? eventHeaders?.Authorization

  return requestAuthorization ?? eventAuthorization ?? undefined
}

export const validateTeamReaderAuthorization = (
  authorization: string | null | undefined,
  expected = readTeamReadToken()
) => {
  const expectedToken = expected.trim()
  if (!expectedToken) {
    throw new AuthenticationError('Team read token is not configured')
  }

  const actualToken = bearerToken(authorization)
  if (!actualToken) throw new AuthenticationError('Invalid team read token')

  const actualBuffer = Buffer.from(actualToken)
  const expectedBuffer = Buffer.from(expectedToken)
  const valid =
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  if (!valid) throw new AuthenticationError('Invalid team read token')
}

export const validateTeamReaderContext = (context: RuntimeContext) => {
  try {
    assertAuthenticated(context)
    return
  } catch {
    // 没有登录会话时退回只读 token。
  }

  validateTeamReaderAuthorization(authorizationHeader(context))
}

const validate: ValidatorDirectiveFunc = ({ context }) => {
  validateTeamReaderContext(context as RuntimeContext)
}

const requireSessionOrTeamReader = createValidatorDirective(schema, validate)

export default requireSessionOrTeamReader
