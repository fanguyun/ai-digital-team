import { hashPassword, verifyPassword } from './passwords'

describe('password hashing', () => {
  it('verifies the original password and rejects a different one', async () => {
    const encoded = await hashPassword('correct-horse')
    expect(encoded).not.toContain('correct-horse')
    await expect(verifyPassword('correct-horse', encoded)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', encoded)).resolves.toBe(false)
  })
})
