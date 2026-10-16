import { getDirectiveName, mockRedwoodDirective } from '@cedarjs/testing/api'

import requireRuntimeWriter, {
  validateRuntimeWriterAuthorization,
} from './requireRuntimeWriter'

describe('requireRuntimeWriter directive', () => {
  const originalToken = process.env.TASK_RUNTIME_WRITE_TOKEN

  afterEach(() => {
    process.env.TASK_RUNTIME_WRITE_TOKEN = originalToken
  })

  it('declares the expected directive name', () => {
    expect(getDirectiveName(requireRuntimeWriter.schema)).toBe(
      'requireRuntimeWriter'
    )
  })

  it('accepts the configured bearer token', () => {
    process.env.TASK_RUNTIME_WRITE_TOKEN = 'test-runtime-token'
    expect(() =>
      validateRuntimeWriterAuthorization('Bearer test-runtime-token')
    ).not.toThrow()
  })

  it('rejects a missing or invalid bearer token', () => {
    process.env.TASK_RUNTIME_WRITE_TOKEN = 'test-runtime-token'
    const execute = mockRedwoodDirective(requireRuntimeWriter, { context: {} })

    expect(execute).toThrow('Invalid runtime writer token')
  })
})
