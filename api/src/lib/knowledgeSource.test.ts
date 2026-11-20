// 这个模块会读数据库；纯函数测试不需要真实连接
jest.mock('src/lib/db', () => ({
  db: { ragKnowledgeConfig: { findUnique: jest.fn() } },
}))

import { db } from 'src/lib/db'
import { encryptSecret, secretKeyFromEnv } from 'src/lib/secrets'

import {
  filterByPathPrefixes,
  invalidateKnowledgeSourceCache,
  loadKnowledgeSource,
  normalizeBridgeOrigin,
  probeKnowledgeBridge,
} from './knowledgeSource'

describe('bridge origin', () => {
  it('keeps only the origin', () => {
    expect(normalizeBridgeOrigin('http://nas.local:8787')).toBe(
      'http://nas.local:8787'
    )
    expect(normalizeBridgeOrigin('https://rag.example.com/')).toBe(
      'https://rag.example.com'
    )
  })

  it.each([
    ['file:///tmp/x', '只支持 http'],
    ['http://user:pass@nas.local', '不能带凭证'],
    ['http://nas.local/path', '不要带路径'],
    ['http://nas.local/?a=1', '不能带查询串'],
    ['not-a-url', '合法 URL'],
  ])('rejects %s', (value, message) => {
    expect(() => normalizeBridgeOrigin(value)).toThrow(message)
  })
})

describe('path prefixes', () => {
  const items = [
    { documentPath: '团队/研发/接口规范' },
    { documentPath: '团队/研发' },
    { documentPath: '团队/研发2/别的' },
    { documentPath: '/个人/笔记' },
  ]

  it('keeps items inside the prefix and counts the rest', () => {
    const result = filterByPathPrefixes(items, ['团队/研发'])
    expect(result.items.map((item) => item.documentPath)).toEqual([
      '团队/研发/接口规范',
      '团队/研发',
    ])
    expect(result.filteredOut).toBe(2)
  })

  it('treats a longer sibling as outside', () => {
    const result = filterByPathPrefixes(items, ['/团队/研发/'])
    expect(result.filteredOut).toBe(2)
  })

  it('returns everything when no prefix is configured', () => {
    expect(filterByPathPrefixes(items, []).filteredOut).toBe(0)
    expect(filterByPathPrefixes(items, ['  ']).items).toHaveLength(4)
  })

  it('drops traversal prefixes instead of matching them', () => {
    expect(filterByPathPrefixes(items, ['../etc']).items).toHaveLength(4)
  })
})

describe('probeKnowledgeBridge', () => {
  const okHealth = () =>
    new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
  const okSearch = () =>
    new Response(JSON.stringify({ status: 'empty', items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  it('runs url, healthz and search checks', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(okSearch())

    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })

    expect(result.ok).toBe(true)
    expect(result.checks.map((check) => check.name)).toEqual([
      'url',
      'healthz',
      'search',
    ])
    expect(result.checks.every((check) => check.ok)).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [, init] = fetchImpl.mock.calls[1]
    // 探针串必须几乎不可能命中，避免测试时把真实资料整批拉回来
    expect(JSON.parse(String(init?.body))).toEqual({
      query: '__connectivity_probe__',
      limit: 1,
    })
    expect(init?.redirect).toBe('error')
  })

  it('stops after an invalid url', async () => {
    const fetchImpl = jest.fn()
    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local/path',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })
    expect(result.ok).toBe(false)
    expect(result.checks).toHaveLength(1)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports an invalid token without leaking the response body', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(new Response('denied', { status: 401 }))

    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })

    expect(result.ok).toBe(false)
    expect(result.checks.at(-1)).toMatchObject({
      name: 'search',
      ok: false,
      detail: '令牌无效',
    })
  })

  it('reports an oversized response instead of silently failing', async () => {
    const huge = new Response(
      JSON.stringify({
        status: 'empty',
        items: [],
        pad: 'x'.repeat(2 * 1024 * 1024),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(huge)

    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })

    expect(result.checks.at(-1)?.ok).toBe(false)
    expect(result.checks.at(-1)?.detail).toContain('响应体超过 1.0 MB')
  })

  it('hands the failing body snippet to the diagnostic callback', async () => {
    const html = new Response('404 page not found\n', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(html)
    const onDiagnostic = jest.fn()

    await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
      onDiagnostic,
    })

    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'search',
        status: 200,
        contentType: 'text/plain',
        snippet: '404 page not found',
      })
    )
  })

  it('calls an empty 200 response out explicitly', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      )

    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })

    expect(result.checks.at(-1)?.ok).toBe(false)
    expect(result.checks.at(-1)?.detail).toContain('响应为空（HTTP 200）')
  })

  it('flags a response that ignores the limit parameter', async () => {
    const items = Array.from({ length: 9 }, () => ({ blockId: 'x' }))
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'hit', items }), { status: 200 })
      )

    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })

    expect(result.checks.at(-1)?.ok).toBe(false)
    expect(result.checks.at(-1)?.detail).toContain('limit 参数未生效')
  })

  it('names the content type when the body is not JSON', async () => {
    const html = new Response('<html>bad gateway</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(html)

    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })

    expect(result.checks.at(-1)?.detail).toContain('text/html')
    expect(result.checks.at(-1)?.detail).toContain('不是 JSON')
  })

  it('reports an unexpected response shape', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(okHealth())
      .mockResolvedValueOnce(
        new Response('{"status":"weird"}', { status: 200 })
      )

    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })

    expect(result.checks.at(-1)?.ok).toBe(false)
    expect(result.checks.at(-1)?.detail).toContain('不符合检索服务约定')
  })

  it('reports a connection failure on healthz', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await probeKnowledgeBridge({
      origin: 'http://nas.local:8787',
      token: 't'.repeat(32),
      fetchImpl: fetchImpl as never,
    })
    expect(result.ok).toBe(false)
    expect(result.checks.at(-1)).toMatchObject({
      name: 'healthz',
      ok: false,
      detail: '无法连接检索服务',
    })
  })
})

describe('loadKnowledgeSource', () => {
  const SECRET = 's'.repeat(32)
  const TOKEN = 't'.repeat(40)
  const env = {
    KNOWLEDGE_ENABLED: '1',
    KNOWLEDGE_MODE: 'optional',
    KNOWLEDGE_AGENTS: 'main-agent',
    KNOWLEDGE_BRIDGE_URL: 'http://nas.local:8787',
    KNOWLEDGE_BRIDGE_TOKEN: 'e'.repeat(40),
  } as NodeJS.ProcessEnv

  const findUnique = jest.mocked(db.ragKnowledgeConfig.findUnique)

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'default',
    enabled: true,
    baseUrl: 'http://siyuan.local:6806',
    tokenCipher: encryptSecret(TOKEN, secretKeyFromEnv(SECRET)),
    provider: 'siyuan',
    mode: 'required',
    timeoutMs: 4000,
    agentSlugs: [],
    notebooks: ['20260806173656-2fkyn83'],
    pathPrefixes: ['团队/研发'],
    ...overrides,
  })

  beforeEach(() => {
    invalidateKnowledgeSourceCache()
    findUnique.mockReset()
    delete process.env.SETTINGS_SECRET
  })

  it('prefers the database row and decrypts the token', async () => {
    findUnique.mockResolvedValue(row() as never)
    process.env.SETTINGS_SECRET = SECRET

    const resolved = await loadKnowledgeSource('main-agent', env)

    expect(resolved).toMatchObject({
      status: 'ok',
      source: 'database',
      provider: 'siyuan',
      mode: 'required',
      origin: 'http://siyuan.local:6806',
      token: TOKEN,
      notebooks: ['20260806173656-2fkyn83'],
      pathPrefixes: ['团队/研发'],
    })
  })

  it('falls back to the bridge provider for an unknown provider value', async () => {
    findUnique.mockResolvedValue(row({ provider: 'dify' }) as never)
    process.env.SETTINGS_SECRET = SECRET

    const resolved = await loadKnowledgeSource('main-agent', env)
    expect(resolved).toMatchObject({ status: 'ok', provider: 'bridge' })
  })

  it('clamps the timeout into the allowed window', async () => {
    findUnique.mockResolvedValue(row({ timeoutMs: 99999 }) as never)
    process.env.SETTINGS_SECRET = SECRET

    const resolved = await loadKnowledgeSource('main-agent', env)
    expect(resolved).toMatchObject({ status: 'ok', timeoutMs: 4000 })
  })

  it('ignores the row when the agent is outside the whitelist', async () => {
    findUnique.mockResolvedValue(
      row({ agentSlugs: ['software-engineer-agent'] }) as never
    )
    process.env.SETTINGS_SECRET = SECRET

    const resolved = await loadKnowledgeSource('main-agent', env)
    expect(resolved).toEqual({ status: 'disabled', source: 'database' })
  })

  it('reports a config error when the stored token cannot be decrypted', async () => {
    findUnique.mockResolvedValue(
      row({ tokenCipher: 'v1.bad.bad.bad' }) as never
    )
    process.env.SETTINGS_SECRET = SECRET

    const resolved = await loadKnowledgeSource('main-agent', env)
    expect(resolved).toEqual({
      status: 'config_error',
      source: 'database',
      mode: 'required',
    })
  })

  it('uses the environment only when the row is disabled', async () => {
    findUnique.mockResolvedValue(row({ enabled: false }) as never)

    const resolved = await loadKnowledgeSource('main-agent', env)
    expect(resolved).toMatchObject({
      status: 'ok',
      source: 'env',
      provider: 'bridge',
      origin: 'http://nas.local:8787',
      token: 'e'.repeat(40),
    })
  })

  it('stays disabled when neither source is configured', async () => {
    findUnique.mockResolvedValue(null as never)

    const resolved = await loadKnowledgeSource('main-agent', {})
    expect(resolved).toEqual({ status: 'disabled', source: 'none' })
  })

  it('survives a database read failure by falling back to env', async () => {
    findUnique.mockRejectedValue(new Error('db down') as never)

    const resolved = await loadKnowledgeSource('main-agent', env)
    expect(resolved).toMatchObject({ status: 'ok', source: 'env' })
  })
})
