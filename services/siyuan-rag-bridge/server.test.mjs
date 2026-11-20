import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Readable, Writable } from 'node:stream'
import { test } from 'node:test'

import { createBridgeServer } from './server.mjs'
import { SourceError } from './siyuan.mjs'

const token = 't'.repeat(32)
const withServer = async (
  run,
  search = async () => ({ status: 'empty', items: [] })
) => {
  const server = createBridgeServer({ accessToken: token }, { search })
  // 直接调用真实 HTTP 处理器，以便受限环境无需开放监听端口。
  const request = async (url, { method = 'GET', auth = '', body } = {}) => {
    const req = Readable.from(
      body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
    )
    Object.assign(req, {
      url,
      method,
      headers: { authorization: auth, 'content-type': 'application/json' },
    })
    const chunks = []
    const res = new Writable({
      write(chunk, _encoding, done) {
        chunks.push(chunk)
        done()
      },
    })
    res.writeHead = (status) => {
      res.statusCode = status
    }
    await server.listeners('request')[0](req, res)
    return {
      status: res.statusCode,
      json: async () => JSON.parse(Buffer.concat(chunks).toString()),
    }
  }
  const post = (body, auth = `Bearer ${token}`) =>
    request('/v1/search', { method: 'POST', auth, body })
  await run({ request, post })
}
test('health is liveness only; authentication is required for search', () =>
  withServer(async ({ request, post }) => {
    assert.deepEqual(await (await request('/healthz')).json(), { status: 'ok' })
    assert.equal(
      (await post({ query: '部署' }, 'Token source-only')).status,
      401
    )
    assert.equal(
      (await request('/api/query/sql', { method: 'POST' })).status,
      404
    )
  }))
test('accepts only query and bounded limit, not SQL, secrets, URLs or scope overrides', () =>
  withServer(async ({ post }) => {
    assert.equal((await post({ query: '部署', limit: 4 })).status, 200)
    for (const body of [
      null,
      [],
      {},
      { query: '' },
      { query: 'x'.repeat(301) },
      { query: '部署', limit: 7 },
      { query: '部署', limit: 0 },
      { query: '部署', stmt: 'SELECT *' },
      { query: '部署', notebookIds: ['private'] },
      { query: '部署', url: 'http://evil' },
      { query: '部署', token: 'secret' },
    ]) {
      assert.equal((await post(body)).status, 400, JSON.stringify(body))
    }
    assert.equal((await post({ query: 'x'.repeat(5000) })).status, 413)
  }))
test('returns explicit safe failure types without upstream error messages', () =>
  withServer(
    async ({ post }) => {
      assert.deepEqual(await (await post({ query: '部署' })).json(), {
        status: 'timeout',
        items: [],
      })
    },
    async () => {
      throw new SourceError('timeout')
    }
  ))
