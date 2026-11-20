import { db } from 'src/lib/db'
import { knowledgeConfig, type KnowledgeMode } from 'src/lib/knowledgeConfig'
import { decryptSecret, secretKeyFromEnv } from 'src/lib/secrets'

const CACHE_TTL_MS = 30_000
const MAX_RESPONSE_BYTES = 256 * 1024
/** 测试连接放宽到 1 MB，便于把"返回过多"诊断清楚，而不是只说一句过大 */
const PROBE_MAX_BYTES = 1024 * 1024
const HEALTH_TIMEOUT_MS = 2000

export type KnowledgeSourceKind = 'database' | 'env' | 'none'

export type KnowledgeProvider = 'bridge' | 'siyuan'

export type ResolvedKnowledgeSource =
  | { status: 'disabled'; source: KnowledgeSourceKind }
  | { status: 'config_error'; source: KnowledgeSourceKind; mode: KnowledgeMode }
  | {
      status: 'ok'
      source: KnowledgeSourceKind
      mode: KnowledgeMode
      provider: KnowledgeProvider
      origin: string
      token: string
      timeoutMs: number
      notebooks: string[]
      pathPrefixes: string[]
    }

type CacheEntry = {
  row: {
    enabled: boolean
    baseUrl: string
    tokenCipher: string | null
    provider: string
    mode: string
    timeoutMs: number
    agentSlugs: string[]
    notebooks: string[]
    pathPrefixes: string[]
  } | null
  at: number
}

let cache: CacheEntry | null = null

export const invalidateKnowledgeSourceCache = () => {
  cache = null
}

const readRow = async () => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.row
  // 读库失败（含测试里 mock 掉的 db）按"没有数据库配置"处理，回落到环境变量
  const row = await Promise.resolve()
    .then(() => db.ragKnowledgeConfig.findUnique({ where: { id: 'default' } }))
    .catch(() => null)
  cache = {
    at: Date.now(),
    row: row
      ? {
          enabled: row.enabled,
          baseUrl: row.baseUrl,
          tokenCipher: row.tokenCipher,
          provider: row.provider,
          mode: row.mode,
          timeoutMs: row.timeoutMs,
          agentSlugs: row.agentSlugs,
          notebooks: row.notebooks,
          pathPrefixes: row.pathPrefixes,
        }
      : null,
  }
  return cache.row
}

/** 校验并归一化检索服务地址：只要 origin，禁止凭证/路径/查询串 */
export const normalizeBridgeOrigin = (value: string) => {
  let url: URL
  try {
    url = new URL((value || '').trim())
  } catch {
    throw new Error('服务地址不是合法 URL')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('服务地址只支持 http/https')
  }
  if (url.username || url.password) throw new Error('服务地址不能带凭证')
  if (url.search || url.hash) throw new Error('服务地址不能带查询串或锚点')
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('服务地址只填到端口，不要带路径')
  }
  return url.origin
}

/**
 * 解析当前生效的知识库配置：数据库配置优先，其次环境变量。
 * 数据库配置里岗位列表留空表示所有岗位可用。
 */
export const loadKnowledgeSource = async (
  agentSlug: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<ResolvedKnowledgeSource> => {
  const row = await readRow()

  if (row && row.enabled) {
    const mode: KnowledgeMode =
      row.mode === 'required' ? 'required' : 'optional'
    if (row.agentSlugs.length > 0 && !row.agentSlugs.includes(agentSlug)) {
      return { status: 'disabled', source: 'database' }
    }
    let token: string | null = null
    if (row.tokenCipher) {
      try {
        token = decryptSecret(
          row.tokenCipher,
          secretKeyFromEnv(env.SETTINGS_SECRET)
        )
      } catch {
        token = null
      }
    }
    if (!token) return { status: 'config_error', source: 'database', mode }
    try {
      return {
        status: 'ok',
        source: 'database',
        mode,
        provider: row.provider === 'siyuan' ? 'siyuan' : 'bridge',
        origin: normalizeBridgeOrigin(row.baseUrl),
        token,
        timeoutMs: Math.min(Math.max(row.timeoutMs, 1), 4000),
        notebooks: row.notebooks,
        pathPrefixes: row.pathPrefixes,
      }
    } catch {
      return { status: 'config_error', source: 'database', mode }
    }
  }

  // 没有可用的数据库配置时沿用环境变量
  try {
    const fromEnv = knowledgeConfig(agentSlug, env)
    if (!fromEnv.enabled) {
      return { status: 'disabled', source: row ? 'database' : 'none' }
    }
    return {
      status: 'ok',
      source: 'env',
      mode: fromEnv.mode,
      provider: 'bridge',
      origin: fromEnv.url as string,
      token: fromEnv.token as string,
      timeoutMs: fromEnv.timeoutMs ?? 4000,
      notebooks: [],
      pathPrefixes: [],
    }
  } catch {
    const mode: KnowledgeMode =
      env.KNOWLEDGE_MODE === 'optional' || !env.KNOWLEDGE_MODE
        ? 'optional'
        : 'required'
    return { status: 'config_error', source: 'env', mode }
  }
}

/** 目录前缀归一化：去掉首尾斜杠，拒绝 .. 与空值 */
export const normalizePathPrefix = (value: string) =>
  (value || '').trim().replace(/^\/+/, '').replace(/\/+$/, '')

export const isValidPathPrefix = (value: string) => {
  const normalized = normalizePathPrefix(value)
  return Boolean(normalized) && !normalized.split('/').includes('..')
}

/** 按目录白名单过滤：等于前缀或以「前缀/」开头 */
export const filterByPathPrefixes = <T extends { documentPath?: string }>(
  items: T[],
  prefixes: string[]
) => {
  const cleaned = prefixes
    .map(normalizePathPrefix)
    .filter((prefix) => prefix && !prefix.split('/').includes('..'))
  if (!cleaned.length) return { items, filteredOut: 0 }

  const kept = items.filter((item) => {
    const path = (item.documentPath || '').replace(/^\/+/, '')
    return cleaned.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    )
  })
  return { items: kept, filteredOut: items.length - kept.length }
}

export type ProbeCheck = {
  name: 'url' | 'healthz' | 'search'
  ok: boolean
  latencyMs?: number
  detail?: string
}

type LimitedBody =
  | { kind: 'ok'; text: string; bytes: number }
  | { kind: 'too_large' | 'no_body'; bytes: number }

const readLimited = async (
  response: Response,
  maxBytes: number = MAX_RESPONSE_BYTES
): Promise<LimitedBody> => {
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > maxBytes) {
    await response.body?.cancel()
    return { kind: 'too_large', bytes: length }
  }
  const reader = response.body?.getReader()
  if (!reader) return { kind: 'no_body', bytes: 0 }
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return { kind: 'too_large', bytes: size }
    }
    chunks.push(value)
  }
  return {
    kind: 'ok',
    text: Buffer.concat(chunks).toString('utf8'),
    bytes: size,
  }
}

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

const fetchWithTimeout = async (
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  timeoutMs: number
) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(input, {
      ...init,
      redirect: 'error',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 测试连接：地址合法性 → /healthz → /v1/search 形状。
 * 不返回上游正文与令牌；任何失败都只给分类原因。
 */
export type ProbeDiagnostic = {
  stage: 'healthz' | 'search'
  status?: number
  contentType?: string
  bytes?: number
  /** 上游响应体开头的一小段，仅用于排查，不返回给前端 */
  snippet?: string
}

const snippetOf = (text: string, max = 240) =>
  text.replace(/\s+/g, ' ').trim().slice(0, max)

export const probeKnowledgeBridge = async ({
  origin,
  token,
  timeoutMs = 4000,
  fetchImpl = fetch,
  onDiagnostic,
}: {
  origin: string
  token: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  onDiagnostic?: (info: ProbeDiagnostic) => void
}): Promise<{ ok: boolean; checks: ProbeCheck[] }> => {
  const checks: ProbeCheck[] = []

  try {
    normalizeBridgeOrigin(origin)
    checks.push({ name: 'url', ok: true })
  } catch (error) {
    checks.push({
      name: 'url',
      ok: false,
      detail: error instanceof Error ? error.message : '地址不合法',
    })
    return { ok: false, checks }
  }

  const healthStart = Date.now()
  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      `${origin}/healthz`,
      { method: 'GET' },
      Math.min(HEALTH_TIMEOUT_MS, timeoutMs)
    )
    await response.body?.cancel()
    checks.push({
      name: 'healthz',
      ok: response.ok,
      latencyMs: Date.now() - healthStart,
      detail: response.ok ? undefined : `HTTP ${response.status}`,
    })
    if (!response.ok) {
      onDiagnostic?.({
        stage: 'healthz',
        status: response.status,
        contentType: response.headers.get('content-type') || undefined,
      })
    }
    if (!response.ok) return { ok: false, checks }
  } catch {
    checks.push({
      name: 'healthz',
      ok: false,
      latencyMs: Date.now() - healthStart,
      detail: '无法连接检索服务',
    })
    return { ok: false, checks }
  }

  const searchStart = Date.now()
  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      `${origin}/v1/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // 用一个几乎不会命中的探针串：只验证鉴权与响应形状，不搬运真实资料
        body: JSON.stringify({ query: '__connectivity_probe__', limit: 1 }),
      },
      timeoutMs
    )
    const latencyMs = Date.now() - searchStart
    const contentType = response.headers.get('content-type') || undefined
    if (response.status === 401 || response.status === 403) {
      const denied = await readLimited(response, PROBE_MAX_BYTES)
      onDiagnostic?.({
        stage: 'search',
        status: response.status,
        contentType,
        bytes: denied.bytes,
        snippet: denied.kind === 'ok' ? snippetOf(denied.text) : undefined,
      })
      checks.push({ name: 'search', ok: false, latencyMs, detail: '令牌无效' })
      return { ok: false, checks }
    }
    if (!response.ok) {
      const failed = await readLimited(response, PROBE_MAX_BYTES)
      onDiagnostic?.({
        stage: 'search',
        status: response.status,
        contentType,
        bytes: failed.bytes,
        snippet: failed.kind === 'ok' ? snippetOf(failed.text) : undefined,
      })
      checks.push({
        name: 'search',
        ok: false,
        latencyMs,
        detail: `HTTP ${response.status}`,
      })
      return { ok: false, checks }
    }
    const limited = await readLimited(response, PROBE_MAX_BYTES)
    if (limited.kind !== 'ok') {
      checks.push({
        name: 'search',
        ok: false,
        latencyMs,
        detail:
          limited.kind === 'too_large'
            ? `响应体超过 ${formatBytes(PROBE_MAX_BYTES)}，检索服务返回内容过多`
            : '响应没有可读内容',
      })
      return { ok: false, checks }
    }
    let body: { status?: string; items?: unknown[] }
    try {
      body = JSON.parse(limited.text) as { status?: string; items?: unknown[] }
    } catch {
      onDiagnostic?.({
        stage: 'search',
        status: response.status,
        contentType,
        bytes: limited.bytes,
        snippet: snippetOf(limited.text),
      })
      checks.push({
        name: 'search',
        ok: false,
        latencyMs,
        detail:
          limited.bytes === 0
            ? `响应为空（HTTP ${response.status}），检索服务应返回 JSON（status + items）`
            : `返回的不是 JSON（${contentType || '未知类型'}，${formatBytes(limited.bytes)}）`,
      })
      return { ok: false, checks }
    }
    const statuses = [
      'hit',
      'empty',
      'auth_failed',
      'source_unavailable',
      'timeout',
    ]
    const baseValid =
      body &&
      typeof body.status === 'string' &&
      statuses.includes(body.status) &&
      Array.isArray(body.items)
    const itemCount = Array.isArray(body?.items) ? body.items.length : 0
    const tooMany = itemCount > 6
    const large = limited.bytes > MAX_RESPONSE_BYTES
    const valid = Boolean(baseValid) && !tooMany
    if (!valid) {
      onDiagnostic?.({
        stage: 'search',
        status: response.status,
        contentType,
        bytes: limited.bytes,
        snippet: snippetOf(limited.text),
      })
    }
    checks.push({
      name: 'search',
      ok: valid,
      latencyMs,
      detail: !baseValid
        ? '响应格式不符合检索服务约定'
        : tooMany
          ? `返回 ${itemCount} 条，超过上限 6（limit 参数未生效）`
          : large
            ? `响应 ${formatBytes(limited.bytes)}，超过常规上限 ${formatBytes(MAX_RESPONSE_BYTES)}（内容有效）`
            : body.status === 'hit'
              ? `命中 ${itemCount} 条`
              : `返回 ${body.status}`,
    })
    return { ok: valid, checks }
  } catch (error) {
    checks.push({
      name: 'search',
      ok: false,
      latencyMs: Date.now() - searchStart,
      detail:
        (error as Error)?.name === 'AbortError' ? '检索超时' : '检索请求失败',
    })
    return { ok: false, checks }
  }
}
