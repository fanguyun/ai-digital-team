import { execFile } from 'node:child_process'
import { accessSync, constants, existsSync, readFileSync } from 'node:fs'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { UserInputError } from '@cedarjs/graphql-server'

import { logger } from 'src/lib/logger'
import {
  bindSkill,
  planAgentFixes,
  skillSearchRoots,
} from 'src/lib/skillBinding'

const execFileAsync = promisify(execFile)
const repoRoot = [process.cwd(), path.resolve(process.cwd(), '..')].find(
  (candidate) =>
    existsSync(path.join(candidate, 'scripts', 'capability-health.mjs'))
)
if (!repoRoot) throw new Error('无法定位能力检查脚本所在的项目根目录')
const capabilityScript = path.join(repoRoot, 'scripts', 'capability-health.mjs')

type CapabilityReport = {
  platform: string
  generatedAt: string
  summary: {
    total: number
    complete: number
    partial: number
    notInstalled: number
    unbound: number
  }
  agents: unknown[]
}
const readReport = async (platform: 'codex' | 'deepseek-harness') => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [capabilityScript, '--platform', platform, '--format', 'json'],
    { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 }
  )
  const report = JSON.parse(stdout) as CapabilityReport
  if (
    report.platform !== platform ||
    !report.summary ||
    !Array.isArray(report.agents)
  ) {
    throw new Error(`能力检查返回了无效的 ${platform} 报告`)
  }
  return report
}
const cliDefinitions = [
  {
    id: 'source',
    name: '源仓库任务运行时 CLI',
    relativePath: 'scripts/task-runtime.mjs',
  },
  {
    id: 'codex-plugin',
    name: 'Codex 插件 CLI',
    relativePath: 'plugins/personal-digital-team/scripts/task-runtime.mjs',
  },
  {
    id: 'deepseek-harness',
    name: 'DeepSeek Harness CLI',
    relativePath: 'dsh/scripts/task-runtime.mjs',
  },
]

const checkCli = async (definition: (typeof cliDefinitions)[number]) => {
  const absolutePath = path.join(repoRoot, definition.relativePath)
  try {
    await access(absolutePath)
    return {
      id: definition.id,
      name: definition.name,
      status: 'UP',
      path: definition.relativePath,
      message: '文件存在，可由对应运行环境调用',
    }
  } catch {
    return {
      id: definition.id,
      name: definition.name,
      status: 'DOWN',
      path: definition.relativePath,
      message: '入口文件缺失，需要重新同步团队插件',
    }
  }
}

export const capabilityHealth = async () => {
  const [reports, cli] = await Promise.all([
    Promise.all([readReport('codex'), readReport('deepseek-harness')]),
    Promise.all(cliDefinitions.map(checkCli)),
  ])

  return {
    generatedAt: new Date().toISOString(),
    reports,
    cli,
  }
}

/** 从 manifest 里取岗位能力要求（capabilityRequirements） */
const readAgentRequirements = (agentSlug: string) => {
  const manifestPath = path.join(repoRoot, 'agents', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    agents?: Array<{
      slug?: string
      name?: string
      capabilityRequirements?: {
        requiredSkills?: string[]
        optionalSkills?: string[]
        requiredTools?: string[]
      }
    }>
  }
  const agent = (manifest.agents || []).find((item) => item.slug === agentSlug)
  if (!agent) throw new UserInputError(`未知岗位：${agentSlug}`)
  const requirements = agent.capabilityRequirements || {}
  return {
    name: String(agent.name || agentSlug),
    requiredSkills: (requirements.requiredSkills || []).map(String),
    optionalSkills: (requirements.optionalSkills || []).map(String),
    requiredTools: (requirements.requiredTools || []).map(String),
  }
}

const commandAvailable = (tool: string) => {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean)
  return dirs.some((dir) => {
    try {
      accessSync(path.join(dir, tool), constants.X_OK)
      return true
    } catch {
      return false
    }
  })
}

/** 岗位能力问题的修复方案（只生成方案，不改文件） */
export const capabilityFixPlan = async ({
  agentSlug,
}: {
  agentSlug: string
}) => {
  const requirements = readAgentRequirements(agentSlug)
  const items = planAgentFixes({
    repoRoot,
    agentSlug,
    ...requirements,
    roots: skillSearchRoots(repoRoot),
    toolAvailable: commandAvailable,
  })
  return { agentSlug, agentName: requirements.name, items }
}

/** 执行可以自动完成的修复（建立/替换岗位软链接） */
export const capabilityApplyFixes = async ({
  agentSlug,
}: {
  agentSlug: string
}) => {
  const requirements = readAgentRequirements(agentSlug)
  const plan = await capabilityFixPlan({ agentSlug })
  const roots = skillSearchRoots(repoRoot)

  const applied = plan.items
    .filter((item) => item.canApply && item.kind === 'skill-binding')
    .map((item) =>
      bindSkill({
        repoRoot,
        agentSlug,
        skill: item.name,
        roots,
      })
    )

  logger.info(
    { agentSlug, applied: applied.filter((item) => item.changed).length },
    'capability fixes applied'
  )

  return { agentSlug, requirements: requirements.name, applied }
}
