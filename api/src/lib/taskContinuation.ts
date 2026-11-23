import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'

import {
  isInjectedUserMessage,
  parseSessionReference,
  readSessionTurnTrace,
  stripSystemReminders,
} from './sessionTrace'

export const normalizeArtifactPath = (value: string) =>
  /^https?:\/\//i.test(value)
    ? value.trim()
    : path.posix.normalize(value.trim())

/** 链接不发请求；本地引用仅在仓库边界内检查，不跟随越界软链接。 */
export const artifactAvailability = (value: string, repoRoot: string) => {
  if (/^https?:\/\//i.test(value)) return 'reference'
  try {
    const absolute = path.resolve(repoRoot, value)
    const relative = path.relative(repoRoot, absolute)
    if (relative.startsWith('..') || path.isAbsolute(relative))
      return 'unavailable'
    if (!existsSync(absolute)) return 'missing'
    const canonical = path.relative(
      realpathSync(repoRoot),
      realpathSync(absolute)
    )
    if (
      canonical.startsWith('..') ||
      path.isAbsolute(canonical) ||
      /(^|\/)(\.env[^/]*|\.git|\.ssh|node_modules|file-history)(\/|$)/.test(
        canonical
      )
    )
      return 'unavailable'
    return 'available'
  } catch {
    return 'unavailable'
  }
}

type HistoricalRun = {
  id: string
  status: string
  mode: string
  platform: string
  summary: string | null
  externalReference: string | null
}
type Artifact = { path: string; label: string; kind: string }

// 历史会话仅用作补充；不带入系统注入、调试日志或含凭证的行。
const historicalText = (value: string) =>
  stripSystemReminders(value)
    .split('\n')
    .filter(
      (line) =>
        !/(?:bearer\s+\S+|sk-[\w-]{16,}|(?:password|passwd|api[_-]?key|secret|token|密码|令牌)["']?\s*[=:：]\s*\S+)/i.test(
          line
        )
    )
    .join('\n')

export const buildTaskContinuation = async ({
  taskId,
  runs,
  artifacts,
  note = '',
  reviewNote,
  repoRoot,
  totalRuns = runs.length,
}: {
  taskId: string
  runs: HistoricalRun[]
  artifacts: Artifact[]
  note?: string
  reviewNote?: string | null
  repoRoot: string
  totalRuns?: number
}) => {
  const selected = runs.slice(0, 5)
  let remaining = 17_000
  let truncated = totalRuns > selected.length
  const consume = (value: string, limit = remaining) => {
    const clean = historicalText(value)
    const size = Math.min(remaining, limit)
    const result = clean.slice(0, size)
    if (result.length < clean.length) truncated = true
    remaining -= result.length
    return result
  }
  const sections: string[] = []
  for (const run of selected) {
    sections.push(
      `运行 ${run.id}（${run.status}，${run.mode}）：${consume(run.summary || '无摘要', 2000)}`
    )
  }
  if (reviewNote) sections.push(`历史验收意见：${consume(reviewNote, 2000)}`)

  const unique = [
    ...new Map(
      artifacts.map((item) => [normalizeArtifactPath(item.path), item])
    ).values(),
  ]
  // 同一路径明确引用优先，其余按最近登记顺序选取。
  const ordered = unique
    .map((item, index) => ({ item, index, cited: note.includes(item.path) }))
    .sort((a, b) => Number(b.cited) - Number(a.cited) || b.index - a.index)
  const included = ordered.slice(0, 20).map(({ item }) => item)
  const omittedArtifacts = unique.length - included.length
  if (included.length) {
    sections.push('既有产物（名称 / 类型 / 路径 / 可用性）：')
    for (const item of included) {
      sections.push(
        consume(
          `- ${item.label} / ${item.kind} / ${item.path} / ${artifactAvailability(item.path, repoRoot)}`,
          1000
        )
      )
    }
  }
  if (omittedArtifacts) {
    truncated = true
    sections.push(
      `省略 ${omittedArtifacts} 个产物；可通过已认证的 task(id: "${taskId}") { artifacts { path label kind } } 查询完整任务产物清单。`
    )
  }

  let messages = 0
  let unavailable = false
  for (const run of selected) {
    const reference = parseSessionReference(run.externalReference)
    const trace = await readSessionTurnTrace({
      tool: run.platform,
      sessionId: reference.sessionId,
      turn: reference.turn,
      projectRoot: repoRoot,
      limits: { messages: 20, tools: 0, messageChars: 2000 },
    })
    if (!trace.messages.length) unavailable = true
    if (trace.truncated) truncated = true
    const eligible = trace.messages.filter(
      (message) =>
        !isInjectedUserMessage(message.role, message.content) &&
        !message.content.startsWith('My request:') &&
        !message.content.startsWith('Time sampled while preparing turn')
    )
    // 助手仅带入最终答复，用户保留必要的需求修订。
    const lastAssistant = eligible.findLast(
      (message) => message.role === 'assistant'
    )
    for (const message of eligible
      .filter((item) => item.role === 'user' || item === lastAssistant)
      .slice(-20)) {
      if (messages >= 20 || !remaining) {
        truncated = true
        break
      }
      const content = consume(message.content, 2000)
      if (content.trim()) {
        sections.push(`历史消息（${run.id} / ${message.role}）：${content}`)
        messages += 1
      }
    }
  }
  if (unavailable) sections.push('历史会话不可用，已使用摘要续接。')
  if (truncated)
    sections.push('历史上下文已裁剪；当前需求、本轮修改要求和权限保持完整。')
  const joined = sections.join('\n')
  if (joined.length > 19_800) truncated = true
  return {
    text:
      joined.slice(0, 19_800) +
      (truncated ? '\n历史上下文已裁剪；可通过任务产物清单补查。' : ''),
    metadata: {
      sourceRunIds: selected.map((run) => run.id),
      omittedRuns: Math.max(0, totalRuns - selected.length),
      omittedArtifacts,
      messageCount: messages,
      historyUnavailable: unavailable,
      truncated,
    },
  }
}
