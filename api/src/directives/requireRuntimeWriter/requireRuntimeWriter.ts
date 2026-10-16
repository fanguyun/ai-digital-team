import { timingSafeEqual } from 'node:crypto'

import {
  AuthenticationError,
  createValidatorDirective,
  type ValidatorDirectiveFunc,
} from '@cedarjs/graphql-server'

export const schema = gql`
  directive @requireRuntimeWriter on FIELD_DEFINITION
`

const bearerToken = (authorization: string | null | undefined) => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}

const matchesToken = (actual: string | undefined, expected: string) => {
  if (!actual) return false

  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

export const validateRuntimeWriterAuthorization = (
  authorization: string | null | undefined
) => {
  const expectedToken = process.env.TASK_RUNTIME_WRITE_TOKEN
  if (!expectedToken) {
    throw new AuthenticationError('Runtime writer token is not configured')
  }

  const actualToken = bearerToken(authorization)
  if (!matchesToken(actualToken, expectedToken)) {
    throw new AuthenticationError('Invalid runtime writer token')
  }
}

const validate: ValidatorDirectiveFunc = ({ context }) => {
  const runtimeContext = context as {
    request?: Request
    event?: { headers?: Record<string, string | undefined> }
  }
  const requestAuthorization =
    runtimeContext.request?.headers.get('authorization')
  const eventHeaders = runtimeContext.event?.headers
  const eventAuthorization =
    eventHeaders?.authorization ?? eventHeaders?.Authorization
  validateRuntimeWriterAuthorization(
    requestAuthorization ?? eventAuthorization ?? undefined
  )
}

export default createValidatorDirective(schema, validate)
