import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'
import {
  invalidateKnowledgeSourceCache,
  isValidPathPrefix,
  normalizeBridgeOrigin,
  normalizePathPrefix,
  probeKnowledgeBridge,
} from 'src/lib/knowledgeSource'
import { logger } from 'src/lib/logger'
import { readTeamAgents, resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'
import {
  decryptSecret,
  encryptSecret,
  secretHint,
  secretKeyFromEnv,
} from 'src/lib/secrets'
import { listSiYuanNotebooks, probeSiYuan } from 'src/lib/siyuanKnowledge'

const SETTINGS_ID = 'default'
const MAX_AGENTS = 30
const MAX_PREFIXES = 20
const MAX_PREFIX_LENGTH = 200
/** 只做长度上限保护，不限制下限：服务端自己的密钥规则由检索服务判断 */
const MAX_TOKEN_LENGTH = 512
const TEST_WINDOW_MS = 60_000
const TEST_LIMIT = 10

const testAttempts = new Map<string, number[]>()

const text = (value: unknown, max: number, label: string) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (raw.length > max)
    throw new UserInputError(`${label}不能超过 ${max} 个字符`)
  return raw
}

const agentOptions = () =>
  readTeamAgents(resolveRepoRoot()).map((agent) => ({
    slug: agent.slug,
    name: agent.name,
  }))

const maskToken = (cipher: string | null, hint: string | null) => ({
  hasToken: Boolean(cipher),
  tokenHint: hint,
})

/** 环境变量是否在起作用：开启即算 env 配置（具体岗位/合法性在调用时校验） */
const envConfigSource = () =>
  process.env.KNOWLEDGE_ENABLED === '1' ? 'env' : 'none'

const view = async () => {
  const row = await db.ragKnowledgeConfig.findUnique({
    where: { id: SETTINGS_ID },
  })
  return {
    enabled: row?.enabled ?? false,
    baseUrl: row?.baseUrl ?? '',
    ...maskToken(row?.tokenCipher ?? null, row?.tokenHint ?? null),
    provider: row?.provider ?? 'bridge',
    mode: row?.mode ?? 'optional',
    timeoutMs: row?.timeoutMs ?? 4000,
    agentSlugs: row?.agentSlugs ?? [],
    notebooks: row?.notebooks ?? [],
    pathPrefixes: row?.pathPrefixes ?? [],
    configSource: row ? 'database' : envConfigSource(),
    updatedAt: row?.updatedAt ?? null,
    lastTest: row?.lastTestAt
      ? {
          at: row.lastTestAt,
          ok: row.lastTestStatus === 'ok',
          latencyMs: row.lastTestLatency ?? null,
          checks: [],
        }
      : null,
    availableAgents: agentOptions(),
  }
}

export const ragKnowledgeSource = async () => view()

const validateAgentSlugs = (values: unknown) => {
  const list = Array.isArray(values) ? values : []
  if (list.length > MAX_AGENTS) {
    throw new UserInputError(`岗位最多 ${MAX_AGENTS} 个`)
  }
  const known = new Set(agentOptions().map((agent) => agent.slug))
  const slugs = [
    ...new Set(list.map((item) => String(item).trim()).filter(Boolean)),
  ]
  const unknown = slugs.filter((slug) => !known.has(slug))
  if (unknown.length) {
    throw new UserInputError(`岗位不存在：${unknown.join('、')}`)
  }
  return slugs
}

const validateNotebooks = (values: unknown) => {
  const list = Array.isArray(values) ? values : []
  const ids = [
    ...new Set(list.map((item) => String(item).trim()).filter(Boolean)),
  ]
  if (ids.length > MAX_AGENTS)
    throw new UserInputError(`笔记本最多 ${MAX_AGENTS} 个`)
  const invalid = ids.filter((id) => !/^\d{14}-[a-z0-9]{7}$/.test(id))
  if (invalid.length) {
    throw new UserInputError(`笔记本 ID 格式不正确：${invalid.join('、')}`)
  }
  return ids
}

const validatePrefixes = (values: unknown) => {
  const list = Array.isArray(values) ? values : []
  const cleaned = list
    .map((item) => text(item, MAX_PREFIX_LENGTH, '目录前缀'))
    .filter(Boolean)
  if (cleaned.length > MAX_PREFIXES) {
    throw new UserInputError(`目录前缀最多 ${MAX_PREFIXES} 条`)
  }
  const invalid = cleaned.filter((prefix) => !isValidPathPrefix(prefix))
  if (invalid.length) {
    throw new UserInputError(
      `目录前缀不能包含 .. 或为空：${invalid.join('、')}`
    )
  }
  // 统一存成不带首尾斜杠的形式，匹配时再按前缀判断
  return [...new Set(cleaned.map(normalizePathPrefix))]
}

/**
 * 令牌三种语义：
 * - 不传（undefined/null）：保持原值
 * - 空字符串：清除
 * - 新值：校验长度后加密覆盖
 */
const resolveToken = (row: { tokenCipher: string | null }, token: unknown) => {
  if (token === undefined || token === null) {
    return {
      tokenCipher: row.tokenCipher,
      tokenHint: undefined,
      cleared: false,
    }
  }
  const raw = String(token).trim()
  if (!raw) return { tokenCipher: null, tokenHint: null, cleared: true }
  if (raw.length > MAX_TOKEN_LENGTH) {
    throw new UserInputError(`访问令牌不能超过 ${MAX_TOKEN_LENGTH} 个字符`)
  }
  let key: Buffer
  try {
    key = secretKeyFromEnv()
  } catch (error) {
    throw new UserInputError(
      error instanceof Error ? error.message : '无法加密保存令牌'
    )
  }
  return {
    tokenCipher: encryptSecret(raw, key),
    tokenHint: secretHint(raw),
    cleared: false,
  }
}

export const saveRagKnowledgeSource = async ({
  input,
}: {
  input: {
    enabled?: boolean
    baseUrl?: string
    token?: string | null
    provider?: string
    mode?: string
    timeoutMs?: number
    agentSlugs?: string[]
    notebooks?: string[]
    pathPrefixes?: string[]
  }
}) => {
  const data = input || {}
  const enabled = Boolean(data.enabled)
  let baseUrl = ''
  if (enabled || data.baseUrl) {
    try {
      baseUrl = normalizeBridgeOrigin(data.baseUrl || '')
    } catch (error) {
      throw new UserInputError(
        error instanceof Error ? error.message : '服务地址不合法'
      )
    }
  }
  const mode = data.mode === 'required' ? 'required' : 'optional'
  const timeoutMs = Number.isFinite(data.timeoutMs)
    ? Math.min(Math.max(Number(data.timeoutMs), 1), 4000)
    : 4000
  const provider = data.provider === 'siyuan' ? 'siyuan' : 'bridge'
  const agentSlugs = validateAgentSlugs(data.agentSlugs)
  const notebooks = validateNotebooks(data.notebooks)
  const pathPrefixes = validatePrefixes(data.pathPrefixes)

  const existing = await db.ragKnowledgeConfig.findUnique({
    where: { id: SETTINGS_ID },
    select: { tokenCipher: true, tokenHint: true },
  })
  const token = resolveToken(
    { tokenCipher: existing?.tokenCipher ?? null },
    data.token
  )

  if (enabled && !token.tokenCipher) {
    throw new UserInputError(
      token.cleared
        ? '清除令牌时必须同时关闭启用开关'
        : '启用知识库需要填写访问令牌'
    )
  }

  const payload = {
    enabled,
    baseUrl,
    tokenCipher: token.tokenCipher,
    tokenHint: token.tokenCipher
      ? (token.tokenHint ?? existing?.tokenHint ?? null)
      : null,
    provider,
    mode,
    timeoutMs,
    agentSlugs,
    notebooks,
    pathPrefixes,
    updatedBy: 'ui',
  }

  await db.ragKnowledgeConfig.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...payload },
    update: payload,
  })
  invalidateKnowledgeSourceCache()
  logger.info(
    { enabled, mode, agents: agentSlugs.length },
    'knowledge source saved'
  )
  return view()
}

export const clearRagKnowledgeSource = async () => {
  await db.ragKnowledgeConfig
    .delete({ where: { id: SETTINGS_ID } })
    .catch(() => null)
  invalidateKnowledgeSourceCache()
  return view()
}

/** 简单限流：同一用户每分钟最多 10 次测试 */
const assertTestRate = (userId: string) => {
  const now = Date.now()
  const recent = (testAttempts.get(userId) || []).filter(
    (at) => now - at < TEST_WINDOW_MS
  )
  if (recent.length >= TEST_LIMIT) {
    throw new UserInputError('测试太频繁，请稍后再试')
  }
  recent.push(now)
  testAttempts.set(userId, recent)
}

export const testRagKnowledgeSource = async ({
  token,
  currentUser,
}: {
  token?: string | null
  currentUser?: { username?: string } | null
}) => {
  assertTestRate(currentUser?.username || 'anonymous')

  const row = await db.ragKnowledgeConfig.findUnique({
    where: { id: SETTINGS_ID },
  })
  if (!row || !row.baseUrl) {
    throw new UserInputError('还没有保存过配置，请先保存服务地址与令牌再测试')
  }

  // 只允许测试已保存的地址，避免把后端当跳板访问任意 URL
  const candidate = row.tokenCipher
    ? (() => {
        try {
          return decryptSecret(row.tokenCipher, secretKeyFromEnv())
        } catch {
          return null
        }
      })()
    : null
  const probeToken = token ? String(token) : candidate
  if (!probeToken) {
    throw new UserInputError(
      '访问令牌不可用（可能密钥已轮换），请重新填写后保存'
    )
  }

  const startedAt = Date.now()
  const result =
    row.provider === 'siyuan'
      ? await probeSiYuan({
          origin: row.baseUrl,
          token: probeToken,
          timeoutMs: row.timeoutMs,
        })
      : await probeKnowledgeBridge({
          origin: row.baseUrl,
          token: probeToken,
          timeoutMs: row.timeoutMs,
          // 排查用：把上游的 content-type、大小和响应体开头打到服务端日志（不含令牌）
          onDiagnostic: (info) =>
            logger.warn(
              {
                baseUrl: row.baseUrl,
                stage: info.stage,
                status: info.status,
                contentType: info.contentType,
                bytes: info.bytes,
                snippet: info.snippet,
              },
              'knowledge probe failed'
            ),
        })
  const latencyMs = Date.now() - startedAt

  await db.ragKnowledgeConfig
    .update({
      where: { id: SETTINGS_ID },
      data: {
        lastTestAt: new Date(),
        lastTestStatus: result.ok ? 'ok' : 'failed',
        lastTestLatency: latencyMs,
      },
    })
    .catch(() => null)

  if (!result.ok) {
    logger.warn(
      { baseUrl: row.baseUrl, provider: row.provider, checks: result.checks },
      'knowledge probe failed'
    )
  }

  return {
    ok: result.ok,
    checks: result.checks,
    latencyMs,
    at: new Date(),
  }
}

/** 直连模式下读取思源笔记本列表，供界面勾选可达范围 */
export const siyuanNotebooks = async () => {
  const row = await db.ragKnowledgeConfig.findUnique({
    where: { id: SETTINGS_ID },
  })
  if (!row?.baseUrl)
    return { ok: false, notebooks: [], error: '还没有保存配置' }
  let token: string | null = null
  if (row.tokenCipher) {
    try {
      token = decryptSecret(row.tokenCipher, secretKeyFromEnv())
    } catch {
      token = null
    }
  }
  if (!token) {
    return { ok: false, notebooks: [], error: '访问令牌不可用，请重新填写' }
  }
  const result = await listSiYuanNotebooks({
    origin: row.baseUrl,
    token,
    timeoutMs: row.timeoutMs,
  })
  return result
}
