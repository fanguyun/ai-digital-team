jest.mock('src/lib/db', () => ({
  db: { ragKnowledgeConfig: { findUnique: jest.fn() } },
}))
jest.mock('src/lib/siyuanKnowledge', () => ({
  ...jest.requireActual('src/lib/siyuanKnowledge'),
  searchSiYuan: jest.fn(),
}))

import { db } from 'src/lib/db'
import { retrieveKnowledge } from 'src/lib/knowledgeRetrieval'
import { invalidateKnowledgeSourceCache } from 'src/lib/knowledgeSource'
import { encryptSecret, secretKeyFromEnv } from 'src/lib/secrets'
import * as siyuanKnowledge from 'src/lib/siyuanKnowledge'

const SECRET = 's'.repeat(32)
const TOKEN = 't'.repeat(40)
const NOTEBOOK = '20260806173656-2fkyn83'

const item = (documentPath: string) => ({
  blockId: '20260812102732-1ydpyes',
  documentId: '20260806173721-r1rwv54',
  notebookId: NOTEBOOK,
  title: '片段',
  documentPath,
  content: '正文',
  sourceUpdatedAt: null,
  retrievedAt: new Date().toISOString(),
  sourceUri: 'siyuan://blocks/20260812102732-1ydpyes',
  contentHash: 'a'.repeat(64),
  rankingMethod: 'siyuan-fulltext-v1' as const,
})

const originalSecret = process.env.SETTINGS_SECRET

describe('retrieveKnowledge provider dispatch', () => {
  const findUnique = jest.mocked(db.ragKnowledgeConfig.findUnique)
  const searchSiYuan = jest.mocked(siyuanKnowledge.searchSiYuan)

  beforeEach(() => {
    invalidateKnowledgeSourceCache()
    findUnique.mockReset()
    searchSiYuan.mockReset()
    process.env.SETTINGS_SECRET = SECRET
    findUnique.mockResolvedValue({
      id: 'default',
      enabled: true,
      baseUrl: 'http://siyuan.local:6806',
      tokenCipher: encryptSecret(TOKEN, secretKeyFromEnv(SECRET)),
      provider: 'siyuan',
      mode: 'optional',
      timeoutMs: 4000,
      agentSlugs: [],
      notebooks: [NOTEBOOK],
      pathPrefixes: ['团队'],
    } as never)
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SETTINGS_SECRET
    else process.env.SETTINGS_SECRET = originalSecret
  })

  it('routes to the siyuan adapter and applies the directory filter', async () => {
    searchSiYuan.mockResolvedValue({
      status: 'hit',
      items: [item('团队/研发/规范'), item('个人/笔记')],
    })

    const result = await retrieveKnowledge({
      agentSlug: 'main-agent',
      query: '任务',
    })

    expect(searchSiYuan).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'http://siyuan.local:6806',
        token: TOKEN,
        notebooks: [NOTEBOOK],
      })
    )
    expect(result.status).toBe('hit')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].documentPath).toBe('团队/研发/规范')
    expect(result.filteredOut).toBe(1)
  })

  it('returns an empty result when every fragment is out of scope', async () => {
    searchSiYuan.mockResolvedValue({
      status: 'hit',
      items: [item('个人/笔记')],
    })

    const result = await retrieveKnowledge({
      agentSlug: 'main-agent',
      query: '任务',
    })

    expect(result.status).toBe('empty')
    expect(result.items).toHaveLength(0)
    expect(result.filteredOut).toBe(1)
  })

  it('passes adapter failures through unchanged', async () => {
    searchSiYuan.mockResolvedValue({ status: 'auth_failed' })

    const result = await retrieveKnowledge({
      agentSlug: 'main-agent',
      query: '任务',
    })

    expect(result.status).toBe('auth_failed')
    expect(result.items).toEqual([])
  })

  it('skips retrieval entirely when the source is disabled', async () => {
    findUnique.mockResolvedValue({
      id: 'default',
      enabled: false,
      baseUrl: '',
      tokenCipher: null,
      provider: 'siyuan',
      mode: 'optional',
      timeoutMs: 4000,
      agentSlugs: [],
      notebooks: [],
      pathPrefixes: [],
    } as never)

    const result = await retrieveKnowledge({
      agentSlug: 'main-agent',
      query: '任务',
    })

    expect(result.status).toBe('disabled')
    expect(searchSiYuan).not.toHaveBeenCalled()
  })
})
