import { createHash } from 'node:crypto'

import { retrieveKnowledge } from './knowledgeRetrieval'

export const item = {
  blockId: '20261120000000-aaaaaaa',
  documentId: '20261120000000-bbbbbbb',
  notebookId: '20261120000000-ccccccc',
  title: '部署规范',
  documentPath: '/部署规范',
  content: '部署前核对审批记录。',
  sourceUpdatedAt: '20261120000000',
  retrievedAt: '2026-11-20T00:00:00.000Z',
  sourceUri: 'siyuan://blocks/20261120000000-aaaaaaa',
  contentHash: createHash('sha256')
    .update('部署前核对审批记录。')
    .digest('hex'),
  rankingMethod: 'keyword-hit-count-v1' as const,
}
describe('retrieveKnowledge', () => {
  const originalEnv = process.env
  let fetchMock: jest.SpyInstance
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KNOWLEDGE_ENABLED: '1',
      KNOWLEDGE_AGENTS: 'main-agent',
      KNOWLEDGE_MODE: 'required',
      KNOWLEDGE_BRIDGE_URL: 'http://nas.local:8787',
      KNOWLEDGE_BRIDGE_TOKEN: 'x'.repeat(32),
      KNOWLEDGE_TIMEOUT_MS: '100',
    }
    fetchMock = jest.spyOn(globalThis, 'fetch')
  })
  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })
  const retrieve = () =>
    retrieveKnowledge({ agentSlug: 'main-agent', query: '部署审批' })
  it('does not call the network when disabled or outside the pilot', async () => {
    process.env.KNOWLEDGE_ENABLED = '0'
    expect((await retrieve()).status).toBe('disabled')
    process.env.KNOWLEDGE_ENABLED = '1'
    expect(
      (await retrieveKnowledge({ agentSlug: 'other-agent', query: 'test' }))
        .status
    ).toBe('disabled')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('posts only a bounded query once with independent authentication', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'hit', items: [item] }))
    )
    expect((await retrieve()).items).toEqual([item])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://nas.local:8787/v1/search')
    expect(init.redirect).toBe('error')
    expect(init.headers.Authorization).toBe(`Bearer ${'x'.repeat(32)}`)
    expect(JSON.parse(init.body)).toEqual({ query: '部署审批', limit: 6 })
  })
  it.each(['empty', 'timeout', 'auth_failed', 'source_unavailable'])(
    'preserves the bridge status %s',
    async (status) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ status, items: [] }))
      )
      expect((await retrieve()).status).toBe(status)
    }
  )
  it('rejects malformed responses and forged references', async () => {
    for (const body of [
      'not json',
      JSON.stringify({ status: 'hit', items: [] }),
      JSON.stringify({
        status: 'hit',
        items: [{ ...item, sourceUri: 'http://evil' }],
      }),
      JSON.stringify({
        status: 'hit',
        items: [{ ...item, contentHash: 'fake' }],
      }),
    ]) {
      fetchMock.mockResolvedValue(new Response(body))
      expect((await retrieve()).status).toBe('invalid_response')
    }
  })
  it('limits streamed responses even without content-length', async () => {
    fetchMock.mockResolvedValue(new Response('x'.repeat(256 * 1024 + 1)))
    expect((await retrieve()).status).toBe('invalid_response')
  })
  it('maps authentication and network errors without returning their text', async () => {
    fetchMock.mockResolvedValue(
      new Response('secret upstream', { status: 401 })
    )
    expect((await retrieve()).status).toBe('auth_failed')
    fetchMock.mockRejectedValue(new Error('secret upstream'))
    expect(JSON.stringify(await retrieve())).not.toContain('secret')
    expect((await retrieve()).status).toBe('source_unavailable')
  })
  it('aborts at the total timeout with no retry', async () => {
    process.env.KNOWLEDGE_TIMEOUT_MS = '5'
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('aborted'))
          )
        })
    )
    expect((await retrieve()).status).toBe('timeout')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('reports configuration errors and fails closed for unknown modes', async () => {
    process.env.KNOWLEDGE_MODE = 'requred'
    expect(await retrieve()).toMatchObject({
      status: 'config_error',
      mode: 'required',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
