import { getDirectiveName, mockRedwoodDirective } from '@cedarjs/testing/api'

import requireSessionOrRuntimeWriter from './requireSessionOrRuntimeWriter'

describe('requireSessionOrRuntimeWriter directive', () => {
  const originalToken = process.env.TASK_RUNTIME_WRITE_TOKEN

  afterEach(() => {
    process.env.TASK_RUNTIME_WRITE_TOKEN = originalToken
  })

  it('declares the expected directive name', () => {
    expect(getDirectiveName(requireSessionOrRuntimeWriter.schema)).toBe(
      'requireSessionOrRuntimeWriter'
    )
  })

  it('accepts a logged-in session', () => {
    const execute = mockRedwoodDirective(requireSessionOrRuntimeWriter, {
      context: { currentUser: { id: 'user-1' } },
    })

    expect(() => execute()).not.toThrow()
  })

  it('accepts the runtime writer token without a session', () => {
    process.env.TASK_RUNTIME_WRITE_TOKEN = 'test-runtime-token'
    const execute = mockRedwoodDirective(requireSessionOrRuntimeWriter, {
      context: {
        currentUser: null,
        event: { headers: { authorization: 'Bearer test-runtime-token' } },
      },
    })

    expect(() => execute()).not.toThrow()
  })

  it('rejects when neither session nor token is valid', () => {
    process.env.TASK_RUNTIME_WRITE_TOKEN = 'test-runtime-token'
    const execute = mockRedwoodDirective(requireSessionOrRuntimeWriter, {
      context: { currentUser: null },
    })

    expect(() => execute()).toThrow()
  })
})
