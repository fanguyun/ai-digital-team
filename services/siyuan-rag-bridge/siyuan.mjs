import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { URL } from 'node:url'

const ID = /^\d{14}-[a-z0-9]{7}$/
export class SourceError extends Error {
  constructor(status) {
    super(status)
    this.status = status
  }
}

export const bridgeConfig = (env = process.env) => {
  const url = new URL(env.SIYUAN_URL || '')
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('SIYUAN_URL must be an origin')
  const notebooks = [
    ...new Set(
      (env.SIYUAN_NOTEBOOK_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ]
  if (
    !notebooks.length ||
    notebooks.length > 20 ||
    notebooks.some((id) => !ID.test(id))
  )
    throw new Error('SIYUAN_NOTEBOOK_IDS must be an explicit allowlist')
  const token = env.SIYUAN_API_TOKEN || ''
  const accessToken = env.RAG_BRIDGE_TOKEN || ''
  if (!token || token.length > 512 || /\s/.test(token))
    throw new Error('SIYUAN_API_TOKEN is required')
  if (
    accessToken.length < 32 ||
    accessToken.length > 512 ||
    /\s/.test(accessToken) ||
    token === accessToken
  )
    throw new Error(
      'RAG_BRIDGE_TOKEN must be a separate secret of at least 32 characters'
    )
  return { url: url.origin, notebooks, token, accessToken }
}

const clean = (text, max) =>
  typeof text === 'string'
    ? text
        // 清除正文中的不可见控制字符，保留换行和制表符。
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .trim()
        .slice(0, max)
    : ''
const literal = (text) => `'${text.replaceAll("'", "''")}'`
const likeLiteral = (text) => literal(`%${text.replace(/[\\%_]/g, '\\$&')}%`)
const stopWords = new Set([
  '的',
  '了',
  '在',
  '是',
  '和',
  '与',
  '一个',
  '什么',
  '怎么',
  '如何',
  '请',
  '任务',
  'the',
  'and',
  'for',
  'what',
  'how',
])
export const keywords = (query) =>
  [
    ...new Set(
      [
        ...new Intl.Segmenter('zh', { granularity: 'word' }).segment(
          query.toLowerCase()
        ),
      ]
        .filter((part) => part.isWordLike)
        .map((part) => part.segment)
        .filter((part) => part.length > 1 && !stopWords.has(part))
    ),
  ].slice(0, 6)

/** 仅服务端生成固定 SELECT；调用方没有 SQL、URL、范围或 API 路径入口。 */
export const searchStatement = (notebooks, terms) => {
  const matches = terms.map(
    (term) => `lower(b.content) LIKE ${likeLiteral(term)} ESCAPE '\\'`
  )
  return `SELECT b.id, b.root_id, b.box, b.type, substr(b.content, 1, 1500) AS content, b.updated,
    substr(b.hpath, 1, 1000) AS hpath, substr(d.content, 1, 300) AS title,
    (${matches.map((match) => `CASE WHEN ${match} THEN 1 ELSE 0 END`).join(' + ')}) AS keyword_hits
    FROM blocks b JOIN blocks d ON d.id = b.root_id AND d.box = b.box AND d.type = 'd'
    WHERE b.box IN (${notebooks.map(literal).join(',')}) AND b.type IN ('d','h','p')
    AND (${matches.join(' OR ')}) ORDER BY keyword_hits DESC, b.updated DESC, b.id ASC LIMIT 120`
}

const readJson = async (response) => {
  if (Number(response.headers.get('content-length')) > 1024 * 1024)
    throw new SourceError('source_unavailable')
  const reader = response.body?.getReader()
  if (!reader) throw new SourceError('source_unavailable')
  let size = 0
  const chunks = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1024 * 1024) throw new SourceError('source_unavailable')
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  }
}

export const searchSiyuan = async (
  config,
  { query, limit },
  {
    fetchImpl = globalThis.fetch,
    signal = globalThis.AbortSignal.timeout(3000),
  } = {}
) => {
  const call = async (apiPath, payload) => {
    const response = await fetchImpl(`${config.url}${apiPath}`, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${config.token}`,
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new SourceError(
        [401, 403].includes(response.status)
          ? 'auth_failed'
          : 'source_unavailable'
      )
    }
    const body = await readJson(response)
    if (!body || body.code !== 0) throw new SourceError('source_unavailable')
    return body.data
  }
  try {
    // 每次核验，关闭或撤销共享范围不会被跨任务缓存掩盖。
    const list = await call('/api/notebook/lsNotebooks', {})
    if (
      !Array.isArray(list?.notebooks) ||
      config.notebooks.some(
        (id) =>
          !list.notebooks.some((nb) => nb.id === id && nb.closed === false)
      )
    )
      throw new SourceError('source_unavailable')
    const terms = keywords(query)
    if (!terms.length) return { status: 'empty', items: [] }
    const rows = await call('/api/query/sql', {
      stmt: searchStatement(config.notebooks, terms),
      mode: 'readonly',
    })
    if (!Array.isArray(rows) || rows.length > 120)
      throw new SourceError('source_unavailable')
    const items = []
    const seen = new Set()
    const documents = new Map()
    const retrievedAt = new Date().toISOString()
    for (const row of rows) {
      // 即使上游返回额外行，也必须重新校验范围和来源，整体失败关闭。
      if (
        !row ||
        !config.notebooks.includes(row.box) ||
        !ID.test(row.id) ||
        !ID.test(row.root_id) ||
        !['d', 'h', 'p'].includes(row.type)
      )
        throw new SourceError('source_unavailable')
      const content = clean(row.content, 1500)
      const title = clean(row.title, 300)
      if (
        !content ||
        !title ||
        seen.has(row.id) ||
        (documents.get(row.root_id) || 0) >= 2
      )
        continue
      seen.add(row.id)
      documents.set(row.root_id, (documents.get(row.root_id) || 0) + 1)
      items.push({
        blockId: row.id,
        documentId: row.root_id,
        notebookId: row.box,
        title,
        documentPath: clean(row.hpath, 1000),
        content,
        sourceUpdatedAt:
          typeof row.updated === 'string' && /^\d{14}$/.test(row.updated)
            ? row.updated
            : null,
        retrievedAt,
        sourceUri: `siyuan://blocks/${row.id}`,
        contentHash: createHash('sha256').update(content).digest('hex'),
        rankingMethod: 'keyword-hit-count-v1',
      })
    }
    return {
      status: items.length ? 'hit' : 'empty',
      items: items.slice(0, Math.min(6, limit)),
    }
  } catch (error) {
    if (signal.aborted) throw new SourceError('timeout')
    throw error instanceof SourceError
      ? error
      : new SourceError('source_unavailable')
  }
}
