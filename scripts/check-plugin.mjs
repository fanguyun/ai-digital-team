import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const agentsRoot = join(repoRoot, 'agents')
const pluginRoot = join(repoRoot, 'plugins', 'personal-digital-team')
const skillsRoot = join(pluginRoot, 'skills')
const manifestPath = join(pluginRoot, '.codex-plugin', 'plugin.json')
const requiredSections = ['Role', 'Context', 'Capabilities', 'Instructions']
let issueCount = 0

function issue(message) {
  console.error(`问题: ${message}`)
  issueCount += 1
}

function directoriesWithAgents(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'AGENTS.md')))
    .map((entry) => entry.name)
    .sort()
}

const agentSlugs = directoriesWithAgents(agentsRoot)
const pluginSlugs = existsSync(skillsRoot)
  ? readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort()
  : []

for (const slug of agentSlugs) {
  const sourcePath = join(agentsRoot, slug, 'AGENTS.md')
  const skillPath = join(skillsRoot, slug, 'SKILL.md')
  const yamlPath = join(skillsRoot, slug, 'agents', 'openai.yaml')
  const source = readFileSync(sourcePath, 'utf8')
  for (const section of requiredSections) {
    if (!new RegExp(`^##\\s+${section}\\s*$`, 'm').test(source)) {
      issue(`${sourcePath.replace(`${repoRoot}/`, '')} 缺少 ## ${section}`)
    }
  }
  if (!existsSync(skillPath)) issue(`缺少插件 Skill: ${skillPath.replace(`${repoRoot}/`, '')}`)
  if (!existsSync(yamlPath)) issue(`缺少插件元数据: ${yamlPath.replace(`${repoRoot}/`, '')}`)
}

for (const slug of pluginSlugs) {
  if (!agentSlugs.includes(slug)) issue(`插件存在过期岗位: ${slug}`)
}

if (!existsSync(manifestPath)) {
  issue('缺少 plugins/personal-digital-team/.codex-plugin/plugin.json')
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const match = String(manifest.description || '').match(/与 (\d+) 个岗位 Agent/)
    if (!match || Number(match[1]) !== agentSlugs.length) {
      issue(`plugin.json 岗位数量与源目录不一致，应为 ${agentSlugs.length}`)
    }
  } catch (error) {
    issue(`plugin.json 不是合法 JSON: ${error.message}`)
  }
}

const syncCheck = spawnSync(process.execPath, [join(scriptDir, 'sync-plugin.mjs'), '--check'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
if (syncCheck.stdout) process.stdout.write(syncCheck.stdout)
if (syncCheck.stderr) process.stderr.write(syncCheck.stderr)
if (syncCheck.status !== 0) issue('插件导出内容与源目录不同步')

if (issueCount === 0) {
  console.log(`插件检查通过：${agentSlugs.length} 个岗位，源目录与导出内容一致。`)
} else {
  console.error(`插件检查失败：发现 ${issueCount} 个问题。`)
  process.exitCode = 1
}
