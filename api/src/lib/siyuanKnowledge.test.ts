import { createHash } from 'node:crypto'

import {
  listSiYuanNotebooks,
  probeSiYuan,
  searchSiYuan,
} from './siyuanKnowledge'

const BLOCK_ID = '20260812102732-1ydpyes'
const DOC_ID = '20260806173721-r1rwv54'
const NOTEBOOK_ID = '20260806173656-2fkyn83'

const siyuanBody = (blocks: unknown[]) =>
  new Response(JSON.stringify({ code: 0, msg: '', data: { blocks } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const block = (overrides: Record<string, unknown> = {}) => ({
  box: NOTEBOOK_ID,
  rootID: DOC_ID,
  id: BLOCK_ID,
  hPath: '/底层规律知识库/022 达克效应',
  markdown: '在某些<mark>任务</mark>中，能力不足的人可能高估自己的表现。',
  ...overrides,
})

describe('searchSiYuan', () => {
  it('maps blocks into knowledge items with stripped highlights', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(siyuanBody([block()]))

    const outcome = await searchSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 'token-value',
      query: '任务',
      fetchImpl: fetchImpl as never,
    })

    expect(outcome.status).toBe('hit')
    if (outcome.status !== 'hit') return
    const [item] = outcome.items
    expect(item.blockId).toBe(BLOCK_ID)
    expect(item.documentId).toBe(DOC_ID)
    expect(item.notebookId).toBe(NOTEBOOK_ID)
    expect(item.title).toBe('022 达克效应')
    expect(item.documentPath).toBe('/底层规律知识库/022 达克效应')
    expect(item.content).not.toContain('<mark>')
    expect(item.sourceUri).toBe(`siyuan://blocks/${BLOCK_ID}`)
    expect(item.rankingMethod).toBe('siyuan-fulltext-v1')
    expect(item.contentHash).toBe(
      createHash('sha256').update(item.content).digest('hex')
    )

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://siyuan.local:6806/api/search/fullTextSearchBlock')
    // 思源要求 Token 方案，不是 Bearer
    expect(init.headers.Authorization).toBe('Token token-value')
    expect(JSON.parse(init.body)).toMatchObject({ query: '任务', size: 6 })
  })

  it('drops blocks outside the notebook whitelist', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      siyuanBody([
        block(),
        block({
          id: '20260101000000-abcdefg',
          box: '20250101000000-zzzzzzz',
        }),
      ])
    )

    const outcome = await searchSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 't',
      query: '任务',
      notebooks: [NOTEBOOK_ID],
      fetchImpl: fetchImpl as never,
    })

    expect(outcome.status).toBe('hit')
    if (outcome.status !== 'hit') return
    expect(outcome.items).toHaveLength(1)
    expect(outcome.items[0].notebookId).toBe(NOTEBOOK_ID)
  })

  it('reports auth failure on 401', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('', { status: 401 }))
    const outcome = await searchSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 'bad',
      query: '任务',
      fetchImpl: fetchImpl as never,
    })
    expect(outcome.status).toBe('auth_failed')
  })

  it('stops reading once the response exceeds the size cap', async () => {
    // 没有 content-length 的流式响应：必须边读边计数，不能先 text() 再判断
    let pulled = 0
    const chunk = new Uint8Array(64 * 1024)
    const stream = new ReadableStream({
      pull(controller) {
        pulled += chunk.byteLength
        controller.enqueue(chunk)
      },
    })
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response(stream, { status: 200 }))

    const outcome = await searchSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 't',
      query: '任务',
      fetchImpl: fetchImpl as never,
    })

    expect(outcome.status).toBe('invalid_response')
    // 只读了刚过上限的那几块，没有把整条流读完
    expect(pulled).toBeLessThan(1024 * 1024)
  })

  it('rejects a non-siYuan payload', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('{"code":-1}', { status: 200 }))
    const outcome = await searchSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 't',
      query: '任务',
      fetchImpl: fetchImpl as never,
    })
    expect(outcome.status).toBe('invalid_response')
  })

  it('returns empty for an empty query without calling upstream', async () => {
    const fetchImpl = jest.fn()
    const outcome = await searchSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 't',
      query: '   ',
      fetchImpl: fetchImpl as never,
    })
    expect(outcome.status).toBe('empty')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('listSiYuanNotebooks', () => {
  it('lists notebooks with ids and names', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            notebooks: [
              { id: NOTEBOOK_ID, name: '底层规律知识库', closed: false },
              { id: 'bad-id', name: '脏数据' },
            ],
          },
        }),
        { status: 200 }
      )
    )

    const result = await listSiYuanNotebooks({
      origin: 'http://siyuan.local:6806',
      token: 't',
      fetchImpl: fetchImpl as never,
    })

    expect(result.ok).toBe(true)
    expect(result.notebooks).toEqual([
      { id: NOTEBOOK_ID, name: '底层规律知识库', closed: false },
    ])
  })

  it('reports an invalid token', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('', { status: 403 }))
    const result = await listSiYuanNotebooks({
      origin: 'http://siyuan.local:6806',
      token: 'bad',
      fetchImpl: fetchImpl as never,
    })
    expect(result).toMatchObject({ ok: false, error: '令牌无效' })
  })
})

describe('probeSiYuan', () => {
  it('passes when version and search both answer in SiYuan shape', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: '3.8.4' }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(siyuanBody([]))

    const result = await probeSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 't',
      fetchImpl: fetchImpl as never,
    })

    expect(result.ok).toBe(true)
    expect(result.checks.map((check) => check.name)).toEqual([
      'url',
      'auth',
      'search',
    ])
    expect(result.checks[1].detail).toContain('3.8.4')
  })

  it('stops at the auth check when the token is rejected', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))

    const result = await probeSiYuan({
      origin: 'http://siyuan.local:6806',
      token: 'bad',
      fetchImpl: fetchImpl as never,
    })

    expect(result.ok).toBe(false)
    expect(result.checks.at(-1)).toMatchObject({ name: 'auth', ok: false })
  })
})
