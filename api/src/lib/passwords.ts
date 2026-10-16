import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 32
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16)
  const hash = (await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS)) as Buffer
  return [
    'scrypt',
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$')
}

export const verifyPassword = async (password: string, encoded: string) => {
  const [scheme, n, r, p, salt, expected] = encoded.split('$')
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !expected) return false

  const actual = (await scrypt(password, Buffer.from(salt, 'base64url'), KEY_LENGTH, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })) as Buffer
  const expectedBuffer = Buffer.from(expected, 'base64url')
  return (
    actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
  )
}
