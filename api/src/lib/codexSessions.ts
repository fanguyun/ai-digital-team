import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'

import {
  digitalTeamSlugs,
  isDigitalTeamProject,
  type DeepSeekSessionSnapshot,
} from './deepseekSessions'
import {
  extractRequestTitle,
  taskTitleKey,
  usableTaskTitle,
} from './sessionTaskTitle'

const ACTIVE_WINDOW_MS = 15 * 60 * 1000
const MAX_SESSIONS = 80
const uuidPattern = () =>
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

const tokenCount = (value: unknown) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

export const codexSessionRoot = () =>
  process.env.CODEX_SESSION_ROOT || join(homedir(), '.codex', 'sessions')

const parentSessionId = (path: string) => {
  const ids = [...path.matchAll(uuidPattern())].map((match) => match[0])
  return ids.length === 1 ? ids[0] : undefined
}

const skillNameFromArguments = (value: unknown, teamSlugs: Set<string>) => {
  const text = typeof value === 'string' ? value : ''
  if (!text || text.length > 400) return undefined
  for (const slug of teamSlugs) {
    if (
      text.includes(`"name":"${slug}"`) ||
      text.includes(`skills/${slug}/SKILL.md`)
    ) {
      return slug
    }
  }
  return undefined
}

export { usableTaskTitle }

type CodexTask = {
  key: string
  title?: string
  primaryAgent?: string
  usedSkill: boolean
  startedAt?: number
  updatedAt?: number
  modelId?: string
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
}

export const summarizeCodexLines = (
  lines: Iterable<string>,
  sessionId: string,
  now = Date.now(),
  _threadName?: string,
  teamSlugs = digitalTeamSlugs()
): DeepSeekSessionSnapshot[] => {
  let cwdName: string | undefined
  let teamProject = false
  let current: CodexTask | null = null
  const tasks: CodexTask[] = []
  const seenTitles = new Set<string>()
  const turnModels = new Map<string, string>()

  const openTask = (key: string, timestamp?: number) => {
    current = {
      key,
      usedSkill: false,
      startedAt: timestamp,
      updatedAt: timestamp,
    }
    tasks.push(current)
  }

  for (const line of lines) {
    if (!line.trim()) continue
    let record: {
      timestamp?: string
      type?: string
      payload?: {
        type?: string
        role?: string
        cwd?: string
        model?: string
        turn_id?: string
        name?: string
        arguments?: string
        content?: Array<{ type?: string; text?: string }>
        usage?: Record<string, unknown>
      }
    }
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }

    const timestamp = record.timestamp
      ? Date.parse(record.timestamp)
      : undefined
    const markTime = () => {
      if (!current || timestamp === undefined || !Number.isFinite(timestamp))
        return
      current.startedAt ??= timestamp
      current.updatedAt = timestamp
    }

    if (
      record.type === 'session_meta' &&
      typeof record.payload?.cwd === 'string'
    ) {
      cwdName = basename(record.payload.cwd)
      teamProject = isDigitalTeamProject(record.payload.cwd)
      continue
    }

    if (record.type === 'turn_context') {
      const model = record.payload?.model?.trim()
      const turnId = record.payload?.turn_id
      if (model && turnId) turnModels.set(turnId, model)
    }

    if (record.payload?.type === 'message' && record.payload.role === 'user') {
      const text = (record.payload.content || [])
        .map((part) => part.text || '')
        .join('\n')
      const title = extractRequestTitle(text)
      const titleKey = title ? taskTitleKey(title) : ''
      if (title && titleKey && !seenTitles.has(titleKey)) {
        openTask(
          String(tasks.length + 1),
          Number.isFinite(timestamp) ? timestamp : undefined
        )
        current.title = title
        seenTitles.add(titleKey)
      }
    }

    markTime()
    if (!current) continue

    const skillName = skillNameFromArguments(
      record.payload?.arguments,
      teamSlugs
    )
    if (skillName) {
      current.usedSkill = true
      current.primaryAgent ??= skillName
    }

    if (record.type !== 'token_usage_record') continue
    const usage = record.payload?.usage
    if (!usage) continue
    const eventInput = tokenCount(usage.input_tokens)
    const eventOutput = tokenCount(usage.output_tokens)
    const eventCached = tokenCount(usage.cached_input_tokens)
    if (eventInput !== undefined)
      current.inputTokens = (current.inputTokens ?? 0) + eventInput
    if (eventOutput !== undefined)
      current.outputTokens = (current.outputTokens ?? 0) + eventOutput
    if (eventCached !== undefined)
      current.cachedTokens = (current.cachedTokens ?? 0) + eventCached
    const turnModel = turnModels.get(String(record.payload?.turn_id || ''))
    if (turnModel) current.modelId = turnModel
  }

  return tasks
    .filter((task) => task.title && (teamProject || task.usedSkill))
    .map((task) => {
      const started = new Date(task.startedAt ?? now)
      const updated = new Date(task.updatedAt ?? task.startedAt ?? now)
      const running = now - updated.getTime() < ACTIVE_WINDOW_MS
      return {
        sessionId: `${sessionId}:${task.key}`,
        platform: 'codex' as const,
        title: task.title,
        cwdName,
        primaryAgent: task.primaryAgent || 'main-agent',
        startedAt: started,
        updatedAt: updated,
        status: running ? ('RUNNING' as const) : ('COMPLETED' as const),
        stage: running ? ('EXECUTION' as const) : ('DELIVERY' as const),
        modelId: task.modelId,
        inputTokens: task.inputTokens,
        outputTokens: task.outputTokens,
        cachedTokens: task.cachedTokens,
      }
    })
}

const findParentSessions = async (root: string) => {
  const matches: string[] = []
  const directories = [root]
  while (directories.length > 0) {
    const directory = directories.pop()
    if (!directory) break
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) directories.push(path)
      if (
        entry.isFile() &&
        entry.name.endsWith('.jsonl') &&
        parentSessionId(path)
      ) {
        matches.push(path)
      }
    }
  }
  const ranked = await Promise.all(
    matches.map(async (path) => ({
      path,
      modifiedAt: (await stat(path)).mtimeMs,
    }))
  )
  return ranked
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(0, MAX_SESSIONS)
}

const loadThreadNames = async (root: string) => {
  const names = new Map<string, string>()
  const indexPath = join(
    basename(root) === 'sessions' ? join(root, '..') : root,
    'session_index.jsonl'
  )
  try {
    const lines = createInterface({
      input: createReadStream(indexPath, 'utf8'),
    })
    for await (const line of lines) {
      const record = JSON.parse(line) as { id?: string; thread_name?: string }
      if (record.id && record.thread_name)
        names.set(record.id, record.thread_name)
    }
  } catch {
    return names
  }
  return names
}

export const loadCodexSessions = async (
  root = codexSessionRoot(),
  now = Date.now()
) => {
  if (process.env.NODE_ENV === 'test' && !process.env.CODEX_SESSION_ROOT)
    return []
  const names = await loadThreadNames(root)
  const teamSlugs = digitalTeamSlugs()
  const snapshots: DeepSeekSessionSnapshot[] = []
  for (const entry of await findParentSessions(root)) {
    const sessionId = parentSessionId(entry.path)
    if (!sessionId) continue
    const lines: string[] = []
    const stream = createInterface({
      input: createReadStream(entry.path, 'utf8'),
    })
    for await (const line of stream) lines.push(line)
    snapshots.push(
      ...summarizeCodexLines(
        lines,
        sessionId,
        now,
        names.get(sessionId),
        teamSlugs
      )
    )
  }
  return snapshots
}
