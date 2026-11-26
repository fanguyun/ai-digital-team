import { createHash } from 'node:crypto'

import type { KnowledgeItem, KnowledgeStatus } from './knowledgeRetrieval'

/** 直连思源：只用只读接口，不发送 SQL，不接受调用方传入的语句 */
export const SIYUAN_ADAPTER_VERSION = 'siyuan-fulltext-v2'
const MAX_RESPONSE_BYTES = 256 * 1024
const MAX_ITEMS = 6
const MAX_CONTENT_LENGTH = 1500
const PROBE_TIMEOUT_MS = 2000

type SiYuanBlock = {
  type?: string
  id?: string
  box?: string
  rootID?: string
  hPath?: string
  path?: string
  content?: string
  markdown?: string
  name?: string
  updated?: string
}

export type SiYuanSearchOutcome =
  | { status: 'hit'; items: KnowledgeItem[] }
  | { status: Exclude<KnowledgeStatus, 'hit' | 'disabled'> }

const idPattern = /^\d{14}-[a-z0-9]{7}$/

const queryStopwords = new Set(
  '根据 已有 知识 知识库 笔记 文档 请 帮 帮我 整理 生成 一份 本周 行动 清单 如何 怎样 怎么 什么 为什么 哪些 是否 一个 可以 需要 进行 关于 结合 避免 变成 判断 值得 继续 的 了 和 与 把 还 我'.split(
    ' '
  )
)

/** 仅提取字面关键词，不生成查询语法或 SQL；短语和块 ID 保持原样。 */
export const siyuanKeywordQuery = (query: string) => {
  const bounded = query.trim().slice(0, 300)
  if (idPattern.test(bounded)) return bounded
  const words = [
    ...new Intl.Segmenter('zh', { granularity: 'word' }).segment(bounded),
  ]
    .filter((part) => part.isWordLike)
    .map((part) => part.segment)
  if (words.length <= 2 && !/[，。？！?！\s]/.test(bounded)) return bounded
  return [
    ...new Set(
      words.filter((word) => word.length >= 2 && !queryStopwords.has(word))
    ),
  ]
    .slice(0, 6)
    .join(' ')
}

const decodeEntities = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** 去掉思源命中高亮的 <mark>，并把正文压成单段短文本 */
const plain = (value: unknown, max = MAX_CONTENT_LENGTH) => {
  if (typeof value !== 'string') return ''
  const stripped = decodeEntities(value.replace(/<\/?mark>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.slice(0, max)
}

const titleOf = (block: SiYuanBlock) => {
  const hPath = (block.hPath || '').trim()
  const last = hPath.split('/').filter(Boolean).pop()
  return plain(last || block.name || block.id, 300)
}

type LimitedJson =
  | { ok: true; body: unknown }
  | { ok: false; reason: 'too_large' | 'no_body' | 'invalid_json' }

/**
 * 边读边计数，超过上限立刻取消，避免大响应把内存顶起来。
 * 不能先 text() 再判断长度——那样上限等于没设（chunked/流式响应没有 content-length）。
 */
const readLimitedJson = async (response: Response): Promise<LimitedJson> => {
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    await response.body?.cancel()
    return { ok: false, reason: 'too_large' }
  }

  const reader = response.body?.getReader()
  if (!reader) return { ok: false, reason: 'no_body' }

  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      return { ok: false, reason: 'too_large' }
    }
    chunks.push(value)
  }

  try {
    return {
      ok: true,
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
    }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
}

const withTimeout = async <T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>
) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

const authHeader = (token: string) => ({ Authorization: `Token ${token}` })

/**
 * 思源全文检索：只读接口 POST /api/search/fullTextSearchBlock。
 * 结果按 box（笔记本）与文档路径过滤后映射成统一片段结构。
 */
export const searchSiYuan = async ({
  origin,
  token,
  query,
  timeoutMs = 4000,
  notebooks = [],
  fetchImpl = fetch,
}: {
  origin: string
  token: string
  query: string
  timeoutMs?: number
  notebooks?: string[]
  fetchImpl?: typeof fetch
}): Promise<SiYuanSearchOutcome> => {
  const keywords = siyuanKeywordQuery(query)
  if (!keywords) return { status: 'empty' }

  try {
    const { response, parsed } = await withTimeout(
      timeoutMs,
      async (signal) => {
        const response = await fetchImpl(
          `${origin}/api/search/fullTextSearchBlock`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader(token),
            },
            body: JSON.stringify({
              query: keywords,
              page: 1,
              pageSize: MAX_ITEMS,
              boxes: notebooks,
              method: 0,
              orderBy: 7,
              groupBy: 0,
            }),
            redirect: 'error',
            signal,
          }
        )
        return {
          response,
          parsed: response.ok ? await readLimitedJson(response) : null,
        }
      }
    )

    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel()
      return { status: 'auth_failed' }
    }
    if (!response.ok) {
      await response.body?.cancel()
      return { status: 'source_unavailable' }
    }

    if (!parsed?.ok) return { status: 'invalid_response' }
    const body = parsed.body as {
      code?: number
      data?: { blocks?: SiYuanBlock[] }
    }
    if (body?.code !== 0 || !Array.isArray(body.data?.blocks)) {
      return { status: 'invalid_response' }
    }

    const now = new Date().toISOString()
    const items: KnowledgeItem[] = []
    // 标题与正文可能一并命中。先给模型正文，避免每文档的片段额度被标题占满。
    // 同类块保留思源的相关度顺序；只有标题命中时仍可作为来源返回。
    const blocks = [...body.data.blocks].sort(
      (left, right) =>
        Number(
          ['d', 'h', 'NodeDocument', 'NodeHeading'].includes(left.type || '')
        ) -
        Number(
          ['d', 'h', 'NodeDocument', 'NodeHeading'].includes(right.type || '')
        )
    )
    for (const block of blocks) {
      const blockId = block.id || ''
      const documentId = block.rootID || ''
      const notebookId = block.box || ''
      if (![blockId, documentId, notebookId].every((id) => idPattern.test(id)))
        continue
      if (notebooks.length && !notebooks.includes(notebookId)) continue
      const content = plain(block.markdown || block.content)
      if (!content) continue
      items.push({
        blockId,
        documentId,
        notebookId,
        title: titleOf(block),
        documentPath: plain(block.hPath, 1000),
        content,
        sourceUpdatedAt: null,
        retrievedAt: now,
        sourceUri: `siyuan://blocks/${blockId}`,
        contentHash: createHash('sha256').update(content).digest('hex'),
        rankingMethod: 'siyuan-fulltext-v1',
      })
      if (items.length >= MAX_ITEMS) break
    }

    return items.length ? { status: 'hit', items } : { status: 'empty' }
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError'
    return { status: aborted ? 'timeout' : 'source_unavailable' }
  }
}

export type SiYuanProbeCheck = {
  name: 'url' | 'auth' | 'search'
  ok: boolean
  latencyMs?: number
  detail?: string
}

/** 直连模式下的连接测试：版本接口验证鉴权，检索接口验证形状与权限 */
export const probeSiYuan = async ({
  origin,
  token,
  timeoutMs = 4000,
  fetchImpl = fetch,
}: {
  origin: string
  token: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}): Promise<{ ok: boolean; checks: SiYuanProbeCheck[] }> => {
  const checks: SiYuanProbeCheck[] = []
  checks.push({ name: 'url', ok: true })

  const authStart = Date.now()
  try {
    const response = await withTimeout(
      Math.min(PROBE_TIMEOUT_MS, timeoutMs),
      (signal) =>
        fetchImpl(`${origin}/api/system/version`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader(token),
          },
          body: '{}',
          redirect: 'error',
          signal,
        })
    )
    const parsed = await readLimitedJson(response)
    const ok =
      response.ok && parsed.ok && (parsed.body as { code?: number })?.code === 0
    checks.push({
      name: 'auth',
      ok,
      latencyMs: Date.now() - authStart,
      detail: ok
        ? `思源版本 ${(parsed.ok && (parsed.body as { data?: unknown }).data) || '未知'}`
        : response.status === 401 || response.status === 403
          ? '令牌无效'
          : `HTTP ${response.status}`,
    })
    if (!ok) return { ok: false, checks }
  } catch {
    checks.push({
      name: 'auth',
      ok: false,
      latencyMs: Date.now() - authStart,
      detail: '无法连接思源',
    })
    return { ok: false, checks }
  }

  const searchStart = Date.now()
  try {
    const response = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(`${origin}/api/search/fullTextSearchBlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token),
        },
        body: JSON.stringify({
          query: '__connectivity_probe__',
          page: 1,
          size: 1,
        }),
        redirect: 'error',
        signal,
      })
    )
    const parsed = await readLimitedJson(response)
    const body = parsed.ok
      ? (parsed.body as { code?: number; data?: { blocks?: unknown } })
      : null
    const ok =
      response.ok &&
      Boolean(body) &&
      body?.code === 0 &&
      Array.isArray(body?.data?.blocks)
    checks.push({
      name: 'search',
      ok,
      latencyMs: Date.now() - searchStart,
      detail: ok ? '检索接口可用' : '检索接口返回不符合思源约定',
    })
    return { ok, checks }
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

export type SiYuanNotebook = { id: string; name: string; closed: boolean }

/** 只读：列出笔记本，供界面勾选可达范围 */
export const listSiYuanNotebooks = async ({
  origin,
  token,
  timeoutMs = 4000,
  fetchImpl = fetch,
}: {
  origin: string
  token: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}): Promise<{ ok: boolean; notebooks: SiYuanNotebook[]; error?: string }> => {
  try {
    const response = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(`${origin}/api/notebook/lsNotebooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(token),
        },
        body: '{}',
        redirect: 'error',
        signal,
      })
    )
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel()
      return { ok: false, notebooks: [], error: '令牌无效' }
    }
    const parsed = await readLimitedJson(response)
    if (!parsed.ok) {
      return { ok: false, notebooks: [], error: '返回内容无法解析' }
    }
    const body = parsed.body as {
      code?: number
      data?: { notebooks?: { id?: string; name?: string; closed?: boolean }[] }
    }
    if (body?.code !== 0 || !Array.isArray(body.data?.notebooks)) {
      return { ok: false, notebooks: [], error: '返回格式不符合思源约定' }
    }
    return {
      ok: true,
      notebooks: body.data.notebooks
        .filter((item) => idPattern.test(item.id || ''))
        .map((item) => ({
          id: item.id as string,
          name: item.name || item.id || '',
          closed: Boolean(item.closed),
        })),
    }
  } catch {
    return { ok: false, notebooks: [], error: '无法连接思源' }
  }
}
