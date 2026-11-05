import gql from 'graphql-tag'

import type { ValidatorDirectiveFunc } from '@cedarjs/graphql-server'
import { createValidatorDirective } from '@cedarjs/graphql-server'

import { assertAuthenticated } from 'src/directives/requireAuth/requireAuth'
import { validateRuntimeWriterAuthorization } from 'src/directives/requireRuntimeWriter/requireRuntimeWriter'

export const schema = gql`
  """
  允许两种调用方：
    1. 浏览器里的登录会话（currentUser）
    2. 带 TASK_RUNTIME_WRITE_TOKEN 的运行时常驻进程/CLI

  用于任务运行记录的读接口——页面按会话鉴权，
  CLI（task-runtime show/complete/cancel ...）按运行时 token 鉴权。
  """
  directive @requireSessionOrRuntimeWriter on FIELD_DEFINITION
`

type RuntimeContext = {
  currentUser?: { id?: string } | null
  request?: Request
  event?: { headers?: Record<string, string | undefined> }
}

const authorizationHeader = (context: RuntimeContext) => {
  const requestAuthorization = context.request?.headers.get('authorization')
  const eventHeaders = context.event?.headers
  const eventAuthorization =
    eventHeaders?.authorization ?? eventHeaders?.Authorization

  return requestAuthorization ?? eventAuthorization ?? undefined
}

const validate: ValidatorDirectiveFunc = ({ context }) => {
  const runtimeContext = context as RuntimeContext

  try {
    assertAuthenticated(runtimeContext)
    return
  } catch {
    // 没有会话时退回运行时写入 token
  }

  validateRuntimeWriterAuthorization(authorizationHeader(runtimeContext))
}

const requireSessionOrRuntimeWriter = createValidatorDirective(schema, validate)

export default requireSessionOrRuntimeWriter
