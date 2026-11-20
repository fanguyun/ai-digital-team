import { createHash } from 'node:crypto'

import type { KnowledgeMode } from './knowledgeConfig'
import { filterByPathPrefixes, loadKnowledgeSource } from './knowledgeSource'
import { searchSiYuan } from './siyuanKnowledge'

export const KNOWLEDGE_ADAPTER_VERSION = 'siyuan-keyword-v1'
export type KnowledgeStatus =
  | 'disabled'
  | 'hit'
  | 'empty'
  | 'config_error'
  | 'auth_failed'
  | 'source_unavailable'
  | 'timeout'
  | 'invalid_response'
export type KnowledgeItem = {
  blockId: string
  documentId: string
  notebookId: string
  title: string
  documentPath: string
  content: string
  sourceUpdatedAt: string | null
  retrievedAt: string
  sourceUri: string
  contentHash: string
  rankingMethod: 'keyword-hit-count-v1' | 'siyuan-fulltext-v1'
}
export type KnowledgeResult = {
  status: KnowledgeStatus
  mode: KnowledgeMode
  items: KnowledgeItem[]
  elapsedMs: number
  /** 落在目录白名单之外、被丢弃的片段数（旧调用方可以不传） */
  filteredOut?: number
}

const idPattern = /^\d{14}-[a-z0-9]{7}$/
const boundedText = (v: unknown, max: number) =>
  typeof v === 'string' && v.length <= max

const validItem = (item: KnowledgeItem) =>
  item &&
  [item.blockId, item.documentId, item.notebookId].every(
    (id) => typeof id === 'string' && idPattern.test(id)
  ) &&
  boundedText(item.title, 300) &&
  boundedText(item.documentPath, 1000) &&
  boundedText(item.content, 1500) &&
  Boolean(item.content.trim()) &&
  (item.sourceUpdatedAt === null ||
    (boundedText(item.sourceUpdatedAt, 64) &&
      /^\d{14}$/.test(item.sourceUpdatedAt))) &&
  boundedText(item.retrievedAt, 64) &&
  Number.isFinite(Date.parse(item.retrievedAt)) &&
  item.sourceUri === `siyuan://blocks/${item.blockId}` &&
  item.contentHash ===
    createHash('sha256').update(item.content).digest('hex') &&
  item.rankingMethod === 'keyword-hit-count-v1'

/** 一轮一次调用，不重试；错误不附带上游正文、查询、地址或凭证。 */
export const retrieveKnowledge = async ({
  agentSlug,
  query,
}: {
  agentSlug: string
  query: string
}): Promise<KnowledgeResult> => {
  const start = Date.now()
  let mode: KnowledgeMode = 'required'
  const result = (
    status: KnowledgeStatus,
    items: KnowledgeItem[] = [],
    filteredOut = 0
  ): KnowledgeResult => ({
    status,
    items,
    mode,
    elapsedMs: Date.now() - start,
    filteredOut,
  })
  // 数据库配置优先，没有时回落到环境变量
  let resolved: Awaited<ReturnType<typeof loadKnowledgeSource>>
  try {
    resolved = await loadKnowledgeSource(agentSlug)
  } catch {
    // 配置读取异常按配置错误处理，不让派发因为知识库挂掉
    mode =
      process.env.KNOWLEDGE_MODE === 'optional' || !process.env.KNOWLEDGE_MODE
        ? 'optional'
        : 'required'
    return result('config_error')
  }
  if (resolved.status === 'ok') mode = resolved.mode
  else if (resolved.status === 'config_error') {
    mode = resolved.mode
    return result('config_error')
  } else return result('disabled')
  const config = {
    url: resolved.origin,
    token: resolved.token,
    timeoutMs: resolved.timeoutMs,
  }
  const pathPrefixes = resolved.pathPrefixes

  // 直连思源：只调只读全文检索接口，由本进程做范围过滤与映射
  if (resolved.provider === 'siyuan') {
    const outcome = await searchSiYuan({
      origin: config.url,
      token: config.token,
      query,
      timeoutMs: config.timeoutMs,
      notebooks: resolved.notebooks,
    })
    if (outcome.status !== 'hit') return result(outcome.status)
    const scoped = filterByPathPrefixes(outcome.items, pathPrefixes)
    if (!scoped.items.length) return result('empty', [], scoped.filteredOut)
    return result('hit', scoped.items, scoped.filteredOut)
  }
  if (!query.trim()) return result('empty')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(`${config.url}/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ query: query.slice(0, 300), limit: 6 }),
      redirect: 'error',
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel()
      return result('auth_failed')
    }
    if (!response.ok) {
      await response.body?.cancel()
      return result('source_unavailable')
    }
    if (Number(response.headers.get('content-length')) > 256 * 1024) {
      await response.body?.cancel()
      return result('invalid_response')
    }
    const reader = response.body?.getReader()
    if (!reader) return result('invalid_response')
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 256 * 1024) {
        await reader.cancel()
        return result('invalid_response')
      }
      chunks.push(value)
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const statuses = [
      'hit',
      'empty',
      'auth_failed',
      'source_unavailable',
      'timeout',
    ]
    if (
      !body ||
      !statuses.includes(body.status) ||
      !Array.isArray(body.items) ||
      body.items.length > 6
    )
      return result('invalid_response')
    if (body.status !== 'hit') {
      return body.items.length === 0
        ? result(body.status)
        : result('invalid_response')
    }
    if (!body.items.length || !body.items.every(validItem))
      return result('invalid_response')
    // 团队侧目录白名单：越界片段直接丢弃，不让它进入提示词
    const scoped = filterByPathPrefixes(
      body.items as KnowledgeItem[],
      pathPrefixes
    )
    if (!scoped.items.length) return result('empty', [], scoped.filteredOut)
    return result(
      'hit',
      scoped.items.map((item: KnowledgeItem) => ({
        blockId: item.blockId,
        documentId: item.documentId,
        notebookId: item.notebookId,
        title: item.title,
        documentPath: item.documentPath,
        content: item.content,
        sourceUpdatedAt: item.sourceUpdatedAt,
        retrievedAt: item.retrievedAt,
        sourceUri: item.sourceUri,
        contentHash: item.contentHash,
        rankingMethod: item.rankingMethod,
      })),
      scoped.filteredOut
    )
  } catch (error) {
    if (controller.signal.aborted) return result('timeout')
    return result(
      error instanceof SyntaxError ? 'invalid_response' : 'source_unavailable'
    )
  } finally {
    clearTimeout(timer)
  }
}
