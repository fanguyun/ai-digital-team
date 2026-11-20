import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

const VERSION = 'v1'
const IV_BYTES = 12
const MIN_SECRET_LENGTH = 32

export class SecretConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretConfigError'
  }
}

/** 从环境变量派生 32 字节密钥；缺失或过短时抛错，避免静默落明文 */
export const secretKeyFromEnv = (secret = process.env.SETTINGS_SECRET) => {
  const value = (secret || '').trim()
  if (value.length < MIN_SECRET_LENGTH) {
    throw new SecretConfigError(
      `未配置 SETTINGS_SECRET（至少 ${MIN_SECRET_LENGTH} 个字符），无法加密保存令牌`
    )
  }
  return createHash('sha256').update(`pdt-settings:${value}`).digest()
}

const encode = (buffer: Buffer) => buffer.toString('base64url')
const decode = (value: string) => Buffer.from(value, 'base64url')

/** 加密为 v1.<iv>.<tag>.<payload>，每次随机 IV */
export const encryptSecret = (plain: string, key: Buffer) => {
  if (!plain) return null
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, encode(iv), encode(tag), encode(data)].join('.')
}

/** 解密失败（密钥轮换、密文被改）返回 null，由调用方按"令牌不可用"处理 */
export const decryptSecret = (cipherText: string | null, key: Buffer) => {
  if (!cipherText) return null
  const [version, iv, tag, payload] = cipherText.split('.')
  if (version !== VERSION || !iv || !tag || !payload) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, decode(iv))
    decipher.setAuthTag(decode(tag))
    return Buffer.concat([
      decipher.update(decode(payload)),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

/** 展示用提示：只保留末 4 位 */
export const secretHint = (plain: string) =>
  plain.length <= 4 ? '••••' : `••••${plain.slice(-4)}`
