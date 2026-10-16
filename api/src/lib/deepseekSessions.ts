import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import { zstdDecompress } from 'node:zlib'

import { parseDeepSeekTelemetryLine } from '../../../scripts/runtime-telemetry.mjs'

import {
  extractRequestTitle,
  taskTitleKey,
  usableTaskTitle,
} from './sessionTaskTitle'

const decompressZstdFrame = promisify(zstdDecompress)
const ZSTD_FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const ACTIVE_WINDOW_MS = 15 * 60 * 1000
const MAX_SESSIONS = 200

export type DeepSeekSessionSnapshot = {
  sessionId: string
  platform: 'codex' | 'deepseek-harness'
  title: string
  cwdName?: string
  primaryAgent: string
  startedAt: Date
  updatedAt: Date
  status: 'RUNNING' | 'COMPLETED'
  stage: 'EXECUTION' | 'DELIVERY'
  modelId?: string
  inputTokens?: number
  outputTokens?: number
  cachedTokens?: number
}

export const isDigitalTeamProject = (cwd?: string) => {
  const name = cwd ? basename(cwd) : ''
  return name === 'ai-digital-team' || name === 'personal-digital-team'
}

const sessionIdFromPath = (path: string) =>
  path.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  )?.[1]

export const digitalTeamSlugs = () => {
  const manifestPath = [
    join(process.cwd(), 'agents', 'manifest.json'),
    join(process.cwd(), '..', 'agents', 'manifest.json'),
  ].find((path) => existsSync(path))
  if (!manifestPath) return new Set<string>()
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    agents?: Array<{ slug?: string }>
  }
  return new Set(
    (manifest.agents || [])
      .map((agent) => agent.slug)
      .filter(
        (slug): slug is string =>
          typeof slug === 'string' && slug.endsWith('-agent')
      )
  )
}

const skillNameFromCall = (record: {
  type?: string
  data?: { name?: string; arguments?: unknown }
}): string | undefined => {
  if (record.type !== 'tool/call' || record.data?.name !== 'skill')
    return undefined
  const rawArguments = record.data.arguments
  let args = rawArguments
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args)
    } catch {
      return typeof rawArguments === 'string' ? rawArguments : undefined
    }
  }
  if (typeof args === 'string') return args
  if (!args || typeof args !== 'object') return undefined
  const name =
    'name' in args ? args.name : 'skill' in args ? args.skill : undefined
  return typeof name === 'string' ? name : undefined
}

export async function* readZstdLines(path: string) {
  const compressed = await readFile(path)
  const frameOffsets: number[] = []
  let offset = 0
  while ((offset = compressed.indexOf(ZSTD_FRAME_MAGIC, offset)) >= 0) {
    frameOffsets.push(offset)
    offset += ZSTD_FRAME_MAGIC.length
  }
  if (frameOffsets[0] !== 0) throw new Error('Invalid Zstd session log')

  let remainder = ''
  for (let index = 0; index < frameOffsets.length; index += 1) {
    const frame = compressed.subarray(
      frameOffsets[index],
      frameOffsets[index + 1] ?? compressed.length
    )
    const text = remainder + (await decompressZstdFrame(frame)).toString('utf8')
    const lines = text.split(/\r?\n/)
    remainder = lines.pop() ?? ''
    for (const line of lines) yield line
  }
  if (remainder) yield remainder
}

const shortRequest = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  return (
    extractRequestTitle(value) || usableTaskTitle(value, { truncate: false })
  )
}

const userRequest = (data?: {
  content?: Array<{ type?: string; text?: string }>
}) => {
  const text = (data?.content || [])
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
  return shortRequest(text)
}

type OpenTurn = {
  turn: number
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

export const summarizeDeepSeekLines = (
  lines: Iterable<string>,
  sessionId: string,
  now = Date.now(),
  teamSlugs = digitalTeamSlugs()
): DeepSeekSessionSnapshot[] => {
  let cwdName: string | undefined
  let teamProject = false
  let current: OpenTurn | null = null
  const turns: OpenTurn[] = []

  const openTurn = (turn: number, timestamp?: number) => {
    current = {
      turn,
      usedSkill: false,
      startedAt: timestamp,
      updatedAt: timestamp,
    }
    turns.push(current)
  }

  for (const line of lines) {
    if (!line.trim()) continue
    let record: {
      type?: string
      time?: number
      createdAt?: number
      cwd?: string
      data?: {
        title?: string
        name?: string
        arguments?: unknown
        turn?: number
        content?: Array<{ type?: string; text?: string }>
      }
    }
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }

    const timestamp =
      typeof record.time === 'number'
        ? record.time
        : typeof record.createdAt === 'number'
          ? record.createdAt
          : undefined

    if (record.type === 'session') {
      if (typeof record.cwd === 'string' && record.cwd.trim()) {
        cwdName = basename(record.cwd)
        teamProject = isDigitalTeamProject(record.cwd)
      }
      continue
    }

    if (record.type === 'turn/start') {
      openTurn(record.data?.turn || turns.length + 1, timestamp)
      continue
    }

    if (
      !current &&
      (record.type === 'user/message' || record.type === 'tool/call')
    ) {
      openTurn(turns.length + 1, timestamp)
    }
    if (!current) continue
    if (timestamp !== undefined) {
      current.startedAt ??= timestamp
      current.updatedAt = timestamp
    }

    if (record.type === 'user/message') {
      current.title ??= userRequest(record.data)
    }

    const skillName = skillNameFromCall(record)
    if (skillName && teamSlugs.has(skillName)) {
      current.usedSkill = true
      current.primaryAgent ??= skillName
    }

    const usage = parseDeepSeekTelemetryLine(line) as
      | {
          modelId?: string
          inputTokens?: number
          outputTokens?: number
          cachedTokens?: number
        }
      | undefined
    if (!usage) continue
    if (usage.modelId) current.modelId = usage.modelId
    if (usage.inputTokens !== undefined) {
      current.inputTokens = (current.inputTokens ?? 0) + usage.inputTokens
    }
    if (usage.outputTokens !== undefined) {
      current.outputTokens = (current.outputTokens ?? 0) + usage.outputTokens
    }
    if (usage.cachedTokens !== undefined) {
      current.cachedTokens = (current.cachedTokens ?? 0) + usage.cachedTokens
    }
  }

  const seenTitles = new Set<string>()
  return turns
    .filter((turn) => turn.title && (teamProject || turn.usedSkill))
    .filter((turn) => {
      if (!turn.title) return false
      const titleKey = taskTitleKey(turn.title)
      if (!titleKey || seenTitles.has(titleKey)) return false
      seenTitles.add(titleKey)
      return true
    })
    .map((turn) => {
      const started = new Date(turn.startedAt ?? now)
      const updated = new Date(turn.updatedAt ?? turn.startedAt ?? now)
      const running = now - updated.getTime() < ACTIVE_WINDOW_MS
      return {
        sessionId: `${sessionId}:${turn.turn}`,
        platform: 'deepseek-harness' as const,
        title: turn.title,
        cwdName,
        primaryAgent: turn.primaryAgent || 'main-agent',
        startedAt: started,
        updatedAt: updated,
        status: running ? ('RUNNING' as const) : ('COMPLETED' as const),
        stage: running ? ('EXECUTION' as const) : ('DELIVERY' as const),
        modelId: turn.modelId,
        inputTokens: turn.inputTokens,
        outputTokens: turn.outputTokens,
        cachedTokens: turn.cachedTokens,
      }
    })
}

const findSessionFiles = async (root: string) => {
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
      if (entry.isFile() && entry.name === 'session.v4.jsonl.zstd')
        matches.push(path)
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
    .map((entry) => entry.path)
}

export const sessionRoot = () =>
  process.env.DEEPSEEK_SESSION_ROOT ||
  join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'sessions')

export const loadDeepSeekSessions = async (
  root = sessionRoot(),
  now = Date.now()
) => {
  const snapshots: DeepSeekSessionSnapshot[] = []
  for (const path of await findSessionFiles(root)) {
    const sessionId = sessionIdFromPath(path)
    if (!sessionId) continue
    const lines: string[] = []
    try {
      for await (const line of readZstdLines(path)) lines.push(line)
    } catch {
      continue
    }
    snapshots.push(...summarizeDeepSeekLines(lines, sessionId, now))
  }
  return snapshots
}
