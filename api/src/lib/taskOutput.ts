import { readFileSync } from 'node:fs'

import type { AgentToolId } from 'src/lib/agentDispatch'

const LOG_READ_LIMIT = 2_000_000
const SUMMARY_MAX = 500
const ARTIFACT_PATTERN = /^\s*artifact:\s*(\S+)\s*$/gim

export const confirmationRequestFromText = (value: string) => {
  const request = value
    .match(
      /^\s*(?:[-*]\s+)?待确认[：:]\s*([^\n]+(?:\n(?!\s*artifact:)[^\n]+)*)/m
    )?.[1]
    ?.trim()
  return request &&
    !/^(无|无须|无需|不需要|无待确认事项)[。！.!\s]*$/.test(request)
    ? request.slice(0, 2000)
    : undefined
}

type LogRecord = Record<string, unknown>
export const environmentBlockFromText = (value: string): string | undefined => {
  const explicit = value
    .match(
      /^\s*(?:[-*]\s+)?环境阻塞[：:]\s*([^\n]+(?:\n(?!\s*artifact:)[^\n]+)*)/m
    )?.[1]
    ?.trim()
  if (explicit && !/^(无|无需|无须)[。.!！\s]*$/.test(explicit))
    return explicit.slice(0, 2000)
  const legacy = confirmationRequestFromText(value)
  return legacy &&
    /宿主机环境|沙箱.*(?:拒绝|限制|无法|不允许)|(?:无法|不能|缺少|缺失).*(?:连接|访问|配置|令牌|凭证)|ECONNREFUSED|ENETUNREACH|EACCES|EPERM/i.test(
      legacy
    )
    ? legacy
    : undefined
}

const parseLine = (line: string): LogRecord | null => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' ? (parsed as LogRecord) : null
  } catch {
    return null
  }
}

const textOf = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) {
          const text = (item as { text?: unknown }).text
          return typeof text === 'string' ? text : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (value && typeof value === 'object' && 'text' in value) {
    const text = (value as { text?: unknown }).text
    return typeof text === 'string' ? text : ''
  }
  return ''
}

/** 从 --json 事件流里取最后一条 agent 回复文本 */
const lastAgentText = (raw: string, tool: AgentToolId) => {
  let last = ''

  for (const line of raw.split('\n')) {
    const record = parseLine(line)
    if (!record) continue

    if (tool === 'codex') {
      if (record.type === 'item.completed') {
        const item = record.item as LogRecord | undefined
        if (item?.type === 'agent_message' && typeof item.text === 'string') {
          last = item.text.trim() || last
        }
      }
      const payload = (record.payload || {}) as LogRecord
      if (record.type === 'response_item' && payload.type === 'message') {
        if (payload.role !== 'assistant') continue
        const text = textOf(payload.content).trim()
        if (text) last = text
      }
      continue
    }

    if (record.type === 'final') {
      const text = typeof record.text === 'string' ? record.text.trim() : ''
      if (text) last = text
      continue
    }
    if (record.type === 'assistant/message') {
      const data = (record.data || {}) as LogRecord
      const text = textOf(data.content).trim()
      if (text) last = text
    }
  }

  return last
}

export type TaskUsage = {
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
}

export type TaskRunOutput = {
  summary: string
  confirmationRequest?: string
  environmentBlock?: string
  completed?: boolean
  finalText?: string
  usage?: TaskUsage
  artifacts: Array<{
    path: string
    label: string
    kind: string
    source?: string
  }>
  error?: string
}

const ERROR_PATTERNS = [
  /"kind"\s*:\s*"error"/i,
  /MISSING_CREDENTIAL/,
  /\bERROR\s+[a-z_]+::/,
  /^\s*error:/im,
  /\bpanicked\b/i,
]

/**
 * 从日志里找明确的失败信号（没有则视为正常结束）。
 * 结构化事件只认同明确的失败形状；关键字扫描只作用于非 JSON 行
 * （CLI 直接打印的报错），避免把提示词/模型输出里引用的错误字样当成失败。
 */
const findError = (raw: string): string | undefined => {
  const tail = raw.slice(-20_000)
  let error: string | undefined

  for (const line of tail.split('\n')) {
    const record = parseLine(line)
    if (record) {
      if (record.type === 'turn.completed') error = undefined
      const status = record.reason as
        { kind?: string; error?: unknown } | undefined
      if (status?.kind === 'error') {
        const detail = status.error as { message?: string } | undefined
        error = detail?.message || '执行返回错误状态'
      }
      if (record.type === 'error' || record.type === 'turn.failed') {
        error = typeof record.message === 'string' ? record.message : '执行失败'
      }
      continue
    }

    if (ERROR_PATTERNS.some((pattern) => pattern.test(line))) {
      error = line.trim().slice(0, 300)
    }
  }

  return error
}

/** 从 turn.completed 事件里取 token 用量（codex 才有） */
const readUsage = (raw: string): TaskUsage | undefined => {
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined

  let latest: TaskUsage | undefined
  for (const line of raw.split('\n')) {
    const record = parseLine(line)
    if (!record) continue
    const usage = record.usage as Record<string, unknown> | undefined
    if (!usage) continue
    const inputTokens = number(usage.input_tokens)
    const outputTokens = number(usage.output_tokens)
    const cachedTokens = number(usage.cached_input_tokens)
    if (inputTokens === undefined && outputTokens === undefined) continue
    latest = { inputTokens, outputTokens, cachedTokens }
  }
  return latest
}

const artifactKind = (value: string) => {
  if (/^https?:\/\//i.test(value)) return 'url'
  if (/\.md$/i.test(value)) return 'report'
  if (/\/$/.test(value)) return 'dir'
  return 'file'
}

const labelFor = (value: string) => {
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      return url.host + url.pathname.replace(/\/$/, '')
    } catch {
      return value
    }
  }
  const parts = value.split('/').filter(Boolean)
  return parts[parts.length - 1] || value
}

/** 解析任务日志：交付摘要 + `artifact: <路径>` 约定行 */
export const parseTaskRunOutput = ({
  logPath,
  tool,
}: {
  logPath: string
  tool: AgentToolId
}): TaskRunOutput => {
  let raw = ''
  try {
    raw = readFileSync(logPath, 'utf8').slice(-LOG_READ_LIMIT)
  } catch {
    return { summary: '', artifacts: [] }
  }

  const finalText = lastAgentText(raw, tool)
  const request = confirmationRequestFromText(finalText)
  const environmentBlock = environmentBlockFromText(finalText)
  const confirmationRequest = environmentBlock ? undefined : request
  const usage = readUsage(raw)
  const seen = new Set<string>()
  const artifacts: TaskRunOutput['artifacts'] = []

  // 约定行通常写在 agent 的回复正文里（JSON 里是转义换行），
  // 因此优先在解析后的文本里匹配，取不到再退回原始日志。
  const haystack = finalText || raw
  const pattern = new RegExp(ARTIFACT_PATTERN.source, 'gim')

  for (const match of haystack.matchAll(pattern)) {
    const value = match[1].trim().replace(/^['"`]|['"`]$/g, '')
    if (!value || seen.has(value)) continue
    seen.add(value)
    artifacts.push({
      path: value,
      label: labelFor(value),
      kind: artifactKind(value),
      source: 'item',
    })
  }

  return {
    summary: finalText.slice(0, SUMMARY_MAX),
    ...(confirmationRequest ? { confirmationRequest } : {}),
    ...(environmentBlock ? { environmentBlock } : {}),
    completed: raw.split('\n').some((line) => {
      const record = parseLine(line)
      return tool === 'codex'
        ? record?.type === 'turn.completed'
        : record?.type === 'final'
    }),
    ...(finalText ? { finalText } : {}),
    artifacts: artifacts.slice(0, 20),
    error: findError(raw),
    usage,
  }
}
