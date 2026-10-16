import { getDirectiveName } from '@cedarjs/testing/api'

import requireAuth, { assertAuthenticated } from './requireAuth.js'

describe('requireAuth directive', () => {
  it('declares the directive sdl as schema, with the correct name', () => {
    expect(requireAuth.schema).toBeTruthy()
    expect(getDirectiveName(requireAuth.schema)).toBe('requireAuth')
  })

  it('rejects a request without a logged-in user', () => {
    expect(() => assertAuthenticated({})).toThrow('请先登录')
  })

  it('allows a request with a logged-in user', () => {
    expect(() => assertAuthenticated({ currentUser: { id: '1' } })).not.toThrow()
  })
})
