jest.mock('src/lib/db', () => ({ db: {} }))

import { readSessionToken, sessionCookie } from './sessions'

describe('session cookie', () => {
  it('reads only the session token', () => {
    const cookie = sessionCookie('abc123')
    expect(readSessionToken(cookie)).toBe('abc123')
    expect(readSessionToken('theme=dark; pdt_session=abc123')).toBe('abc123')
    expect(readSessionToken('theme=dark')).toBeNull()
  })
})
