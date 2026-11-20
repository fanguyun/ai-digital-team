import { spawn } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import {
  ROLE_EVAL_PROJECT_KEY,
  ROLE_EVAL_TOOLS,
  agentRulePath,
  buildDispatchCommand,
  buildEvaluationPrompt,
  dispatchIdFor,
  isRoleEvaluationTool,
  logPathsFor,
  probeBinary,
  readTeamAgent,
  reportPathFor,
  resolveRepoRoot,
  type RoleEvaluationToolId,
  type RoleEvaluationToolStatus,
} from 'src/lib/roleEvaluationDispatch'
import { failureReasonFromLog, logAgeMs } from 'src/lib/roleEvaluationLog'
import {
  discoverSession,
  readThreadMessages,
  sessionIdFromLog,
  type RoleEvaluationToolId as SessionToolId,
} from 'src/lib/roleEvaluationSessions'
import {
  createTaskForEvaluation,
  syncTaskWithEvaluation,
} from 'src/lib/roleEvaluationTasks'

const PROBE_TTL_MS = 60_000

type RunningDispatch = {
  pid: number
  tool: RoleEvaluationToolId
  startedAt: Date
  logPath: string
}

/** 刚派发的一小段时间内以 pid 为准；之后以日志是否还在写为准 */
const RECENT_DISPATCH_MS = 2 * 60 * 1000
const LOG_FRESH_MS = 15 * 60 * 1000

const runningDispatches = new Map<string, RunningDispatch>()

let probeCache: {
  key: string
  at: number
  tools: RoleEvaluationToolStatus[]
} | null = null

const probeCacheKey = () =>
  `${process.env.ROLE_EVAL_CODEX_BIN || ''}|${process.env.ROLE_EVAL_DSH_BIN || ''}`

export const RoleEvaluation = {
  failureReason: (
    _obj: unknown,
    { root }: { root: { status?: string; logPath?: string } }
  ) =>
    root?.status === 'failed'
      ? failureReasonFromLog(root.logPath) || null
      : null,
}

export const roleEvaluationTools = (): RoleEvaluationToolStatus[] => {
  const key = probeCacheKey()
  const now = Date.now()
  if (
    probeCache &&
    probeCache.key === key &&
    now - probeCache.at < PROBE_TTL_MS
  ) {
    return probeCache.tools
  }

  const tools: RoleEvaluationToolStatus[] = ROLE_EVAL_TOOLS.map(
    ({ id, name }) => {
      const probe = probeBinary(id)
      if ('bin' in probe) {
        return { id, name, available: true, version: probe.version }
      }
      return { id, name, available: false, reason: probe.reason }
    }
  )

  probeCache = { key, at: now, tools }
  return tools
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === 'EPERM'
  }
}

/**
 * 判断一次评估是否真的还在跑。
 * 只看 pid 会被系统复用骗到（进程早退了，pid 被别的进程占用），
 * 所以超过 2 分钟后改用日志 mtime：模型输出会持续写日志，长时间不动就是僵死。
 */
const isEvaluationAlive = (candidate: {
  pid: number | null
  tool: string
  startedAt: Date
  logPath: string
}) => {
  if (!candidate.pid || !alive(candidate.pid)) return false
  if (Date.now() - candidate.startedAt.getTime() < RECENT_DISPATCH_MS) {
    return true
  }
  const age = logAgeMs(candidate.logPath)
  // pid 还活着但日志长时间不动 → 认为 pid 已被别的进程复用
  return age === null ? true : age < LOG_FRESH_MS
}

const assertNotRunning = async (slug: string, agentName: string) => {
  const runningMessage = (pid: number | null, tool: string, at: Date) =>
    `「${agentName}」的岗位评估仍在运行（PID ${pid ?? '—'}，${tool}，开始于 ${at.toLocaleString('zh-CN')}）。请等它结束，或先手动结束该进程后重试。`

  const current = runningDispatches.get(slug)
  if (current) {
    if (isEvaluationAlive(current)) {
      throw new UserInputError(
        runningMessage(current.pid, current.tool, current.startedAt)
      )
    }
    runningDispatches.delete(slug)
  }

  // API 重启后内存态会丢，用库里仍在运行的记录兜底，避免同岗位重复评估
  const row = await db.roleEvaluation.findFirst({
    where: { agentSlug: slug, status: 'running' },
    orderBy: { startedAt: 'desc' },
    select: { pid: true, tool: true, startedAt: true, logPath: true },
  })
  if (!row) return
  if (isEvaluationAlive(row)) {
    throw new UserInputError(runningMessage(row.pid, row.tool, row.startedAt))
  }
}

export type DispatchRoleEvaluationInput = {
  agentSlug: string
  tool: string
}

export const dispatchRoleEvaluation = async ({
  input,
}: {
  input: DispatchRoleEvaluationInput
}) => {
  if (process.env.ROLE_EVAL_ALLOW_DISPATCH === '0') {
    throw new UserInputError(
      '岗位评估派发已被 ROLE_EVAL_ALLOW_DISPATCH=0 停用，如需恢复请修改环境变量后重启 API。'
    )
  }

  const tool = (input?.tool || '').trim()
  if (!isRoleEvaluationTool(tool)) {
    throw new UserInputError(
      `不支持的执行工具：${tool || '(空)'}。可选：${ROLE_EVAL_TOOLS.map(
        (candidate) => candidate.id
      ).join(' / ')}`
    )
  }

  const agentSlug = (input?.agentSlug || '').trim()
  if (!agentSlug) throw new UserInputError('缺少要评估的岗位 slug')

  const repoRoot = resolveRepoRoot()
  const agent = readTeamAgent(agentSlug, repoRoot)
  if (!agent) {
    throw new UserInputError(`岗位清单里没有 ${agentSlug}，请刷新页面后重试`)
  }

  const ruleRelPath = agentRulePath(agent.slug)
  if (!existsSync(path.join(repoRoot, ruleRelPath))) {
    throw new UserInputError(`岗位规则文件缺失：${ruleRelPath}`)
  }

  await assertNotRunning(agent.slug, agent.name)

  const probe = probeBinary(tool)
  if (!('bin' in probe)) throw new UserInputError(probe.reason)

  const startedAt = new Date()
  const id = dispatchIdFor(agent.slug, startedAt)
  const reportPath = reportPathFor(agent.slug, startedAt)
  const paths = logPathsFor(agent.slug, startedAt)
  const prompt = buildEvaluationPrompt({
    agent,
    repoRoot,
    reportPath,
    startedAt,
  })
  const { command, args } = buildDispatchCommand({
    tool,
    bin: probe.bin,
    repoRoot,
    prompt,
    resultPath: path.join(repoRoot, paths.result),
  })

  const logAbsolutePath = path.join(repoRoot, paths.log)
  mkdirSync(path.dirname(logAbsolutePath), { recursive: true })

  const logHandle = openSync(logAbsolutePath, 'a')
  let child
  try {
    child = spawn(command, args, {
      cwd: repoRoot,
      detached: true,
      stdio: ['ignore', logHandle, logHandle],
      env: { ...process.env, ROLE_EVALUATION_AGENT: agent.slug },
    })
  } finally {
    // 子进程持有自己的副本，父进程可以立即关闭。
    closeSync(logHandle)
  }

  child.on('error', (error) => {
    try {
      appendFileSync(
        logAbsolutePath,
        `\n[dispatch] spawn error: ${error.message}\n`
      )
    } catch {
      // 日志写失败不覆盖主错误
    }
    logger.error(
      { slug: agent.slug, tool, error: error.message },
      'role evaluation spawn failed'
    )
  })

  const pid = child.pid
  if (!pid) {
    throw new UserInputError(`执行进程未能启动，请查看日志：${paths.log}`)
  }
  child.unref()
  runningDispatches.set(agent.slug, {
    pid,
    tool,
    startedAt,
    logPath: paths.log,
  })

  const sidecar = {
    id,
    agentSlug: agent.slug,
    agentName: agent.name,
    tool,
    pid,
    startedAt: startedAt.toISOString(),
    reportPath,
    logPath: paths.log,
    resultPath: paths.result,
    command,
    args,
    prompt,
  }
  try {
    writeFileSync(
      path.join(repoRoot, paths.sidecar),
      `${JSON.stringify(sidecar, null, 2)}\n`
    )
  } catch (error) {
    logger.warn({ error }, 'failed to write role evaluation sidecar')
  }

  // 同时登记到任务看板：评估进程本身就是执行者，不二次派发。
  // 任务先建、taskId 随评估记录一次插入，避免"建了任务但没写回关联"的黑洞。
  const taskId = await createTaskForEvaluation({
    agentSlug: agent.slug,
    agentName: agent.name,
    tool,
    reportPath,
    logPath: paths.log,
  })

  const record = await persistEvaluation({
    id,
    agentSlug: agent.slug,
    agentName: agent.name,
    tool,
    projectRoot: repoRoot,
    pid,
    reportPath,
    logPath: paths.log,
    startedAt,
    taskId,
  })

  logger.info(
    { id, slug: agent.slug, tool, pid, version: probe.version, taskId },
    'role evaluation dispatched'
  )

  return {
    id,
    agentSlug: agent.slug,
    agentName: agent.name,
    tool,
    projectKey: ROLE_EVAL_PROJECT_KEY,
    projectRoot: repoRoot,
    sessionId: record?.sessionId ?? null,
    startedAt,
    prompt,
    reportPath,
    logPath: paths.log,
    resultPath: paths.result,
    pid,
  }
}

const sleep = (ms: number) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    // 补会话的定时器不应拖住进程退出（测试与重启场景）
    ;(timer as unknown as { unref?: () => void }).unref?.()
  })

const persistEvaluation = async (input: {
  id: string
  agentSlug: string
  agentName: string
  tool: RoleEvaluationToolId
  projectRoot: string
  pid: number
  reportPath: string
  logPath: string
  startedAt: Date
  taskId?: string | null
}) => {
  try {
    const record = await db.roleEvaluation.create({
      data: {
        agentSlug: input.agentSlug,
        agentName: input.agentName,
        projectKey: ROLE_EVAL_PROJECT_KEY,
        projectRoot: input.projectRoot,
        tool: input.tool,
        status: 'running',
        pid: input.pid,
        reportPath: input.reportPath,
        logPath: input.logPath,
        startedAt: input.startedAt,
        taskId: input.taskId ?? null,
      },
    })
    void captureSession(
      record.id,
      input.tool,
      input.projectRoot,
      input.startedAt,
      input.logPath
    )
    return record
  } catch (error) {
    // 落库失败不能掩盖派发本身，日志里留痕即可
    logger.error({ error, id: input.id }, 'failed to persist role evaluation')
    return null
  }
}

/** 派发后异步补齐会话 id：3s / 8s / 15s 三次机会 */
/**
 * 派发后异步补齐会话 id：
 * 先读 --json 事件流的首个 session 事件（毫秒级），再退回扫描会话目录（秒级）。
 */
const captureSession = async (
  recordId: string,
  tool: RoleEvaluationToolId,
  projectRoot: string,
  startedAt: Date,
  logPath: string
) => {
  const logAbsolute = path.join(projectRoot, logPath)

  for (const delay of [500, 1_500, 3_000, 6_000, 12_000]) {
    await sleep(delay)
    try {
      const fromLog = sessionIdFromLog(logAbsolute, tool)
      if (fromLog) {
        await db.roleEvaluation.update({
          where: { id: recordId },
          data: { sessionId: fromLog },
        })
        return
      }

      const found = await discoverSession({
        tool,
        projectRoot,
        since: startedAt,
      })
      if (found) {
        await db.roleEvaluation.update({
          where: { id: recordId },
          data: { sessionId: found.sessionId },
        })
        return
      }
    } catch (error) {
      logger.warn(
        { error, recordId },
        'role evaluation session discovery failed'
      )
    }
  }
}

/** 评估最长运行时间：超过就视为僵死（例如 pid 被系统复用） */
const MAX_RUNTIME_MS = 6 * 60 * 60 * 1000

/** 进程已结束时按报告是否生成来回收状态 */
const reconcileStatus = async (
  rows: Array<{
    id: string
    status: string
    pid: number | null
    projectRoot: string
    reportPath: string
    logPath: string
    startedAt: Date
    taskId?: string | null
  }>
) => {
  const updates = new Map<
    string,
    {
      status: string
      finishedAt: Date
      row: (typeof rows)[number]
    }
  >()
  for (const row of rows) {
    if (row.status !== 'running') continue
    const runningTooLong = Date.now() - row.startedAt.getTime() > MAX_RUNTIME_MS
    if (!runningTooLong && row.pid && alive(row.pid)) continue
    const reportAbsolute = path.join(row.projectRoot, row.reportPath)
    const finishedAt = new Date()
    updates.set(row.id, {
      status: existsSync(reportAbsolute) ? 'completed' : 'failed',
      finishedAt,
      row,
    })
  }

  for (const [id, update] of updates) {
    try {
      await db.roleEvaluation.update({
        where: { id },
        data: { status: update.status, finishedAt: update.finishedAt },
      })
    } catch (error) {
      logger.warn({ error, id }, 'failed to reconcile role evaluation status')
    }

    // 评估结论写回任务看板；任务已被人工处理过时 syncTaskWithEvaluation 会跳过
    await syncTaskWithEvaluation({
      taskId: update.row.taskId ?? null,
      outcome: update.status === 'completed' ? 'completed' : 'failed',
      reportPath: update.row.reportPath,
      logPath: update.row.logPath,
      finishedAt: update.finishedAt,
    })
  }

  return rows.map((row) => {
    const update = updates.get(row.id)
    return update
      ? { ...row, status: update.status, finishedAt: update.finishedAt }
      : row
  })
}

/** 后台巡检：由任务定时器带动，没人打开面板也能把评估结论写回任务 */
export const reconcileRunningEvaluations = async () => {
  const rows = await db.roleEvaluation.findMany({
    where: { status: 'running' },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })
  return reconcileStatus(rows)
}

export const roleEvaluations = async ({
  agentSlug,
}: {
  agentSlug?: string | null
} = {}) => {
  const rows = await db.roleEvaluation.findMany({
    where: agentSlug ? { agentSlug } : {},
    orderBy: { startedAt: 'desc' },
    take: 30,
  })
  return reconcileStatus(rows)
}

const loadEvaluation = async (id: string) => {
  const row = await db.roleEvaluation.findUnique({ where: { id } })
  if (!row) throw new UserInputError('评估记录不存在或已被清理')
  return row
}

const REPORT_PREFIX = path.posix.join('docs', 'role-evaluations')

/** 只允许读取项目内 docs/role-evaluations 下的文件 */
export const resolveReportFile = (projectRoot: string, reportPath: string) => {
  const absolute = path.resolve(projectRoot, reportPath)
  const root = path.resolve(projectRoot)
  const allowed = path.resolve(root, REPORT_PREFIX)
  if (!absolute.startsWith(`${allowed}${path.sep}`) && absolute !== allowed) {
    throw new UserInputError('报告路径不在允许的目录内')
  }
  return absolute
}

export const roleEvaluationReport = async ({ id }: { id: string }) => {
  const row = await loadEvaluation(id)
  const absolute = resolveReportFile(row.projectRoot, row.reportPath)
  if (!existsSync(absolute)) {
    throw new UserInputError('报告尚未生成，请等评估跑完再试')
  }
  if (statSync(absolute).size > 200_000) {
    throw new UserInputError('报告超过 200KB，请在本地打开')
  }
  return readFileSync(absolute, 'utf8')
}

export const roleEvaluationMessages = async ({ id }: { id: string }) => {
  const row = await loadEvaluation(id)
  if (!row.sessionId) return []
  return readThreadMessages({
    tool: row.tool as SessionToolId,
    sessionId: row.sessionId,
    projectRoot: row.projectRoot,
  })
}

const buildResumeCommand = ({
  tool,
  bin,
  sessionId,
  projectRoot,
  message,
}: {
  tool: RoleEvaluationToolId
  bin: string
  sessionId: string
  projectRoot: string
  message: string
}): { command: string; args: string[] } =>
  tool === 'codex'
    ? {
        command: bin,
        args: [
          'exec',
          'resume',
          sessionId,
          '--json',
          '-C',
          projectRoot,
          '-s',
          'workspace-write',
          message,
        ],
      }
    : {
        command: bin,
        args: [
          '--profile',
          'headless',
          '--json',
          '--session-id',
          sessionId,
          message,
        ],
      }

export const sendRoleEvaluationMessage = async ({
  id,
  message,
}: {
  id: string
  message: string
}) => {
  const text = (message || '').trim()
  if (!text) throw new UserInputError('消息不能为空')
  if (text.length > 4_000) throw new UserInputError('消息不能超过 4000 字')

  const row = await loadEvaluation(id)
  if (!row.sessionId) {
    throw new UserInputError('这条评估还没有关联到本地会话，无法续聊')
  }

  const tool = row.tool as RoleEvaluationToolId
  const probe = probeBinary(tool)
  if (!('bin' in probe)) throw new UserInputError(probe.reason)

  const { command, args } = buildResumeCommand({
    tool,
    bin: probe.bin,
    sessionId: row.sessionId,
    projectRoot: row.projectRoot,
    message: text,
  })

  const logAbsolute = path.join(row.projectRoot, row.logPath)
  mkdirSync(path.dirname(logAbsolute), { recursive: true })
  appendFileSync(
    logAbsolute,
    `\n[resume] ${new Date().toISOString()} ${command} ${args.slice(0, -1).join(' ')}\n`
  )

  const logHandle = openSync(logAbsolute, 'a')
  let child
  try {
    child = spawn(command, args, {
      cwd: row.projectRoot,
      detached: true,
      stdio: ['ignore', logHandle, logHandle],
      env: { ...process.env, ROLE_EVALUATION_AGENT: row.agentSlug },
    })
  } finally {
    closeSync(logHandle)
  }
  child.on('error', (error) => {
    logger.error({ error, id }, 'resume spawn failed')
  })
  child.unref()

  return { ...row, status: 'running', pid: child.pid ?? row.pid }
}
