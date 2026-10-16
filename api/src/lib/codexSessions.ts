import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'

import {
  digitalTeamAgents,
  isDigitalTeamProject,
  type DigitalTeamAgent,
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

export const parentSessionId = (path: string) => {
  const ids = [...path.matchAll(uuidPattern())].map((match) => match[0])
  return ids[0]
}

const normalizedAgentSlug = (
  value: unknown,
  teamAgents: DigitalTeamAgent[]
) => {
  const text = typeof value === 'string' ? value : ''
  if (!text || text.length > 2_000) return undefined
  const normalized = text.toLocaleLowerCase()
  for (const agent of teamAgents) {
    const aliases = [agent.slug, agent.name, agent.en].filter(
      (alias): alias is string => Boolean(alias)
    )
    if (
      aliases.some((alias) => normalized.includes(alias.toLocaleLowerCase()))
    ) {
      return agent.slug
    }
  }
  return undefined
}

const routeAgentFromMessage = (
  value: unknown,
  teamAgents: DigitalTeamAgent[]
) => {
  const text = typeof value === 'string' ? value : ''
  const route = text.match(/本次使用：(.+?)(?:；|;|\n|$)/)?.[1]
  if (!route || route.includes('未使用子 Agent')) return undefined
  return normalizedAgentSlug(route, teamAgents)
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
  teamAgents = digitalTeamAgents()
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

    const skillName = normalizedAgentSlug(record.payload?.arguments, teamAgents)
    if (skillName) {
      current.usedSkill = true
      current.primaryAgent ??= skillName
    }

    if (
      record.payload?.type === 'message' &&
      record.payload.role === 'assistant'
    ) {
      const text = (record.payload.content || [])
        .map((part) => part.text || '')
        .join('\n')
      const routeAgent = routeAgentFromMessage(text, teamAgents)
      if (routeAgent) {
        current.usedSkill = true
        current.primaryAgent = routeAgent
      }
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
      sessionId: parentSessionId(path),
      modifiedAt: (await stat(path)).mtimeMs,
    }))
  )
  const grouped = new Map<string, Array<{ path: string; modifiedAt: number }>>()
  for (const entry of ranked) {
    if (!entry.sessionId) continue
    const files = grouped.get(entry.sessionId) || []
    files.push({ path: entry.path, modifiedAt: entry.modifiedAt })
    grouped.set(entry.sessionId, files)
  }
  return [...grouped.entries()]
    .map(([sessionId, files]) => ({
      sessionId,
      files: files.sort((left, right) => left.modifiedAt - right.modifiedAt),
      modifiedAt: Math.max(...files.map((file) => file.modifiedAt)),
    }))
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
  const teamAgents = digitalTeamAgents()
  const snapshots: DeepSeekSessionSnapshot[] = []
  for (const entry of await findParentSessions(root)) {
    const lines: string[] = []
    for (const file of entry.files) {
      const stream = createInterface({
        input: createReadStream(file.path, 'utf8'),
      })
      for await (const line of stream) lines.push(line)
    }
    snapshots.push(
      ...summarizeCodexLines(
        lines,
        entry.sessionId,
        now,
        names.get(entry.sessionId),
        teamAgents
      )
    )
  }
  return snapshots
}
