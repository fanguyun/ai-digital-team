import { Buffer } from 'node:buffer'
import console from 'node:console'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { pathToFileURL } from 'node:url'

import { bridgeConfig, searchSiyuan, SourceError } from './siyuan.mjs'

const digest = (value) => createHash('sha256').update(value).digest()
const send = (response, code, body) => {
  response.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

export const createBridgeServer = (config, { search = searchSiyuan } = {}) => {
  let active = 0
  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/healthz')
      return send(response, 200, { status: 'ok' })
    if (request.method !== 'POST' || request.url !== '/v1/search')
      return send(response, 404, { status: 'not_found', items: [] })
    if (
      !timingSafeEqual(
        digest(request.headers.authorization || ''),
        digest(`Bearer ${config.accessToken}`)
      )
    ) {
      request.resume()
      return send(response, 401, { status: 'auth_failed', items: [] })
    }
    if (active >= 8) {
      request.resume()
      return send(response, 503, { status: 'source_unavailable', items: [] })
    }
    active++
    const controller = new globalThis.AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      if (!response.writableEnded)
        send(response, 200, { status: 'timeout', items: [] })
      request.destroy()
    }, 3000)
    try {
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          request.headers['content-type'] || ''
        )
      ) {
        request.resume()
        return send(response, 415, { status: 'invalid_request', items: [] })
      }
      let size = 0
      const chunks = []
      for await (const chunk of request) {
        size += chunk.length
        if (size > 4096) {
          send(response, 413, { status: 'invalid_request', items: [] })
          request.resume()
          return
        }
        chunks.push(chunk)
      }
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        return send(response, 400, { status: 'invalid_request', items: [] })
      }
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => !['query', 'limit'].includes(key)) ||
        typeof body.query !== 'string' ||
        !body.query.trim() ||
        body.query.length > 300 ||
        (body.limit !== undefined &&
          (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 6))
      ) {
        return send(response, 400, { status: 'invalid_request', items: [] })
      }
      const result = await search(
        config,
        { query: body.query, limit: body.limit ?? 6 },
        { signal: controller.signal }
      )
      if (!response.writableEnded) send(response, 200, result)
    } catch (error) {
      if (!response.writableEnded)
        send(response, 200, {
          status:
            error instanceof SourceError ? error.status : 'source_unavailable',
          items: [],
        })
    } finally {
      active--
      clearTimeout(timer)
    }
  })
  server.requestTimeout = 5000
  server.headersTimeout = 5000
  server.maxHeadersCount = 20
  return server
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const server = createBridgeServer(bridgeConfig())
    server.listen(8787, '0.0.0.0', () =>
      console.log('siyuan-rag-bridge listening on :8787')
    )
  } catch {
    console.error('siyuan-rag-bridge: invalid deployment configuration')
    process.exitCode = 1
  }
}
