import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'

import { bridgeConfig, searchSiyuan, searchStatement } from './siyuan.mjs'

const notebook = '20261120000000-aaaaaaa'
const doc = '20261120000000-bbbbbbb'
const block = '20261120000000-ccccccc'
const config = {
  url: 'http://siyuan',
  token: 'source-only',
  accessToken: 'a'.repeat(32),
  notebooks: [notebook],
}
const row = {
  id: block,
  root_id: doc,
  box: notebook,
  type: 'p',
  content: '部署规范内容',
  title: '部署规范',
  hpath: '/工作库/部署规范',
  updated: '20261120000000',
}
const search = (
  rows = [row],
  notebooks = [{ id: notebook, closed: false }],
  query = '部署规范'
) => {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return new globalThis.Response(
      JSON.stringify({
        code: 0,
        data: url.endsWith('lsNotebooks') ? { notebooks } : rows,
      })
    )
  }
  return {
    calls,
    run: () => searchSiyuan(config, { query, limit: 6 }, { fetchImpl }),
  }
}

test('configuration denies empty allowlists, credential reuse and userinfo URLs', () => {
  const env = {
    SIYUAN_URL: 'http://nas:6806',
    SIYUAN_API_TOKEN: 'source-only',
    SIYUAN_NOTEBOOK_IDS: notebook,
    RAG_BRIDGE_TOKEN: 'a'.repeat(32),
  }
  assert.deepEqual(bridgeConfig(env).notebooks, [notebook])
  for (const patch of [
    { SIYUAN_NOTEBOOK_IDS: '' },
    { SIYUAN_NOTEBOOK_IDS: "x' OR 1=1" },
    { RAG_BRIDGE_TOKEN: 'source-only' },
    { SIYUAN_URL: 'http://user:pass@nas' },
  ]) {
    assert.throws(() => bridgeConfig({ ...env, ...patch }))
  }
})
test('only calls fixed read endpoints with source authentication and readonly mode', async () => {
  const { calls, run } = search()
  const result = await run()
  assert.equal(result.status, 'hit')
  assert.equal(result.items[0].sourceUri, `siyuan://blocks/${block}`)
  assert.equal(
    result.items[0].contentHash,
    createHash('sha256').update(row.content).digest('hex')
  )
  assert.deepEqual(
    calls.map((call) => call.url),
    ['http://siyuan/api/notebook/lsNotebooks', 'http://siyuan/api/query/sql']
  )
  assert.ok(
    calls.every(
      (call) =>
        call.init.headers.Authorization === 'Token source-only' &&
        call.init.redirect === 'error'
    )
  )
  assert.equal(JSON.parse(calls[1].init.body).mode, 'readonly')
  assert.ok(JSON.parse(calls[1].init.body).stmt.includes(notebook))
})
test('rejects closed, missing and unauthorized notebooks instead of treating them as empty', async () => {
  for (const notebooks of [
    [],
    [{ id: notebook, closed: true }],
    [{ id: notebook }],
  ]) {
    const { run, calls } = search([row], notebooks)
    await assert.rejects(run, { status: 'source_unavailable' })
    assert.equal(calls.length, 1)
  }
  await assert.rejects(
    search([{ ...row, box: '20261120000000-outside' }]).run,
    { status: 'source_unavailable' }
  )
  await assert.rejects(search([{ ...row, type: 'query_embed' }]).run, {
    status: 'source_unavailable',
  })
})
test('handles empty results, duplicates, limits and missing update time without expansion', async () => {
  assert.equal((await search([]).run()).status, 'empty')
  const { calls, run } = search(
    Array.from({ length: 6 }, (_, index) => ({
      ...row,
      id: `20261120000000-ccccc${index}x`,
      updated: null,
      content: '文'.repeat(3000),
    }))
  )
  const result = await run()
  assert.equal(result.items.length, 2)
  assert.equal(result.items[0].content.length, 1500)
  assert.equal(result.items[0].sourceUpdatedAt, null)
  assert.equal(calls.length, 2)
  assert.equal((await search([row, row]).run()).items.length, 1)
})
test('each call reads current rows, so deleted and moved blocks cannot be cached', async () => {
  let rows = [row]
  const fetchImpl = async (url) =>
    new globalThis.Response(
      JSON.stringify({
        code: 0,
        data: url.endsWith('lsNotebooks')
          ? { notebooks: [{ id: notebook, closed: false }] }
          : rows,
      })
    )
  assert.equal(
    (await searchSiyuan(config, { query: '部署', limit: 6 }, { fetchImpl }))
      .status,
    'hit'
  )
  rows = []
  assert.equal(
    (await searchSiyuan(config, { query: '部署', limit: 6 }, { fetchImpl }))
      .status,
    'empty'
  )
  rows = [{ ...row, box: '20261120000000-outside' }]
  await assert.rejects(
    () => searchSiyuan(config, { query: '部署', limit: 6 }, { fetchImpl }),
    { status: 'source_unavailable' }
  )
})
test('checks business code and maps network, auth and total deadline failures without upstream text', async () => {
  for (const response of [
    new globalThis.Response(JSON.stringify({ code: -1, msg: 'secret' })),
    new globalThis.Response('secret', { status: 401 }),
    new globalThis.Response('invalid'),
  ]) {
    await assert.rejects(
      () =>
        searchSiyuan(
          config,
          { query: '部署', limit: 6 },
          { fetchImpl: async () => response }
        ),
      (error) => !error.message.includes('secret')
    )
  }
  await assert.rejects(
    () =>
      searchSiyuan(
        config,
        { query: '部署', limit: 6 },
        {
          signal: globalThis.AbortSignal.abort(),
          fetchImpl: async () => {
            throw new Error('aborted')
          },
        }
      ),
    { status: 'timeout' }
  )
})
test('SQL escapes quotes and LIKE wildcard characters as literal text in SQLite', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(
    'CREATE TABLE blocks (id TEXT, root_id TEXT, box TEXT, type TEXT, content TEXT, updated TEXT, hpath TEXT)'
  )
  const insert = db.prepare('INSERT INTO blocks VALUES (?, ?, ?, ?, ?, ?, ?)')
  insert.run(doc, doc, notebook, 'd', '规范', '20261120000000', '/规范')
  insert.run(
    block,
    doc,
    notebook,
    'p',
    "100%_\\' OR 1=1 --",
    '20261120000000',
    '/规范'
  )
  insert.run(
    'outside',
    'outside',
    'private',
    'd',
    "100%_\\' OR 1=1 --",
    '20261120000000',
    '/秘密'
  )
  const hits = db
    .prepare(searchStatement([notebook], ["100%_\\' OR 1=1 --"]))
    .all()
  assert.deepEqual(
    hits.map((hit) => hit.id),
    [block]
  )
  assert.equal(db.prepare('SELECT count(*) AS n FROM blocks').get().n, 3)
  db.close()
})
