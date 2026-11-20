import {
  decryptSecret,
  encryptSecret,
  secretHint,
  secretKeyFromEnv,
  SecretConfigError,
} from './secrets'

const SECRET = 'k'.repeat(32)

describe('settings secret', () => {
  it('round-trips a token and hides it in the cipher text', () => {
    const key = secretKeyFromEnv(SECRET)
    const cipher = encryptSecret('token-abcdefghijklmnopqrstuvwxyz-1234', key)

    expect(cipher).toMatch(/^v1\./)
    expect(cipher).not.toContain('token-abcdefghijklmnopqrstuvwxyz-1234')
    expect(decryptSecret(cipher, key)).toBe(
      'token-abcdefghijklmnopqrstuvwxyz-1234'
    )
  })

  it('uses a fresh IV so identical tokens encrypt differently', () => {
    const key = secretKeyFromEnv(SECRET)
    const first = encryptSecret('same-token-value-same-token-value', key)
    const second = encryptSecret('same-token-value-same-token-value', key)
    expect(first).not.toBe(second)
    expect(decryptSecret(first, key)).toBe(decryptSecret(second, key))
  })

  it('returns null for tampered cipher text or a rotated key', () => {
    const key = secretKeyFromEnv(SECRET)
    const cipher = encryptSecret(
      'another-token-value-0123456789',
      key
    ) as string
    const [version, iv, tag, payload] = cipher.split('.')
    const flipped = payload.endsWith('A') ? 'B' : 'A'

    expect(
      decryptSecret(
        [version, iv, tag, payload.slice(0, -1) + flipped].join('.'),
        key
      )
    ).toBeNull()
    expect(decryptSecret(cipher, secretKeyFromEnv('r'.repeat(32)))).toBeNull()
  })

  it('rejects a missing or short SETTINGS_SECRET', () => {
    expect(() => secretKeyFromEnv('short')).toThrow(SecretConfigError)
    expect(() => secretKeyFromEnv('')).toThrow(SecretConfigError)
  })

  it('returns empty cipher for empty input and a masked hint', () => {
    const key = secretKeyFromEnv(SECRET)
    expect(encryptSecret('', key)).toBeNull()
    expect(secretHint('abcdef123456')).toBe('••••3456')
  })
})
