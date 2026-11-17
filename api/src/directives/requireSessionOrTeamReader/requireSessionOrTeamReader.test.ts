import { getDirectiveName } from '@cedarjs/testing/api'

import requireSessionOrTeamReader, {
  validateTeamReaderAuthorization,
  validateTeamReaderContext,
} from './requireSessionOrTeamReader'

describe('requireSessionOrTeamReader directive', () => {
  const originalToken = process.env.TEAM_READ_TOKEN

  afterEach(() => {
    process.env.TEAM_READ_TOKEN = originalToken
  })

  it('declares the expected directive name', () => {
    expect(getDirectiveName(requireSessionOrTeamReader.schema)).toBe(
      'requireSessionOrTeamReader'
    )
  })

  it('accepts a logged-in session', () => {
    expect(() =>
      validateTeamReaderContext({ currentUser: { id: 'user-1' } })
    ).not.toThrow()
  })

  it('accepts the configured read token without a session', () => {
    expect(() =>
      validateTeamReaderAuthorization(
        'Bearer test-team-read-token',
        'test-team-read-token'
      )
    ).not.toThrow()
  })

  it('rejects a missing or invalid read token', () => {
    expect(() =>
      validateTeamReaderAuthorization(undefined, 'test-team-read-token')
    ).toThrow('Invalid team read token')
    expect(() =>
      validateTeamReaderAuthorization(
        'Bearer wrong-token',
        'test-team-read-token'
      )
    ).toThrow('Invalid team read token')
  })

  it('rejects when no read token is configured', () => {
    delete process.env.TEAM_READ_TOKEN
    expect(() =>
      validateTeamReaderAuthorization('Bearer anything', '')
    ).toThrow('Team read token is not configured')
  })
})
