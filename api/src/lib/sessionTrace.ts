import {
  findDshSessionFile,
  readThreadMessages,
} from './roleEvaluationSessions'
import { readZstdText } from './zstdLines'

export type SessionTraceSource = 'dsh' | 'codex' | 'none'

export type SessionTraceMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  step?: number
}

export type SessionTraceTool = {
  name: string
  detail: string
  result: string
  resultTruncated: boolean
  redacted: boolean
  createdAt: Date
  step?: number
}

export type SessionTurnTrace = {
  turn?: number
  source: SessionTraceSource
  messages: SessionTraceMessage[]
  tools: SessionTraceTool[]
  truncated: boolean
}

export type SessionReference = {
  sessionId: string
  turn?: number
  platform?: SessionTraceSource
}

export type TraceLimits = {
  messages?: number
  tools?: number
  messageChars?: number
  toolChars?: number
}

const MESSAGE_MAX = 8_000
const TOOL_TEXT_MAX = 200
const DEFAULT_MESSAGE_LIMIT = 40
const DEFAULT_TOOL_LIMIT = 80

/** 命中这些词的参数/结果不回显，避免把密钥类内容渲染到页面上 */
const SENSITIVE_PATTERN =
  /(\.env\b|secret|token|password|passwd|credential|api[-_]?key)/i

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/gi

/** 运行时注入的元信息会以 user/message 形式落进会话，展示时跳过 */
const HARNESS_META_MESSAGE = /^Time sampled while preparing turn/

/** Codex CLI 会把 AGENTS.md 注入成首条用户消息，不是真实需求 */
const CODEX_INJECTED = /^#\s*AGENTS\.md instructions|<INSTRUCTIONS>/

export const isInjectedUserMessage = (role: string, content: string) =>
  role === 'user' && CODEX_INJECTED.test(content)

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}…` : text

const numeric = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const turnOf = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return undefined
}

/**
 * 运行记录的 externalReference 有三种形态：
 * - `task:<runId>:<sessionId>`        团队任务派发（captureSession 补写会话 id）
 * - `dsh-task:<uuid>:<turn>`          DeepSeek Harness 会话同步，按轮次一条运行
 * - `codex-task:<id>:<turnKey>`       Codex 会话同步
 * 解析不出来时返回空 sessionId，调用方按「没有会话记录」处理。
 */
export const parseSessionReference = (
  reference: string | null | undefined
): SessionReference => {
  const raw = (reference || '').trim()
  if (!raw) return { sessionId: '' }

  const parts = raw.split(':')
  const prefix = parts[0]

  if (prefix === 'task' && parts.length >= 3) {
    return { sessionId: parts.slice(2).join(':'), turn: turnOf(parts[1]) }
  }
  if (prefix === 'dsh-task' && parts.length >= 2 && parts[1]) {
    return { sessionId: parts[1], turn: turnOf(parts[2]), platform: 'dsh' }
  }
  if (prefix === 'codex-task' && parts.length >= 2 && parts[1]) {
    return { sessionId: parts[1], turn: turnOf(parts[2]), platform: 'codex' }
  }
  return { sessionId: '' }
}

export const stripSystemReminders = (text: string) =>
  text.replace(SYSTEM_REMINDER, '').trim()

const textBlocks = (content: unknown, types: string[]) => {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (block): block is { type?: string; text: string } =>
        Boolean(block) && typeof block === 'object' && 'text' in block
    )
    .filter((block) => typeof block.text === 'string')
    .filter((block) => !block.type || types.includes(block.type))
    .map((block) => block.text)
    .join('\n')
    .trim()
}

const firstLine = (text: string) =>
  text
    .split(/\r?\n/)
    .find((line) => line.trim())
    ?.trim() ?? ''

const parseArguments = (raw: unknown): Record<string, unknown> | null => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const ARGUMENT_KEYS: Record<string, string[]> = {
  bash: ['command', 'description'],
  read: ['path', 'file_path'],
  write: ['path', 'file_path'],
  edit: ['path', 'file_path'],
}

/** 工具调用只留一行「在做什么」，不搬运完整参数 */
export const describeToolCall = (name: string, rawArguments: unknown) => {
  const args = parseArguments(rawArguments)
  if (!args) return ''
  const preferred = ARGUMENT_KEYS[name] ?? [
    'command',
    'path',
    'file_path',
    'query',
    'url',
    'pattern',
    'description',
  ]
  for (const key of [...preferred, ...Object.keys(args)]) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) return firstLine(value)
  }
  return ''
}

const looksSensitive = (...values: string[]) =>
  values.some((value) => Boolean(value) && SENSITIVE_PATTERN.test(value))

const recordTime = (record: Record<string, unknown>) => {
  const raw = record.time ?? record.timestamp
  const stamp =
    typeof raw === 'number'
      ? new Date(raw)
      : typeof raw === 'string'
        ? new Date(raw)
        : new Date()
  return Number.isNaN(stamp.getTime()) ? new Date() : stamp
}

type DshRecord = {
  type?: unknown
  time?: unknown
  timestamp?: unknown
  data?: Record<string, unknown>
}

/**
 * 解析 DeepSeek Harness 会话记录，按轮次取出「这一轮发生了什么」：
 * 用户的纯文本需求、助手的可见文本（丢弃 reasoning 块）、工具调用与结果摘要。
 */
export const parseDshTrace = (
  lines: Iterable<string>,
  turn?: number,
  limits: TraceLimits = {}
): SessionTurnTrace => {
  const messageLimit = limits.messages ?? DEFAULT_MESSAGE_LIMIT
  const toolLimit = limits.tools ?? DEFAULT_TOOL_LIMIT
  const messageChars = limits.messageChars ?? MESSAGE_MAX
  const toolChars = limits.toolChars ?? TOOL_TEXT_MAX

  const messages: SessionTraceMessage[] = []
  const tools: SessionTraceTool[] = []
  const calls = new Map<string, SessionTraceTool>()
  let currentTurn: number | undefined
  let truncated = false

  const inTurn = (recordTurn: number | undefined) => {
    if (turn === undefined) return true
    return recordTurn === turn
  }

  for (const line of lines) {
    if (!line.trim()) continue
    let record: DshRecord
    try {
      record = JSON.parse(line) as DshRecord
    } catch {
      continue
    }
    if (!record || typeof record !== 'object') continue

    const data = (record.data || {}) as Record<string, unknown>
    const explicitTurn = numeric(data.turn)
    if (record.type === 'turn/start' && explicitTurn !== undefined) {
      currentTurn = explicitTurn
    }
    if (!inTurn(explicitTurn ?? currentTurn)) continue

    const createdAt = recordTime(record as Record<string, unknown>)
    const step = numeric(data.step)

    if (record.type === 'user/message') {
      const text = stripSystemReminders(textBlocks(data.content, ['text']))
      if (!text || HARNESS_META_MESSAGE.test(text)) continue
      if (messages.length >= messageLimit) {
        truncated = true
        continue
      }
      messages.push({
        role: 'user',
        content: clip(text, messageChars),
        createdAt,
        step,
      })
      continue
    }

    if (record.type === 'assistant/message') {
      const message = (data.message || {}) as Record<string, unknown>
      // 只取可见文本：reasoning 块是模型内部推理，不进执行过程
      const text = textBlocks(message.content, ['text'])
      if (!text) continue
      if (messages.length >= messageLimit) {
        truncated = true
        continue
      }
      messages.push({
        role: 'assistant',
        content: clip(text, messageChars),
        createdAt,
        step,
      })
      continue
    }

    if (record.type === 'tool/call') {
      if (tools.length >= toolLimit) {
        truncated = true
        continue
      }
      const name =
        typeof data.name === 'string' && data.name.trim() ? data.name : 'tool'
      const rawArguments =
        typeof data.arguments === 'string'
          ? data.arguments
          : JSON.stringify(data.arguments ?? '')
      const redacted = looksSensitive(name, rawArguments)
      const tool: SessionTraceTool = {
        name,
        detail: redacted
          ? '已隐藏内容'
          : clip(describeToolCall(name, data.arguments), toolChars),
        result: '',
        resultTruncated: false,
        redacted,
        createdAt,
        step,
      }
      tools.push(tool)
      const callId = data.callId
      if (typeof callId === 'string') calls.set(callId, tool)
      continue
    }

    if (record.type === 'tool/result') {
      const message = (data.message || {}) as Record<string, unknown>
      const callId =
        (typeof data.callId === 'string' && data.callId) ||
        (typeof message.toolCallId === 'string' && message.toolCallId) ||
        (typeof data.toolCallId === 'string' && data.toolCallId)
      const tool = callId ? calls.get(callId) : undefined
      if (!tool) continue
      const text = textBlocks(message.content, ['text'])
      if (!text) continue
      // 只看调用参数判断敏感性：结果里出现 .env 之类的文件名是正常输出
      tool.result =
        tool.redacted === true ? '已隐藏内容' : clip(firstLine(text), toolChars)
      tool.resultTruncated = text.length > toolChars
    }
  }

  return {
    turn,
    source: 'dsh',
    messages,
    tools,
    truncated,
  }
}

const emptyTrace = (source: SessionTraceSource): SessionTurnTrace => ({
  source,
  messages: [],
  tools: [],
  truncated: false,
})

const traceSource = (tool: string | null | undefined): SessionTraceSource =>
  tool === 'deepseek-harness' ? 'dsh' : tool === 'codex' ? 'codex' : 'none'

/** 按一条运行记录读取它所属轮次的会话轨迹（读不到时返回空轨迹，不抛错） */
export const readSessionTurnTrace = async ({
  tool,
  sessionId,
  turn,
  projectRoot,
  limits,
}: {
  tool: string | null | undefined
  sessionId: string
  turn?: number
  projectRoot: string
  limits?: TraceLimits
}): Promise<SessionTurnTrace> => {
  const source = traceSource(tool)
  if (!sessionId || source === 'none') return emptyTrace(source)

  try {
    if (source === 'dsh') {
      const filePath = await findDshSessionFile(sessionId)
      if (!filePath) return emptyTrace('dsh')
      const text = await readZstdText(filePath)
      return parseDshTrace(text.split(/\r?\n/), turn, limits)
    }

    // Codex 会话没有按轮次打标，按会话线程返回消息（工具轨迹暂不解析）
    const messages = await readThreadMessages({
      tool: 'codex',
      sessionId,
      projectRoot,
    })
    return {
      turn,
      source: 'codex',
      messages: messages
        .filter(
          (message) => !isInjectedUserMessage(message.role, message.content)
        )
        .map((message) => ({
          role: message.role,
          content: clip(message.content, limits?.messageChars ?? MESSAGE_MAX),
          createdAt: message.createdAt,
        })),
      tools: [],
      truncated: false,
    }
  } catch {
    return emptyTrace(source)
  }
}
