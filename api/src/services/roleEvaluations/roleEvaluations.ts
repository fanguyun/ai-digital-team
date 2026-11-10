import { spawn } from 'node:child_process'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { UserInputError } from '@cedarjs/graphql-server'

import {
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
import { logger } from 'src/lib/logger'

const PROBE_TTL_MS = 60_000

type RunningDispatch = {
  pid: number
  tool: RoleEvaluationToolId
  startedAt: Date
}

const runningDispatches = new Map<string, RunningDispatch>()

let probeCache:
  | { key: string; at: number; tools: RoleEvaluationToolStatus[] }
  | null = null

const probeCacheKey = () =>
  `${process.env.ROLE_EVAL_CODEX_BIN || ''}|${process.env.ROLE_EVAL_DSH_BIN || ''}`

export const roleEvaluationTools = (): RoleEvaluationToolStatus[] => {
  const key = probeCacheKey()
  const now = Date.now()
  if (probeCache && probeCache.key === key && now - probeCache.at < PROBE_TTL_MS) {
    return probeCache.tools
  }

  const tools: RoleEvaluationToolStatus[] = ROLE_EVAL_TOOLS.map(({ id, name }) => {
    const probe = probeBinary(id)
    if ('bin' in probe) {
      return { id, name, available: true, version: probe.version }
    }
    return { id, name, available: false, reason: probe.reason }
  })

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

const assertNotRunning = (slug: string, agentName: string) => {
  const current = runningDispatches.get(slug)
  if (!current) return
  if (alive(current.pid)) {
    throw new UserInputError(
      `「${agentName}」的岗位评估仍在运行（PID ${current.pid}，${current.tool}）。请等它结束，或先手动结束该进程后重试。`
    )
  }
  runningDispatches.delete(slug)
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

  assertNotRunning(agent.slug, agent.name)

  const probe = probeBinary(tool)
  if (!('bin' in probe)) throw new UserInputError(probe.reason)

  const startedAt = new Date()
  const id = dispatchIdFor(agent.slug, startedAt)
  const reportPath = reportPathFor(agent.slug, startedAt)
  const paths = logPathsFor(agent.slug, startedAt)
  const prompt = buildEvaluationPrompt({ agent, repoRoot, reportPath, startedAt })
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
      appendFileSync(logAbsolutePath, `\n[dispatch] spawn error: ${error.message}\n`)
    } catch {
      // 日志写失败不覆盖主错误
    }
    logger.error({ slug: agent.slug, tool, error: error.message }, 'role evaluation spawn failed')
  })

  const pid = child.pid
  if (!pid) {
    throw new UserInputError(
      `执行进程未能启动，请查看日志：${paths.log}`
    )
  }
  child.unref()
  runningDispatches.set(agent.slug, { pid, tool, startedAt })

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

  logger.info(
    { id, slug: agent.slug, tool, pid, version: probe.version },
    'role evaluation dispatched'
  )

  return {
    id,
    agentSlug: agent.slug,
    agentName: agent.name,
    tool,
    startedAt,
    prompt,
    reportPath,
    logPath: paths.log,
    resultPath: paths.result,
    pid,
  }
}
