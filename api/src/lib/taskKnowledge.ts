import { createHash } from 'node:crypto'

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {}
const id = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{14}-[a-z0-9]{7}$/.test(value)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

/** 只从派发的资料段恢复快照，且必须与事件中保存的 ID、时间和哈希一致。 */
const snapshots = (prompts: string[]) =>
  prompts.flatMap((prompt) => {
    const section = prompt.split('\n## 本轮外部知识参考\n')[1]
    if (!section) return []
    for (const line of section.split('\n')) {
      if (!line.startsWith('[{') || line.length > 60_000) continue
      try {
        const parsed: unknown = JSON.parse(line)
        if (Array.isArray(parsed)) return parsed.slice(0, 4).map(record)
      } catch {
        /* 缺少或截断的日志不构成可用快照。 */
      }
    }
    return []
  })

export const taskKnowledgeView = ({
  evidence,
  prompts = [],
  answer,
}: {
  evidence: unknown
  prompts?: string[]
  answer?: string
}) => {
  const audit = record(record(evidence).knowledge)
  const rawSources = Array.isArray(audit.sources)
    ? audit.sources.slice(0, 4)
    : []
  const stored = snapshots(prompts)
  const answerLinks = new Set(
    answer?.match(/siyuan:\/\/blocks\/[^\s<>()\[\]"'，。；、！？：]+/g) || []
  )
  const sources = rawSources.flatMap((raw, index) => {
    const source = record(raw)
    if (
      !id(source.blockId) ||
      !id(source.documentId) ||
      !id(source.notebookId) ||
      typeof source.contentHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(source.contentHash)
    )
      return []
    const citation = `[KB-${index + 1}]`
    const sourceUri = `siyuan://blocks/${source.blockId}`
    const snapshot = stored.find(
      (item) =>
        item.blockId === source.blockId &&
        item.documentId === source.documentId &&
        item.notebookId === source.notebookId &&
        item.citation === citation &&
        item.retrievedAt === source.retrievedAt &&
        item.contentHash === source.contentHash &&
        typeof item.content === 'string' &&
        item.content.length <= 1500 &&
        hash(item.content) === source.contentHash
    )
    const marked = answer?.includes(citation)
    return [
      {
        citation,
        blockId: source.blockId,
        documentId: source.documentId,
        sourceUri,
        contentHash: source.contentHash,
        retrievedAt:
          typeof source.retrievedAt === 'string' ? source.retrievedAt : null,
        title:
          typeof snapshot?.title === 'string'
            ? snapshot.title.slice(0, 300)
            : null,
        documentPath:
          typeof snapshot?.documentPath === 'string'
            ? snapshot.documentPath.slice(0, 1000)
            : null,
        content:
          typeof snapshot?.content === 'string' ? snapshot.content : null,
        citationStatus:
          answer === undefined
            ? 'unavailable'
            : !marked
              ? 'not_marked'
              : answerLinks.has(sourceUri)
                ? 'marker_and_link'
                : 'marker_only',
      },
    ]
  })
  const known = new Set(sources.map((source) => source.citation))
  const unknownCitations = [
    ...new Set(answer?.match(/\[KB-\d+\]/g) || []),
  ].filter((label) => !known.has(label))
  return {
    status: typeof audit.status === 'string' ? audit.status : 'not_recorded',
    mode: typeof audit.mode === 'string' ? audit.mode : null,
    elapsedMs: typeof audit.elapsedMs === 'number' ? audit.elapsedMs : null,
    filteredOut: typeof audit.filteredOut === 'number' ? audit.filteredOut : 0,
    answerAvailable: answer !== undefined,
    unknownCitations,
    sources,
  }
}
