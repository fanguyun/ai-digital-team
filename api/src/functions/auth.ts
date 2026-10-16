import type { APIGatewayEvent } from 'aws-lambda'

import {
  authenticate,
  clearSessionCookie,
  createSession,
  destroySession,
  userFromCookie,
} from 'src/lib/sessions'

const WINDOW_MS = 10 * 60 * 1000
const MAX_FAILURES = 8
const failures = new Map<string, { count: number; resetAt: number }>()

const clientKey = (event: APIGatewayEvent, username: string) => {
  const forwarded = event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For']
  const ip = forwarded?.split(',')[0]?.trim() || 'local'
  return `${ip}:${username.trim().toLowerCase()}`
}

const limited = (key: string) => {
  const entry = failures.get(key)
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILURES)
}

const recordFailure = (key: string) => {
  const now = Date.now()
  const entry = failures.get(key)
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count += 1
}

const respond = (
  statusCode: number,
  body: Record<string, unknown>,
  cookie?: string
) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    ...(cookie ? { 'set-cookie': cookie } : {}),
  },
  multiValueHeaders: cookie ? { 'set-cookie': [cookie] } : undefined,
  body: JSON.stringify(body),
})

const cookieHeader = (event: APIGatewayEvent) =>
  event.headers?.cookie || event.headers?.Cookie

export const handler = async (event: APIGatewayEvent) => {
  const method = event.httpMethod?.toUpperCase()

  if (method === 'GET') {
    const user = await userFromCookie(cookieHeader(event))
    return user ? respond(200, { user }) : respond(401, { user: null })
  }

  if (method === 'DELETE') {
    await destroySession(cookieHeader(event))
    return respond(200, { ok: true }, clearSessionCookie())
  }

  if (method !== 'POST') return respond(405, { message: '不支持的请求' })

  let username = ''
  let password = ''
  try {
    const body = JSON.parse(event.body || '{}') as { username?: string; password?: string }
    username = String(body.username || '')
    password = String(body.password || '')
  } catch {
    return respond(400, { message: '账号或密码不正确' })
  }

  if (!username.trim() || !password || password.length > 200 || username.trim().length > 80) {
    return respond(401, { message: '账号或密码不正确' })
  }

  const key = clientKey(event, username)
  if (limited(key)) return respond(429, { message: '尝试次数过多，请稍后再试' })

  const user = await authenticate(username, password)
  if (!user) {
    recordFailure(key)
    return respond(401, { message: '账号或密码不正确' })
  }

  failures.delete(key)
  const session = await createSession(user)
  return respond(200, { user }, session.cookie)
}
