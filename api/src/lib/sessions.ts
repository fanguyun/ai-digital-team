import { createHash, randomBytes } from 'node:crypto'

import { db } from 'src/lib/db'
import { hashPassword, verifyPassword } from 'src/lib/passwords'

export const SESSION_COOKIE = 'pdt_session'
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000

export type SessionUser = { id: string; username: string }

type HeaderSource = {
  request?: { headers?: { get?: (name: string) => string | null } }
  event?: { headers?: Record<string, string | undefined> }
}

const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export const readSessionToken = (cookieHeader?: string | null) => {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === SESSION_COOKIE) return value.join('=') || null
  }
  return null
}

export const sessionCookie = (token: string, maxAge = SESSION_TTL_MS / 1000) =>
  `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`

export const clearSessionCookie = () => sessionCookie('', 0)

const cookieHeaderFrom = (source?: HeaderSource | null) => {
  const requestCookie = source?.request?.headers?.get?.('cookie')
  const headers = source?.event?.headers
  return requestCookie || headers?.cookie || headers?.Cookie || null
}

let bootstrap: Promise<void> | null = null

export const ensureBootstrapUser = () => {
  bootstrap ??= createBootstrapUser().catch((error) => {
    bootstrap = null
    throw error
  })
  return bootstrap
}

const createBootstrapUser = async () => {
  const username = process.env.AUTH_USERNAME?.trim() || 'fan'
  const password = process.env.AUTH_PASSWORD
  if (!username || !password) return

  const existing = await db.user.findUnique({ where: { username } })
  if (existing) return

  await db.user.create({
    data: { username, passwordHash: await hashPassword(password) },
  })
}

export const authenticate = async (username: string, password: string) => {
  await ensureBootstrapUser()
  const normalized = username.trim()
  const user = await db.user.findUnique({ where: { username: normalized } })
  const hash = user?.passwordHash || (await hashPassword(password))
  const valid = await verifyPassword(password, hash)
  if (!user || !valid) return null
  return { id: user.id, username: user.username }
}

export const createSession = async (user: SessionUser) => {
  const token = randomBytes(32).toString('base64url')
  await db.authSession.create({
    data: {
      tokenHash: tokenHash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })
  return { token, cookie: sessionCookie(token) }
}

export const userFromCookie = async (cookieHeader?: string | null) => {
  const token = readSessionToken(cookieHeader)
  if (!token) return null

  const session = await db.authSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  })
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await db.authSession.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  return { id: session.user.id, username: session.user.username }
}

export const destroySession = async (cookieHeader?: string | null) => {
  const token = readSessionToken(cookieHeader)
  if (!token) return
  await db.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } })
}

export const userFromContext = async (source?: HeaderSource | null) => {
  await ensureBootstrapUser()
  return userFromCookie(cookieHeaderFrom(source))
}
