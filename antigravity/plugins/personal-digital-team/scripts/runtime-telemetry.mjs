import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import { zstdDecompress } from 'node:zlib'

const MAX_TOKEN_COUNT = 2_147_483_647
const ZSTD_FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const decompressZstdFrame = promisify(zstdDecompress)

const parseTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
const tokenCount = (value) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

const addTokenCounts = (left = 0, right = 0) => {
  const total = left + right
  if (!Number.isSafeInteger(total) || total > MAX_TOKEN_COUNT) {
    throw new Error('Token usage exceeds the GraphQL Int limit')
  }
  return total
}

const afterBoundary = (timestamp, since) => {
  const timestampMs = parseTimestamp(timestamp)
  const sinceMs = parseTimestamp(since)
  if (timestampMs === undefined) return false
  return sinceMs === undefined || timestampMs > sinceMs
}

async function findFiles(root, predicate) {
  const matches = []
  const directories = [root]

  while (directories.length > 0) {
    const directory = directories.pop()
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) directories.push(path)
      if (entry.isFile() && predicate(path, entry.name)) matches.push(path)
    }
  }

  return matches
}

async function newestFile(paths) {
  const candidates = await Promise.all(
    paths.map(async (path) => {
      try {
        return { path, modifiedAt: (await stat(path)).mtimeMs }
      } catch {
        return undefined
      }
    })
  )

  return candidates
    .filter(Boolean)
    .sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.path
}

async function* fileLines(path) {
  const stream = createReadStream(path, { encoding: 'utf8' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of lines) yield line
}

export async function* readZstdLines(path) {
  const compressed = await readFile(path)
  const frameOffsets = []
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

export const readCodexTelemetryFile = async (
  path,
  { since, includeTokens = true } = {}
) => {
  const turnModels = new Map()
  let latestModelId
  let inputTokens
  let outputTokens
  let cachedTokens

  for await (const line of fileLines(path)) {
    if (
      !line.includes('"turn_context"') &&
      !line.includes('"token_usage_record"')
    ) {
      continue
    }

    let record
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }

    if (record.type === 'turn_context') {
      const modelId = record.payload?.model
      const turnId = record.payload?.turn_id
      if (typeof modelId === 'string' && modelId.trim()) {
        latestModelId = modelId.trim()
        if (typeof turnId === 'string' && turnId) {
          turnModels.set(turnId, latestModelId)
        }
      }
      continue
    }

    if (
      !includeTokens ||
      record.type !== 'token_usage_record' ||
      !afterBoundary(record.timestamp, since)
    ) {
      continue
    }

    const usage = record.payload?.usage
    if (!usage || typeof usage !== 'object') continue

    const eventInput = tokenCount(usage.input_tokens)
    const eventOutput = tokenCount(usage.output_tokens)
    const eventCached = tokenCount(usage.cached_input_tokens)
    if (eventInput !== undefined) {
      inputTokens = addTokenCounts(inputTokens, eventInput)
    }
    if (eventOutput !== undefined) {
      outputTokens = addTokenCounts(outputTokens, eventOutput)
    }
    if (eventCached !== undefined) {
      cachedTokens = addTokenCounts(cachedTokens, eventCached)
    }

    const turnModel = turnModels.get(record.payload?.turn_id)
    if (turnModel) latestModelId = turnModel
  }

  return { modelId: latestModelId, inputTokens, outputTokens, cachedTokens }
}

const extractJsonNumber = (text, key) => {
  const match = text.match(new RegExp(`"${key}":(\\d+)`))
  return match ? tokenCount(match[1]) : undefined
}

export const parseDeepSeekTelemetryLine = (line) => {
  if (!line.includes('"type":"assistant/message"')) return undefined

  const usageIndex = line.lastIndexOf('"usage":{')
  if (usageIndex < 0) return undefined

  const usageText = line.slice(usageIndex)
  const inputTokens = extractJsonNumber(usageText, 'inputTokens')
  const outputTokens = extractJsonNumber(usageText, 'outputTokens')
  const cachedTokens = extractJsonNumber(usageText, 'cacheReadTokens')
  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    cachedTokens === undefined
  ) {
    return undefined
  }

  const sourceText = line.slice(0, usageIndex)
  const sourceMatches = [
    ...sourceText.matchAll(
      /"source":\{[^{}]{0,500}?"model":"([^"]+)"/g
    ),
  ]
  const modelId = sourceMatches.at(-1)?.[1]
  const headerText = line.slice(0, line.indexOf('"data":'))
  const timestamp = Number(headerText.match(/"time":(\d+)/)?.[1])

  return {
    timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
    modelId,
    inputTokens:
      inputTokens === undefined && cachedTokens === undefined
        ? undefined
        : addTokenCounts(inputTokens, cachedTokens),
    outputTokens,
    cachedTokens,
  }
}

export const readDeepSeekTelemetryLines = async (
  lines,
  { since, includeTokens = true } = {}
) => {
  let latestModelId
  let inputTokens
  let outputTokens
  let cachedTokens

  for await (const line of lines) {
    const record = parseDeepSeekTelemetryLine(line)
    if (!record) continue
    if (record.modelId) latestModelId = record.modelId
    if (!includeTokens || !afterBoundary(record.timestamp, since)) continue

    if (record.inputTokens !== undefined) {
      inputTokens = addTokenCounts(inputTokens, record.inputTokens)
    }
    if (record.outputTokens !== undefined) {
      outputTokens = addTokenCounts(outputTokens, record.outputTokens)
    }
    if (record.cachedTokens !== undefined) {
      cachedTokens = addTokenCounts(cachedTokens, record.cachedTokens)
    }
  }

  return { modelId: latestModelId, inputTokens, outputTokens, cachedTokens }
}

const comparablePath = (value) =>
  String(value || '')
    .replaceAll('\\', '/')
    .replace(/^\/([a-z])\//i, '$1:/')
    .replace(/\/$/, '')
    .toLowerCase()

async function resolveDeepSeekSessionIds(dshHome, cwd) {
  try {
    const workspace = JSON.parse(
      await readFile(join(dshHome, 'storages', 'workspace.json'), 'utf8')
    )
    const currentPath = comparablePath(cwd)
    const match = Object.values(workspace.tables?.workspaces || {}).find(
      (entry) => comparablePath(entry?.path) === currentPath
    )
    return Array.isArray(match?.sessionIds) ? match.sessionIds : []
  } catch {
    return []
  }
}

async function collectCodexTelemetry({ env, since, includeTokens, home }) {
  const sessionId = resolveCodexSessionId(env)
  if (!sessionId) throw new Error('Codex session id is unavailable')

  const root = join(home, '.codex', 'sessions')
  const candidates = await findFiles(
    root,
    (path, name) => name.endsWith('.jsonl') && path.includes(sessionId)
  )
  const path = await newestFile(candidates)
  if (!path) throw new Error('Codex session log was not found')

  return readCodexTelemetryFile(path, { since, includeTokens })
}

export const resolveCodexSessionId = (env = process.env) =>
  env.CODEX_THREAD_ID || env.CODEX_SESSION_ID

async function collectDeepSeekTelemetry({
  env,
  since,
  includeTokens,
  home,
  cwd,
}) {
  const dshHome = env.DSH_HOME || join(home, '.dsh')
  const sessionIds = env.DSH_SESSION_ID
    ? [env.DSH_SESSION_ID]
    : await resolveDeepSeekSessionIds(dshHome, cwd)
  if (sessionIds.length === 0) {
    throw new Error('DeepSeek Harness session id is unavailable')
  }

  const candidates = await findFiles(
    join(dshHome, 'sessions'),
    (path, name) =>
      name === 'session.v4.jsonl.zstd' &&
      sessionIds.some((sessionId) => path.includes(sessionId))
  )
  const path = await newestFile(candidates)
  if (!path) throw new Error('DeepSeek Harness session log was not found')

  return readDeepSeekTelemetryLines(readZstdLines(path), {
    since,
    includeTokens,
  })
}

export const resolveTelemetryMode = (options, env = process.env) => {
  const value = options.telemetry ?? env.TASK_RUNTIME_TELEMETRY ?? 'auto'
  if (value !== 'auto' && value !== 'off') {
    throw new Error('--telemetry must be auto or off')
  }
  return value
}

export const collectRuntimeTelemetry = async ({
  platform,
  since,
  includeTokens = true,
  env = process.env,
  cwd = process.cwd(),
  home = homedir(),
}) => {
  try {
    if (platform === 'codex') {
      return {
        metadata: await collectCodexTelemetry({
          env,
          since,
          includeTokens,
          home,
        }),
        source: 'codex-session',
        warnings: [],
      }
    }
    if (platform === 'deepseek-harness') {
      return {
        metadata: await collectDeepSeekTelemetry({
          env,
          since,
          includeTokens,
          home,
          cwd,
        }),
        source: 'deepseek-session',
        warnings: [],
      }
    }
    return {
      metadata: {},
      source: 'unsupported',
      warnings: [`Automatic telemetry is unsupported for platform ${platform}`],
    }
  } catch (error) {
    return {
      metadata: {},
      source: platform,
      warnings: [`Automatic telemetry unavailable: ${error.message}`],
    }
  }
}

export const mergeRuntimeMetadata = (configured, automatic) => ({
  inputTokens: configured.inputTokens ?? automatic.inputTokens,
  outputTokens: configured.outputTokens ?? automatic.outputTokens,
  cachedTokens: configured.cachedTokens ?? automatic.cachedTokens,
  modelId: configured.modelId ?? automatic.modelId,
})
