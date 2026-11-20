import { createReadStream, readFileSync, statSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'

import { readZstdText } from './zstdLines'

export type RoleEvaluationToolId = 'codex' | 'deepseek-harness'

export type ThreadMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export type DiscoveredSession = {
  sessionId: string
  filePath: string
}

const MESSAGE_MAX = 8_000
const THREAD_LIMIT = 200
const DISCOVERY_SLACK_MS = 5_000

export const codexSessionRoot = () =>
  process.env.CODEX_SESSION_ROOT || path.join(homedir(), '.codex', 'sessions')

export const dshSessionRoot = () =>
  process.env.DSH_SESSION_ROOT || path.join(homedir(), '.dsh', 'sessions')

/** /Users/fan/ai-digital-team → --Users-fan-ai-digital-team-- */
export const dshWorkspaceDir = (projectRoot: string) =>
  `--${projectRoot.replace(/^\/+|\/+$/g, '').replace(/\//g, '-')}--`

const uuidPattern =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

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

const clip = (text: string) =>
  text.length > MESSAGE_MAX ? `${text.slice(0, MESSAGE_MAX)}…` : text

const parseJson = (line: string): Record<string, unknown> | null => {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const listCodexSessionFiles = async (): Promise<
  Array<{ filePath: string; mtimeMs: number }>
> => {
  const root = codexSessionRoot()
  let entries: string[] = []
  try {
    entries = await readdir(root, { recursive: true })
  } catch {
    return []
  }

  const files: Array<{ filePath: string; mtimeMs: number }> = []
  for (const entry of entries) {
    if (!/^rollout-.*\.jsonl$/.test(path.basename(entry))) continue
    const filePath = path.isAbsolute(entry) ? entry : path.join(root, entry)
    try {
      const info = await stat(filePath)
      files.push({ filePath, mtimeMs: info.mtimeMs })
    } catch {
      // 文件可能在扫描期间被删除，跳过
    }
  }
  return files.sort((left, right) => right.mtimeMs - left.mtimeMs)
}

const readCodexMeta = async (filePath: string) => {
  const stream = createReadStream(filePath, { encoding: 'utf8' })
  const reader = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of reader) {
      const record = parseJson(line)
      if (!record) continue
      if (record.type !== 'session_meta') continue
      const payload = (record.payload || {}) as Record<string, unknown>
      return {
        sessionId:
          typeof payload.session_id === 'string'
            ? payload.session_id
            : typeof payload.id === 'string'
              ? payload.id
              : undefined,
        cwd: typeof payload.cwd === 'string' ? payload.cwd : undefined,
      }
    }
    return null
  } finally {
    reader.close()
    stream.close()
  }
}

export const discoverCodexSession = async ({
  projectRoot,
  since,
}: {
  projectRoot: string
  since: Date
}): Promise<DiscoveredSession | null> => {
  const threshold = since.getTime() - DISCOVERY_SLACK_MS
  const files = await listCodexSessionFiles()
  for (const file of files) {
    if (file.mtimeMs < threshold) break
    const meta = await readCodexMeta(file.filePath)
    if (!meta?.sessionId || meta.cwd !== projectRoot) continue
    return { sessionId: meta.sessionId, filePath: file.filePath }
  }
  return null
}

export const listDshSessionDirsIn = async (
  projectRoot: string,
  rootOverride?: string
): Promise<Array<{ sessionId: string; filePath: string; mtimeMs: number }>> => {
  const root =
    rootOverride || path.join(dshSessionRoot(), dshWorkspaceDir(projectRoot))
  let entries: string[] = []
  try {
    entries = await readdir(root)
  } catch {
    return []
  }

  const dirs: Array<{ sessionId: string; filePath: string; mtimeMs: number }> =
    []
  for (const entry of entries) {
    if (!entry.startsWith('session-')) continue
    const rawId = entry.slice('session-'.length)
    if (!uuidPattern.test(rawId)) continue
    // CLI 输出的 session id 带 session- 前缀，resume 也需要完整值
    const sessionId = entry
    const filePath = path.join(root, entry, 'session.v4.jsonl.zstd')
    try {
      const info = await stat(filePath)
      dirs.push({ sessionId, filePath, mtimeMs: info.mtimeMs })
    } catch {
      // 没有会话文件的目录跳过
    }
  }
  return dirs.sort((left, right) => right.mtimeMs - left.mtimeMs)
}

const uuidOf = (value: string) => value.match(uuidPattern)?.[0]?.toLowerCase()

/**
 * 按 sessionId 在全量会话根目录下找会话文件。
 * 运行记录同步的是整台机器的会话（不限本仓库），所以不能只用
 * dshWorkspaceDir(projectRoot) 那一个目录。
 */
export const findDshSessionFile = async (
  sessionId: string
): Promise<string | null> => {
  const target = uuidOf(sessionId)
  if (!target) return null

  const root = dshSessionRoot()
  let entries: string[] = []
  try {
    entries = await readdir(root, { recursive: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    if (path.basename(entry) !== 'session.v4.jsonl.zstd') continue
    const filePath = path.isAbsolute(entry) ? entry : path.join(root, entry)
    if (uuidOf(path.basename(path.dirname(filePath))) !== target) continue
    try {
      if ((await stat(filePath)).isFile()) return filePath
    } catch {
      // 扫描期间被清理：继续找下一个
    }
  }
  return null
}

export const discoverDshSession = async ({
  projectRoot,
  since,
}: {
  projectRoot: string
  since: Date
}): Promise<DiscoveredSession | null> => {
  const threshold = since.getTime() - DISCOVERY_SLACK_MS
  const dirs = await listDshSessionDirsIn(projectRoot)
  const hit = dirs.find((dir) => dir.mtimeMs >= threshold)
  return hit ? { sessionId: hit.sessionId, filePath: hit.filePath } : null
}

export const discoverSession = async ({
  tool,
  projectRoot,
  since,
}: {
  tool: RoleEvaluationToolId
  projectRoot: string
  since: Date
}): Promise<DiscoveredSession | null> =>
  tool === 'codex'
    ? discoverCodexSession({ projectRoot, since })
    : discoverDshSession({ projectRoot, since })

const readCodexThread = async (filePath: string): Promise<ThreadMessage[]> => {
  const stream = createReadStream(filePath, { encoding: 'utf8' })
  const reader = createInterface({ input: stream, crlfDelay: Infinity })
  const messages: ThreadMessage[] = []
  try {
    for await (const line of reader) {
      const record = parseJson(line)
      if (!record || record.type !== 'response_item') continue
      const payload = (record.payload || {}) as Record<string, unknown>
      if (payload.type !== 'message') continue
      const role = payload.role
      if (role !== 'user' && role !== 'assistant') continue
      const text = clip(textOf(payload.content).trim())
      if (!text) continue
      const timestamp =
        typeof record.timestamp === 'string'
          ? new Date(record.timestamp)
          : new Date()
      messages.push({
        role,
        content: text,
        createdAt: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      })
    }
  } finally {
    reader.close()
    stream.close()
  }
  return messages
}

const recordTime = (record: Record<string, unknown>) => {
  const raw = record.time ?? record.timestamp
  if (typeof raw === 'number') return new Date(raw)
  if (typeof raw === 'string') return new Date(raw)
  return new Date()
}

const readDshThread = async (filePath: string): Promise<ThreadMessage[]> => {
  let raw: string
  try {
    raw = await readZstdText(filePath)
  } catch {
    return []
  }

  const messages: ThreadMessage[] = []
  for (const line of raw.split('\n')) {
    const record = parseJson(line)
    if (!record) continue
    const type = record.type
    if (type !== 'user/message' && type !== 'assistant/message') continue
    const data = (record.data || {}) as Record<string, unknown>
    // v4 会话把 assistant 正文放在 data.message.content，旧格式在 data.content
    const content =
      type === 'assistant/message'
        ? ((data.message as { content?: unknown } | undefined)?.content ??
          data.content)
        : data.content
    const text = clip(textOf(content).trim())
    if (!text) continue
    const stamp = recordTime(record)
    messages.push({
      role: type === 'user/message' ? 'user' : 'assistant',
      content: text,
      createdAt: Number.isNaN(stamp.getTime()) ? new Date() : stamp,
    })
  }
  return messages
}

/** 读取某条评估对应的会话线程（最近的 THREAD_LIMIT 条） */
export const readThreadMessages = async ({
  tool,
  sessionId,
  projectRoot,
  filePath,
}: {
  tool: RoleEvaluationToolId
  sessionId: string
  projectRoot: string
  filePath?: string
}): Promise<ThreadMessage[]> => {
  let resolved = filePath

  if (!resolved) {
    if (tool === 'codex') {
      const files = await listCodexSessionFiles()
      resolved = files.find((file) =>
        file.filePath.includes(sessionId)
      )?.filePath
    } else {
      const dirs = await listDshSessionDirsIn(projectRoot)
      resolved = dirs.find((dir) => dir.sessionId === sessionId)?.filePath
    }
  }
  if (!resolved) return []

  const messages =
    tool === 'codex'
      ? await readCodexThread(resolved)
      : await readDshThread(resolved)
  return messages.slice(-THREAD_LIMIT)
}

/**
 * 从 --json 事件流抓会话 id：
 * codex → {"type":"thread.started","thread_id":"..."}
 * dsh   → {"type":"session","sessionId":"session-..."}
 */
export const sessionIdFromLog = (
  logPath: string,
  tool: RoleEvaluationToolId
): string | null => {
  let text: string
  try {
    text = readFileSync(logPath, 'utf8').slice(0, 65_536)
  } catch {
    return null
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    const record = parseJson(trimmed)
    if (!record) continue
    if (tool === 'codex' && typeof record.thread_id === 'string') {
      return record.thread_id
    }
    if (tool === 'deepseek-harness' && typeof record.sessionId === 'string') {
      return record.sessionId
    }
  }
  return null
}

export const sessionFileExists = (filePath: string) => {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}
