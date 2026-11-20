import { db } from 'src/lib/db'

import {
  clearRagKnowledgeSource,
  ragKnowledgeSource,
  saveRagKnowledgeSource,
  testRagKnowledgeSource,
} from './knowledge'

const VALID_TOKEN = 't'.repeat(40)
const originalSecret = process.env.SETTINGS_SECRET

beforeAll(() => {
  process.env.SETTINGS_SECRET = 's'.repeat(32)
})

afterAll(() => {
  if (originalSecret === undefined) delete process.env.SETTINGS_SECRET
  else process.env.SETTINGS_SECRET = originalSecret
})

beforeEach(async () => {
  await db.ragKnowledgeConfig.deleteMany()
})

const save = (input: Record<string, unknown>) =>
  saveRagKnowledgeSource({
    input: {
      enabled: true,
      baseUrl: 'http://nas.local:8787',
      token: VALID_TOKEN,
      mode: 'optional',
      timeoutMs: 4000,
      agentSlugs: [],
      pathPrefixes: [],
      ...input,
    },
  })

describe('knowledge source config', () => {
  it('stores a token encrypted and never returns it', async () => {
    const view = await save({ agentSlugs: ['main-agent'] })

    expect(view.hasToken).toBe(true)
    expect(view.tokenHint).toBe('••••tttt')
    expect(JSON.stringify(view)).not.toContain(VALID_TOKEN)

    const row = await db.ragKnowledgeConfig.findUniqueOrThrow({
      where: { id: 'default' },
    })
    expect(row.tokenCipher).toMatch(/^v1\./)
    expect(row.tokenCipher).not.toContain(VALID_TOKEN)
    expect(row.agentSlugs).toEqual(['main-agent'])
    expect(view.configSource).toBe('database')
  })

  it('keeps the existing token when token is omitted and clears it on empty string', async () => {
    const first = await save({})
    const rowBefore = await db.ragKnowledgeConfig.findUniqueOrThrow({
      where: { id: 'default' },
    })

    await saveRagKnowledgeSource({
      input: {
        enabled: true,
        baseUrl: 'http://nas.local:8787',
        mode: 'optional',
        timeoutMs: 4000,
        agentSlugs: [],
        pathPrefixes: [],
      },
    })
    const rowKept = await db.ragKnowledgeConfig.findUniqueOrThrow({
      where: { id: 'default' },
    })
    expect(rowKept.tokenCipher).toBe(rowBefore.tokenCipher)

    // 清除令牌必须同时停用，否则保留启用状态会变成"无令牌启用"
    await expect(save({ token: '' })).rejects.toThrow('必须同时关闭启用开关')
    const cleared = await save({ enabled: false, token: '' })
    expect(cleared.hasToken).toBe(false)
    expect(cleared.tokenHint).toBeNull()
    expect(first.hasToken).toBe(true)
  })

  it.each([
    [{ baseUrl: 'http://nas.local/path' }, '不要带路径'],
    [{ baseUrl: 'ftp://nas.local' }, '只支持 http/https'],
    [{ token: 'x'.repeat(513) }, '不能超过 512 个字符'],
    [{ mode: 'sometimes' }, null],
    [{ agentSlugs: ['nobody-agent'] }, '岗位不存在'],
    [{ pathPrefixes: ['../etc'] }, '不能包含 ..'],
    [
      { pathPrefixes: Array.from({ length: 21 }, (_, i) => `d${i}`) },
      '最多 20 条',
    ],
  ])('rejects invalid input %p', async (override, message) => {
    const promise = save(override)
    if (message) await expect(promise).rejects.toThrow(message)
    else await expect(promise).resolves.toMatchObject({ mode: 'optional' })
  })

  it('stores directory prefixes without surrounding slashes', async () => {
    const view = await save({
      enabled: false,
      pathPrefixes: ['/团队/研发/', '个人/笔记'],
    })
    expect(view.pathPrefixes).toEqual(['团队/研发', '个人/笔记'])
  })

  it('accepts a short non-empty token', async () => {
    const view = await save({ token: 'short-token' })
    expect(view.hasToken).toBe(true)
    expect(view.tokenHint).toBe('••••oken')
  })

  it('requires a token when enabled', async () => {
    await expect(
      saveRagKnowledgeSource({
        input: {
          enabled: true,
          baseUrl: 'http://nas.local:8787',
        },
      })
    ).rejects.toThrow('需要填写访问令牌')
  })

  it('falls back to env when no database config exists', async () => {
    const previous = process.env.KNOWLEDGE_ENABLED
    process.env.KNOWLEDGE_ENABLED = '1'
    try {
      const view = await ragKnowledgeSource()
      expect(view.enabled).toBe(false)
      expect(view.configSource).toBe('env')
    } finally {
      if (previous === undefined) delete process.env.KNOWLEDGE_ENABLED
      else process.env.KNOWLEDGE_ENABLED = previous
    }
  })

  it('clears the config so env takes over again', async () => {
    await save({})
    const cleared = await clearRagKnowledgeSource()
    expect(cleared.hasToken).toBe(false)
    expect(await db.ragKnowledgeConfig.count()).toBe(0)
  })
})

describe('provider settings', () => {
  it('stores the siyuan provider with notebook whitelist', async () => {
    const view = await save({
      provider: 'siyuan',
      notebooks: ['20260806173656-2fkyn83'],
    })
    expect(view.provider).toBe('siyuan')
    expect(view.notebooks).toEqual(['20260806173656-2fkyn83'])
  })

  it('falls back to bridge for an unknown provider', async () => {
    const view = await save({ provider: 'whatever' })
    expect(view.provider).toBe('bridge')
  })

  it('rejects a malformed notebook id', async () => {
    await expect(save({ notebooks: ['not-a-notebook'] })).rejects.toThrow(
      '笔记本 ID 格式不正确'
    )
  })

  it('tests a siyuan connection through version and search endpoints', async () => {
    await save({ provider: 'siyuan' })
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: '3.8.4' }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { blocks: [] } }), {
          status: 200,
        })
      )

    const result = await testRagKnowledgeSource({
      currentUser: { username: 'fan' },
    })

    expect(result.ok).toBe(true)
    expect(result.checks.map((check) => check.name)).toEqual([
      'url',
      'auth',
      'search',
    ])
    const [firstUrl, firstInit] = fetchSpy.mock.calls[0]
    expect(String(firstUrl)).toContain('/api/system/version')
    expect((firstInit as RequestInit).headers).toMatchObject({
      Authorization: expect.stringMatching(/^Token /),
    })
    fetchSpy.mockRestore()
  })
})

describe('test connection', () => {
  const okHealth = () => new Response('{}', { status: 200 })
  const okSearch = () =>
    new Response(JSON.stringify({ status: 'empty', items: [] }), {
      status: 200,
    })

  it('probes the saved origin and records the result', async () => {
    await save({})
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(okHealth() as never)
      .mockResolvedValueOnce(okSearch() as never)

    const result = await testRagKnowledgeSource({
      currentUser: { username: 'fan' },
    })

    expect(result.ok).toBe(true)
    expect(result.checks).toHaveLength(3)
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://nas.local:8787/v1/search',
      expect.objectContaining({ method: 'POST' })
    )

    const row = await db.ragKnowledgeConfig.findUniqueOrThrow({
      where: { id: 'default' },
    })
    expect(row.lastTestStatus).toBe('ok')
    expect(row.lastTestAt).toBeTruthy()
    fetchSpy.mockRestore()
  })

  it('refuses to test before anything is saved', async () => {
    await expect(
      testRagKnowledgeSource({ currentUser: { username: 'fan' } })
    ).rejects.toThrow('请先保存')
  })
})
