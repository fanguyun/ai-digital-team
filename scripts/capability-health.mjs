import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  supportedPlatforms,
  validateCapabilityRequirements,
} from './capability-schema.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
export { validateCapabilityRequirements } from './capability-schema.mjs'

export function findSkill(name, roots) {
  for (const root of roots) {
    const path = join(root, name, 'SKILL.md')
    if (existsSync(path)) return { available: true, root, path }
  }
  return { available: false }
}

function findCommand(name, envPath = process.env.PATH || '') {
  for (const root of envPath.split(delimiter).filter(Boolean)) {
    const path = join(root, name)
    if (existsSync(path)) return { available: true, path }
  }
  return { available: false }
}

export function buildAgentCapabilityStatus({
  agentInstalled,
  requiredSkills,
  optionalSkills,
  requiredTools,
}) {
  const missingRequiredSkills = requiredSkills
    .filter((skill) => !skill.available)
    .map((skill) => skill.name)
  const missingOptionalSkills = optionalSkills
    .filter((skill) => !skill.available)
    .map((skill) => skill.name)
  const missingRequiredTools = requiredTools
    .filter((tool) => !tool.available)
    .map((tool) => tool.name)

  let status = 'complete'
  if (!agentInstalled) status = 'not-installed'
  else if (missingRequiredSkills.length > 0 || missingRequiredTools.length > 0) status = 'partial'

  return {
    status,
    missingRequiredSkills,
    missingOptionalSkills,
    missingRequiredTools,
  }
}

function platformConfig(platform) {
  const home = homedir()
  if (platform === 'codex') {
    return {
      agentBundleRoot: join(repoRoot, 'plugins', 'personal-digital-team', 'skills'),
      sharedSkillRoots: [
        join(repoRoot, '.agents', 'skills'),
        join(home, '.codex', 'skills'),
        join(home, '.agents', 'skills'),
      ],
    }
  }
  if (platform === 'deepseek-harness') {
    return {
      agentBundleRoot: join(repoRoot, 'dsh', 'skills'),
      sharedSkillRoots: [
        join(repoRoot, '.dsh', 'skills'),
        join(repoRoot, '.agents', 'skills'),
        join(process.env.DSH_HOME || join(home, '.dsh'), 'skills'),
        join(process.env.DSH_AGENTS_HOME || join(home, '.agents'), 'skills'),
      ],
    }
  }
  throw new Error(`不支持的平台: ${platform}`)
}

export function buildCapabilityReport(manifest, platform) {
  const config = platformConfig(platform)
  const agents = manifest.agents.map((agent) => {
    const requirements = agent.capabilityRequirements
    const localSkillRoot = join(repoRoot, 'agents', agent.slug, '.agents', 'skills')
    const roots = [localSkillRoot, ...config.sharedSkillRoots]
    const requiredSkills = requirements.requiredSkills.map((name) => ({
      name,
      ...findSkill(name, roots),
      bound: existsSync(join(localSkillRoot, name, 'SKILL.md')),
    }))
    const optionalSkills = requirements.optionalSkills.map((name) => ({
      name,
      ...findSkill(name, roots),
      bound: existsSync(join(localSkillRoot, name, 'SKILL.md')),
    }))
    const requiredTools = requirements.requiredTools.map((name) => ({ name, ...findCommand(name) }))
    const agentPath = join(config.agentBundleRoot, agent.slug, 'SKILL.md')
    const summary = buildAgentCapabilityStatus({
      agentInstalled: existsSync(agentPath),
      requiredSkills,
      optionalSkills,
      requiredTools,
    })
    const unboundRequiredSkills = requiredSkills
      .filter((skill) => skill.available && !skill.bound)
      .map((skill) => skill.name)

    return {
      slug: agent.slug,
      name: agent.name,
      platformSupported: requirements.platforms.includes(platform),
      agentInstalled: existsSync(agentPath),
      agentPath,
      ...summary,
      unboundRequiredSkills,
      requiredSkills,
      optionalSkills,
      requiredTools,
      assessment: requirements.assessment || '',
      suggestions: [
        ...summary.missingRequiredSkills.map((name) =>
          platform === 'codex'
            ? `安装 Skill ${name} 到 ~/.codex/skills 或 ~/.agents/skills，并按项目规则建立岗位软链接。`
            : `安装 Skill ${name} 到 ~/.dsh/skills 或 ~/.agents/skills。`,
        ),
        ...summary.missingRequiredTools.map((name) => `安装并配置命令行工具 ${name}。`),
      ],
    }
  })

  return {
    platform,
    generatedAt: new Date().toISOString(),
    summary: {
      total: agents.length,
      complete: agents.filter((agent) => agent.status === 'complete').length,
      partial: agents.filter((agent) => agent.status === 'partial').length,
      notInstalled: agents.filter((agent) => agent.status === 'not-installed').length,
      unbound: agents.filter((agent) => agent.unboundRequiredSkills.length > 0).length,
    },
    agents,
  }
}

function renderText(report) {
  const lines = [
    `能力检查平台: ${report.platform}`,
    `岗位总数: ${report.summary.total}，完整可用: ${report.summary.complete}，部分可用: ${report.summary.partial}，未安装: ${report.summary.notInstalled}，存在未绑定必需 Skill: ${report.summary.unbound}`,
    '',
  ]
  for (const agent of report.agents) {
    lines.push(`[${agent.status}] ${agent.name} (${agent.slug})`)
    if (agent.missingRequiredSkills.length) {
      lines.push(`  缺少必需 Skill: ${agent.missingRequiredSkills.join(', ')}`)
    }
    if (agent.missingRequiredTools.length) {
      lines.push(`  缺少工具: ${agent.missingRequiredTools.join(', ')}`)
    }
    if (agent.missingOptionalSkills.length) {
      lines.push(`  缺少可选 Skill: ${agent.missingOptionalSkills.join(', ')}`)
    }
    if (agent.unboundRequiredSkills.length) {
      lines.push(`  已安装但未建立岗位绑定: ${agent.unboundRequiredSkills.join(', ')}`)
    }
    for (const suggestion of agent.suggestions) lines.push(`  建议: ${suggestion}`)
  }
  return lines.join('\n')
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const args = process.argv.slice(2)
  const readArg = (name, fallback) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : fallback
  }
  const platform = readArg('--platform', 'codex')
  const format = readArg('--format', 'text')
  const strict = args.includes('--strict')
  if (!supportedPlatforms.includes(platform) || !['text', 'json'].includes(format)) {
    console.error('用法: node scripts/capability-health.mjs --platform <codex|deepseek-harness> [--format <text|json>] [--strict]')
    process.exitCode = 2
  } else {
    const { loadAgentManifest } = await import('./agent-manifest.mjs')
    const report = buildCapabilityReport(loadAgentManifest(), platform)
    console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderText(report))
    if (strict && (report.summary.partial > 0 || report.summary.notInstalled > 0)) {
      process.exitCode = 1
    }
  }
}
