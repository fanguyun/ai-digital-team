/**
 * Host half of the personal-digital-team-panel plugin.
 *
 * Serves the team manifest and the read-only team pulse:
 *   GET /api/personal-digital-team/team
 *   GET /api/personal-digital-team/live
 *
 * The manifest is located by config (`teamRoot`), environment, the process
 * working directory, or the package's own location. The pulse queries the team
 * task API with a read-only bearer token; the token is read from host config,
 * the host environment, or the team checkout's `.env`, and never reaches the
 * browser.
 */

import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeTeam } from './normalize.js'

export const name = 'personal-digital-team-panel'
export const inject = ['connection']

export const TEAM_ROUTE = '/api/personal-digital-team/team'
export const LIVE_ROUTE = '/api/personal-digital-team/live'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const snapshotPath = join(packageRoot, 'lib', 'data', 'team.json')
const MAX_ANCESTOR_DEPTH = 8
const LIVE_CACHE_MS = 15_000
const LIVE_TIMEOUT_MS = 8_000
const DEFAULT_API_URL = 'http://127.0.0.1:8901/graphql'

const LIVE_QUERY = `query TeamLive($today: RuntimeTimeRange, $week: RuntimeTimeRange) {
  today: teamRuntimeOverview(range: $today) {
    totalTaskCount
    totalWorkCount
    inputTokens
    outputTokens
    cachedTokens
    totalTokens
    totalTokenCoverage
    runningCount
    waitingCount
    queuedCount
    agents {
      agent
      workCount
      inputTokens
      outputTokens
      cachedTokens
      totalTokens
      totalTokenCoverage
      runningCount
      waitingCount
      queuedCount
      latestModelId
      lastTaskAt
    }
    activeTasks {
      id
      taskId
      title
      primaryAgent
      status
      currentStage
      updatedAt
    }
  }
  week: teamRuntimeOverview(range: $week) {
    totalTaskCount
    totalWorkCount
    inputTokens
    outputTokens
    cachedTokens
    totalTokens
    totalTokenCoverage
    runningCount
    waitingCount
    queuedCount
    agents {
      agent
      workCount
      inputTokens
      outputTokens
      cachedTokens
      totalTokens
      totalTokenCoverage
      runningCount
      waitingCount
      queuedCount
      latestModelId
      lastTaskAt
    }
    activeTasks {
      id
      taskId
      title
      primaryAgent
      status
      currentStage
      updatedAt
    }
  }
}`

let cache = null
let liveCache = null

function manifestAt(root) {
  return join(root, 'agents', 'manifest.json')
}

function ancestors(start) {
  const roots = []
  let current = resolve(start)
  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH; depth += 1) {
    roots.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return roots
}

function candidateRoots(config) {
  const roots = []
  if (config !== null && typeof config === 'object') {
    const configured = config.teamRoot
    if (typeof configured === 'string' && configured.trim() !== '') {
      roots.push(resolve(configured.trim()))
    }
  }
  const fromEnvironment = process.env.PERSONAL_DIGITAL_TEAM_ROOT
  if (typeof fromEnvironment === 'string' && fromEnvironment.trim() !== '') {
    roots.push(resolve(fromEnvironment.trim()))
  }
  roots.push(...ancestors(process.cwd()))
  roots.push(...ancestors(packageRoot))
  return [...new Set(roots)]
}

export function findTeamRoot(config) {
  for (const root of candidateRoots(config)) {
    if (existsSync(manifestAt(root))) return root
  }
  return null
}

export function findManifest(config) {
  const root = findTeamRoot(config)
  return root === null ? null : manifestAt(root)
}

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

async function readSnapshot() {
  const file = snapshotPath
  const stats = await stat(file)
  const parsed = JSON.parse(await readFile(file, 'utf8'))
  return {
    ...normalizeTeam(parsed),
    meta: {
      source: 'snapshot',
      generatedAt:
        typeof parsed.meta?.generatedAt === 'string'
          ? parsed.meta.generatedAt
          : stats.mtime.toISOString(),
    },
  }
}

export async function loadTeam(config = {}) {
  const manifest = findManifest(config)
  if (manifest === null) return readSnapshot()

  const stats = await stat(manifest)
  if (cache !== null && cache.file === manifest && cache.mtimeMs === stats.mtimeMs) {
    return cache.value
  }

  const parsed = JSON.parse(await readFile(manifest, 'utf8'))
  const value = {
    ...normalizeTeam(parsed),
    meta: {
      source: 'live',
      loadedAt: new Date().toISOString(),
      manifestUpdatedAt: stats.mtime.toISOString(),
    },
  }
  cache = { file: manifest, mtimeMs: stats.mtimeMs, value }
  return value
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

function parseEnv(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (match === null) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

async function readTeamSettings(config) {
  const root = findTeamRoot(config)
  let env = {}
  if (root !== null) {
    try {
      env = parseEnv(await readFile(join(root, '.env'), 'utf8'))
    } catch {
      env = {}
    }
  }

  const token = firstText(
    config.readToken,
    process.env.PERSONAL_DIGITAL_TEAM_READ_TOKEN,
    process.env.TEAM_READ_TOKEN,
    env.TEAM_READ_TOKEN
  )
  const apiUrl = firstText(
    config.apiUrl,
    process.env.PERSONAL_DIGITAL_TEAM_API_URL,
    env.TASK_RUNTIME_API_URL,
    DEFAULT_API_URL
  )
  const appUrl = firstText(
    config.appUrl,
    process.env.PERSONAL_DIGITAL_TEAM_APP_URL,
    env.TEAM_APP_URL,
    'http://127.0.0.1:8900'
  ).replace(/\/+$/, '')

  return { root, apiUrl, appUrl, token }
}

function pickTotals(overview) {
  return {
    taskCount: overview.totalWorkCount,
    totalTaskCount: overview.totalTaskCount,
    inputTokens: overview.inputTokens,
    outputTokens: overview.outputTokens,
    cachedTokens: overview.cachedTokens,
    totalTokens: overview.totalTokens,
    tokenCoverage: overview.totalTokenCoverage,
    runningCount: overview.runningCount,
    waitingCount: overview.waitingCount,
    queuedCount: overview.queuedCount,
  }
}

function pickAgents(todayOverview, weekOverview) {
  const todayByAgent = new Map(
    (todayOverview.agents || []).map((agent) => [agent.agent, agent])
  )
  const taskPriority = {
    RUNNING: 0,
    WAITING_CONFIRMATION: 1,
    QUEUED: 2,
  }
  const activeByAgent = new Map()
  for (const task of weekOverview.activeTasks || []) {
    const current = activeByAgent.get(task.primaryAgent)
    const rank = taskPriority[task.status] ?? 3
    const currentRank = current === undefined ? 99 : (taskPriority[current.status] ?? 3)
    const updated = Date.parse(task.updatedAt)
    const currentUpdated = current === undefined ? 0 : Date.parse(current.updatedAt)
    if (rank < currentRank || (rank === currentRank && updated > currentUpdated)) {
      activeByAgent.set(task.primaryAgent, task)
    }
  }

  return (weekOverview.agents || []).map((agent) => {
    const today = todayByAgent.get(agent.agent)
    const active = activeByAgent.get(agent.agent)
    return {
      agent: agent.agent,
      weekTaskCount: agent.workCount,
      weekInputTokens: agent.inputTokens,
      weekOutputTokens: agent.outputTokens,
      weekCachedTokens: agent.cachedTokens,
      weekTotalTokens: agent.totalTokens,
      weekTokenCoverage: agent.totalTokenCoverage,
      todayTaskCount: today?.workCount ?? 0,
      todayTotalTokens: today?.totalTokens ?? 0,
      runningCount: agent.runningCount,
      waitingCount: agent.waitingCount,
      queuedCount: agent.queuedCount,
      latestModelId: agent.latestModelId,
      lastActiveAt: agent.lastTaskAt,
      activeTask:
        active === undefined
          ? null
          : {
              id: active.id,
              taskId: active.taskId,
              title: active.title,
              status: active.status,
              stage: active.currentStage,
              updatedAt: active.updatedAt,
            },
    }
  })
}

function liveRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
  const today = new Date(to)
  today.setHours(0, 0, 0, 0)

  return {
    variables: {
      today: { from: today.toISOString(), to: to.toISOString() },
      week: { from: from.toISOString(), to: to.toISOString() },
    },
    weekFrom: from,
    todayFrom: today,
    to,
  }
}

export async function loadLive(config = {}, { force = false } = {}) {
  if (!force && liveCache !== null && Date.now() - liveCache.at < LIVE_CACHE_MS) {
    return liveCache.value
  }

  const { apiUrl, appUrl, token } = await readTeamSettings(config)
  if (token === '') {
    throw new Error('未配置 TEAM_READ_TOKEN（只读聚合 token）')
  }

  const range = liveRange()
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: LIVE_QUERY,
      variables: range.variables,
    }),
    signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`任务 API 返回 HTTP ${response.status}`)
  }

  const body = await response.json()
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const message = body.errors
      .map((error) => (typeof error?.message === 'string' ? error.message : ''))
      .filter(Boolean)
      .join('; ')
    throw new Error(message || '任务 API 返回错误')
  }

  const todayOverview = body.data?.today
  const weekOverview = body.data?.week
  if (todayOverview === undefined || weekOverview === undefined) {
    throw new Error('任务 API 返回的数据不完整')
  }

  const value = {
    generatedAt: new Date().toISOString(),
    appUrl,
    range: {
      todayFrom: range.todayFrom.toISOString(),
      weekFrom: range.weekFrom.toISOString(),
      to: range.to.toISOString(),
    },
    today: pickTotals(todayOverview),
    week: pickTotals(weekOverview),
    agents: pickAgents(todayOverview, weekOverview),
  }
  liveCache = { at: Date.now(), value }
  return value
}

export function apply(ctx, config = {}) {
  const logger = ctx.logger('personal-digital-team-panel')

  ctx.inject(['connection'], (scope) => {
    const connection = scope.get('connection')
    const registry = connection?.fetch
    const register = registry?.register
    if (registry === undefined || typeof register !== 'function') {
      logger.warn(
        'host connection exposes no fetch registry; the team panel will have no data'
      )
      return
    }

    const handleTeam = async () => {
      try {
        return json({ ok: true, value: await loadTeam(config) })
      } catch (error) {
        logger.warn(`team manifest unavailable: ${String(error)}`)
        return json(
          {
            ok: false,
            error: {
              code: 'team-unavailable',
              message: `无法读取团队清单：${error instanceof Error ? error.message : String(error)}`,
            },
          },
          500
        )
      }
    }

    const handleLive = async (request) => {
      try {
        const force =
          new URL(request.url, 'http://local').searchParams.get('refresh') === '1'
        return json({ ok: true, value: await loadLive(config, { force }) })
      } catch (error) {
        logger.warn(`team live data unavailable: ${String(error)}`)
        return json(
          {
            ok: false,
            error: {
              code: 'team-live-unavailable',
              message:
                error instanceof Error ? error.message : String(error),
            },
          },
          503
        )
      }
    }

    ctx.effect(
      () =>
        register.call(registry, {
          path: TEAM_ROUTE,
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: handleTeam,
        }),
      'personal-digital-team-panel: team route'
    )

    ctx.effect(
      () =>
        register.call(registry, {
          path: LIVE_ROUTE,
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: handleLive,
        }),
      'personal-digital-team-panel: live route'
    )
  })
}
