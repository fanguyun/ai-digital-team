#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  collectRuntimeTelemetry,
  mergeRuntimeMetadata,
  resolveTelemetryMode,
} from './runtime-telemetry.mjs'

try {
  process.loadEnvFile()
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const DEFAULT_API_URL = 'http://127.0.0.1:8901/graphql'
const STAGE_ORDER = [
  'INTAKE',
  'PLANNING',
  'EXECUTION',
  'VERIFICATION',
  'DELIVERY',
]

const TASK_FIELDS = `
  id
  title
  platform
  externalReference
  primaryAgent
  status
  currentStage
  summary
  version
  startedAt
  updatedAt
  completedAt
`

const usage = `task-runtime <command> [options]

Commands:
  start               Create a task run
  event               Append a custom task event
  wait-confirmation   Mark a task as waiting for confirmation
  resume              Resume a waiting task
  complete            Complete a task
  fail                Fail a task
  cancel              Cancel a task
  list                List task runs
  show                Show a task and its event timeline
  health              Check runtime health

Common options:
  --api-url <url>              GraphQL endpoint
  --token <token>              Runtime writer token
  --model-id <id>              Model used for this task event
  --input-tokens <count>       Incremental input token usage
  --output-tokens <count>      Incremental output token usage
  --cached-tokens <count>      Incremental cached input token usage
  --telemetry <auto|off>       Auto-read platform telemetry (default: auto)
  --json                       Print JSON
  --idempotency-key <key>      Stable retry key for writes

Runtime metadata environment fallbacks:
  TASK_RUNTIME_MODEL_ID
  TASK_RUNTIME_INPUT_TOKENS
  TASK_RUNTIME_OUTPUT_TOKENS
  TASK_RUNTIME_CACHED_TOKENS
  TASK_RUNTIME_TELEMETRY=auto|off

Run task-runtime <command> --help for examples.`

export const parseArguments = (argv) => {
  const [command, ...rest] = argv
  const options = {}
  const positionals = []

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const separator = token.indexOf('=')
    if (separator > -1) {
      options[token.slice(2, separator)] = token.slice(separator + 1)
      continue
    }

    const key = token.slice(2)
    const next = rest[index + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
      continue
    }

    options[key] = next
    index += 1
  }

  return { command, options, positionals }
}

const requiredOption = (options, key) => {
  const value = options[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required option --${key}`)
  }
  return value.trim()
}

const optionalText = (options, key) => {
  const value = options[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const optionalTokenCount = (options, key) => {
  const value = optionalText(options, key)
  if (value === undefined) return undefined
  return parseTokenCount(value, `--${key}`)
}

const parseTokenCount = (value, source) => {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) {
    throw new Error(`${source} must be a non-negative 32-bit integer`)
  }
  return parsed
}

export const resolveRuntimeMetadata = (options, env = process.env) => {
  const environmentText = (key) => {
    const value = env[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
  const environmentTokenCount = (key) => {
    const value = environmentText(key)
    return value === undefined ? undefined : parseTokenCount(value, key)
  }

  return {
    inputTokens:
      optionalTokenCount(options, 'input-tokens') ??
      environmentTokenCount('TASK_RUNTIME_INPUT_TOKENS'),
    outputTokens:
      optionalTokenCount(options, 'output-tokens') ??
      environmentTokenCount('TASK_RUNTIME_OUTPUT_TOKENS'),
    cachedTokens:
      optionalTokenCount(options, 'cached-tokens') ??
      environmentTokenCount('TASK_RUNTIME_CACHED_TOKENS'),
    modelId:
      optionalText(options, 'model-id') ??
      environmentText('TASK_RUNTIME_MODEL_ID'),
  }
}

const resolveRuntimeMetadataWithTelemetry = async ({
  options,
  platform,
  since,
  includeTokens,
  env = process.env,
}) => {
  const configured = resolveRuntimeMetadata(options, env)
  if (resolveTelemetryMode(options, env) === 'off') {
    return { metadata: configured, telemetry: { source: 'off', warnings: [] } }
  }

  const requiredKeys = includeTokens
    ? ['modelId', 'inputTokens', 'outputTokens', 'cachedTokens']
    : ['modelId']
  if (requiredKeys.every((key) => configured[key] !== undefined)) {
    return {
      metadata: configured,
      telemetry: { source: 'configured', warnings: [] },
    }
  }

  const automatic = await collectRuntimeTelemetry({
    platform,
    since,
    includeTokens,
    env,
  })
  return {
    metadata: mergeRuntimeMetadata(configured, automatic.metadata),
    telemetry: {
      source: automatic.source,
      warnings: automatic.warnings,
    },
  }
}

export const formatEventTokenUsage = ({ inputTokens, outputTokens }) => {
  if (inputTokens == null && outputTokens == null) return '-'

  const total = (inputTokens ?? 0) + (outputTokens ?? 0)
  return inputTokens == null || outputTokens == null
    ? `${total}（部分）`
    : String(total)
}

const parseSkills = (value) =>
  typeof value === 'string'
    ? [
        ...new Set(
          value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ]
    : []

const parseEvidence = (options) => {
  const raw = optionalText(options, 'evidence')
  const path = optionalText(options, 'evidence-path')
  if (raw && path) {
    throw new Error('Use either --evidence or --evidence-path, not both')
  }
  if (path) return { path }
  if (!raw) return undefined

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Evidence must be a JSON object')
    }
    return parsed
  } catch (error) {
    throw new Error(
      error instanceof SyntaxError
        ? `Invalid --evidence JSON: ${error.message}`
        : error.message
    )
  }
}

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

export const createStableIdempotencyKey = (command, payload) => {
  const digest = createHash('sha256')
    .update(JSON.stringify(canonicalize({ command, payload })))
    .digest('hex')
    .slice(0, 32)
  return `task-runtime:${command}:${digest}`
}

export const graphqlRequest = async ({
  apiUrl = process.env.TASK_RUNTIME_API_URL || DEFAULT_API_URL,
  token,
  query,
  variables,
  fetchImpl = fetch,
}) => {
  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`Runtime API returned HTTP ${response.status}`)
  }

  if (!response.ok || body.errors?.length) {
    const detail = body.errors?.map((error) => error.message).join('; ')
    throw new Error(detail || `Runtime API returned HTTP ${response.status}`)
  }

  return body.data
}

const resolveConnection = (options) => ({
  apiUrl: optionalText(options, 'api-url'),
  token: optionalText(options, 'token') || process.env.TASK_RUNTIME_WRITE_TOKEN,
})

const requestTask = async (id, connection) => {
  const data = await graphqlRequest({
    ...connection,
    query: `
      query TaskRuntimeShow($id: ID!) {
        taskRun(id: $id) {
          ${TASK_FIELDS}
          events {
            id
            sequence
            eventType
            status
            stage
            agent
            skills
            summary
            evidence
            inputTokens
            outputTokens
            cachedTokens
            modelId
            idempotencyKey
            createdAt
          }
        }
      }
    `,
    variables: { id },
  })
  if (!data.taskRun) throw new Error(`Task run not found: ${id}`)
  return data.taskRun
}

const createTask = async (options) => {
  const connection = resolveConnection(options)
  if (!connection.token) throw new Error('TASK_RUNTIME_WRITE_TOKEN is required')
  const platform = optionalText(options, 'platform') || 'codex'
  const { metadata: runtimeMetadata, telemetry } =
    await resolveRuntimeMetadataWithTelemetry({
      options,
      platform,
      includeTokens: false,
    })

  const input = {
    title: requiredOption(options, 'title'),
    platform,
    externalReference: optionalText(options, 'external-reference'),
    primaryAgent: optionalText(options, 'agent') || 'software-engineer-agent',
    status: optionalText(options, 'status') || 'RUNNING',
    stage: optionalText(options, 'stage') || 'INTAKE',
    summary: optionalText(options, 'summary'),
    skills: parseSkills(options.skills),
    evidence: parseEvidence(options),
  }
  input.idempotencyKey =
    optionalText(options, 'idempotency-key') ||
    createStableIdempotencyKey('start', input)
  Object.assign(input, runtimeMetadata)

  const data = await graphqlRequest({
    ...connection,
    query: `
      mutation TaskRuntimeStart($input: CreateTaskRunInput!) {
        createTaskRun(input: $input) { ${TASK_FIELDS} }
      }
    `,
    variables: { input },
  })
  return {
    ...data.createTaskRun,
    ...(telemetry.source !== 'off' || telemetry.warnings.length
      ? { telemetry }
      : {}),
  }
}

const EVENT_DEFAULTS = {
  'wait-confirmation': {
    eventType: 'task.waiting_confirmation',
    status: 'WAITING_CONFIRMATION',
    stage: 'VERIFICATION',
    summary: 'Waiting for confirmation',
  },
  resume: {
    eventType: 'task.resumed',
    status: 'RUNNING',
    summary: 'Task resumed',
  },
  complete: {
    eventType: 'task.completed',
    status: 'COMPLETED',
    stage: 'DELIVERY',
    summary: 'Task completed',
  },
  fail: {
    eventType: 'task.failed',
    status: 'FAILED',
    summary: 'Task failed',
  },
  cancel: {
    eventType: 'task.cancelled',
    status: 'CANCELLED',
    summary: 'Task cancelled',
  },
}

const appendEvent = async (command, options, positionals) => {
  const connection = resolveConnection(options)
  if (!connection.token) throw new Error('TASK_RUNTIME_WRITE_TOKEN is required')
  const taskRunId = optionalText(options, 'id') || positionals[0]
  if (!taskRunId) throw new Error('Missing task run id (--id <uuid>)')

  const current = await requestTask(taskRunId, connection)
  const defaults = EVENT_DEFAULTS[command] || {}
  const latestEventAt = current.events.reduce((latest, event) => {
    const timestamp = Date.parse(event.createdAt)
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest
  }, 0)
  const { metadata: runtimeMetadata, telemetry } =
    await resolveRuntimeMetadataWithTelemetry({
      options,
      platform: current.platform,
      since: latestEventAt ? new Date(latestEventAt).toISOString() : undefined,
      includeTokens: true,
    })
  const defaultStage = defaults.stage
  const stage =
    optionalText(options, 'stage') ||
    (defaultStage &&
    STAGE_ORDER.indexOf(defaultStage) >
      STAGE_ORDER.indexOf(current.currentStage)
      ? defaultStage
      : current.currentStage)
  const input = {
    eventType:
      optionalText(options, 'event-type') ||
      defaults.eventType ||
      requiredOption(options, 'event-type'),
    status: optionalText(options, 'status') || defaults.status,
    stage,
    agent: optionalText(options, 'agent') || current.primaryAgent,
    skills: parseSkills(options.skills),
    summary:
      optionalText(options, 'summary') ||
      defaults.summary ||
      requiredOption(options, 'summary'),
    evidence: parseEvidence(options),
  }
  input.idempotencyKey =
    optionalText(options, 'idempotency-key') ||
    createStableIdempotencyKey(command, { taskRunId, ...input })
  Object.assign(input, runtimeMetadata)

  const data = await graphqlRequest({
    ...connection,
    query: `
      mutation TaskRuntimeEvent($taskRunId: ID!, $input: AppendTaskEventInput!) {
        appendTaskEvent(taskRunId: $taskRunId, input: $input) {
          duplicate
          taskRun { ${TASK_FIELDS} }
          event {
            id sequence eventType status stage agent skills summary evidence
            inputTokens outputTokens cachedTokens modelId idempotencyKey createdAt
          }
        }
      }
    `,
    variables: { taskRunId, input },
  })
  return {
    ...data.appendTaskEvent,
    ...(telemetry.source !== 'off' || telemetry.warnings.length
      ? { telemetry }
      : {}),
  }
}

const listTasks = async (options) => {
  const statuses = optionalText(options, 'status')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const firstValue = optionalText(options, 'first') || '25'
  const first = Number.parseInt(firstValue, 10)
  if (!Number.isInteger(first) || first < 1) {
    throw new Error('--first must be a positive integer')
  }

  const filter = {
    ...(statuses?.length ? { statuses } : {}),
    ...(optionalText(options, 'platform')
      ? { platform: optionalText(options, 'platform') }
      : {}),
    ...(optionalText(options, 'agent')
      ? { primaryAgent: optionalText(options, 'agent') }
      : {}),
  }
  const data = await graphqlRequest({
    ...resolveConnection(options),
    query: `
      query TaskRuntimeList($filter: TaskRunFilter, $after: String, $first: Int) {
        taskRuns(filter: $filter, after: $after, first: $first) {
          edges { cursor node { ${TASK_FIELDS} } }
          pageInfo { endCursor hasNextPage }
        }
      }
    `,
    variables: {
      filter: Object.keys(filter).length ? filter : undefined,
      after: optionalText(options, 'after'),
      first,
    },
  })
  return data.taskRuns
}

const runtimeHealth = async (options) => {
  const data = await graphqlRequest({
    ...resolveConnection(options),
    query: `
      query TaskRuntimeHealth {
        runtimeHealth {
          database { status message }
          realtime { status message }
          serverTime
        }
      }
    `,
  })
  return data.runtimeHealth
}

export const executeCommand = async ({ command, options, positionals }) => {
  if (!command || command === 'help' || options.help) return { help: usage }

  switch (command) {
    case 'start':
      return createTask(options)
    case 'event':
    case 'wait-confirmation':
    case 'resume':
    case 'complete':
    case 'fail':
    case 'cancel':
      return appendEvent(command, options, positionals)
    case 'list':
      return listTasks(options)
    case 'show': {
      const id = optionalText(options, 'id') || positionals[0]
      if (!id) throw new Error('Missing task run id (--id <uuid>)')
      return requestTask(id, resolveConnection(options))
    }
    case 'health':
      return runtimeHealth(options)
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(value))
    : '-'

const printResult = (command, result, json) => {
  if (result.help) {
    console.log(result.help)
    return
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  for (const warning of result.telemetry?.warnings || []) {
    console.warn(`Telemetry warning: ${warning}`)
  }
  if (command === 'list') {
    console.table(
      result.edges.map(({ node }) => ({
        id: node.id,
        status: node.status,
        stage: node.currentStage,
        platform: node.platform,
        agent: node.primaryAgent,
        updatedAt: formatDate(node.updatedAt),
        title: node.title,
      }))
    )
    if (result.pageInfo.hasNextPage) {
      console.log(`Next cursor: ${result.pageInfo.endCursor}`)
    }
    return
  }
  if (command === 'health') {
    console.table({
      database: result.database,
      realtime: result.realtime,
    })
    console.log(`Server time: ${formatDate(result.serverTime)}`)
    return
  }
  if (command === 'show') {
    console.log(`${result.title} [${result.status}/${result.currentStage}]`)
    console.log(`${result.id} | ${result.platform} | ${result.primaryAgent}`)
    if (result.summary) console.log(result.summary)
    console.table(
      result.events.map((event) => ({
        sequence: event.sequence,
        status: event.status || '-',
        stage: event.stage,
        agent: event.agent,
        model: event.modelId || '-',
        tokens: formatEventTokenUsage(event),
        time: formatDate(event.createdAt),
        summary: event.summary,
      }))
    )
    return
  }
  const task = result.taskRun || result
  const duplicate =
    'duplicate' in result ? ` duplicate=${result.duplicate}` : ''
  console.log(
    `${task.id} ${task.status}/${task.currentStage}${duplicate}\n${task.title}\n${task.summary || ''}`.trim()
  )
}

export const main = async (argv = process.argv.slice(2)) => {
  const parsed = parseArguments(argv)
  const result = await executeCommand(parsed)
  printResult(parsed.command, result, parsed.options.json === true)
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  main().catch((error) => {
    console.error(`task-runtime: ${error.message}`)
    process.exitCode = 1
  })
}

export { usage }
