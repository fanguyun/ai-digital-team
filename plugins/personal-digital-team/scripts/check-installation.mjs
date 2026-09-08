import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = dirname(scriptDir)
const manifestPath = join(pluginRoot, '.codex-plugin', 'plugin.json')
const skillsRoot = join(pluginRoot, 'skills')
let issueCount = 0

function issue(message) {
  console.error(`问题: ${message}`)
  issueCount += 1
}

if (!existsSync(manifestPath)) {
  issue('缺少 .codex-plugin/plugin.json')
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const field of ['name', 'version', 'description', 'skills']) {
      if (!String(manifest[field] || '').trim()) issue(`plugin.json 缺少 ${field}`)
    }
  } catch (error) {
    issue(`plugin.json 不是合法 JSON: ${error.message}`)
  }
}

if (!existsSync(skillsRoot)) {
  issue('缺少 skills 目录')
} else {
  const skills = readdirSync(skillsRoot, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
  )
  if (skills.length === 0) issue('未找到任何岗位 Skill')

  for (const skill of skills) {
    const skillPath = join(skillsRoot, skill.name, 'SKILL.md')
    const agentPath = join(skillsRoot, skill.name, 'agents', 'openai.yaml')
    if (!existsSync(skillPath)) {
      issue(`${skill.name} 缺少 SKILL.md`)
      continue
    }
    const content = readFileSync(skillPath, 'utf8')
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] || ''
    const hasName = /^name:\s*\S+/m.test(frontmatter)
    const hasDescription = /^description:\s*\S+/m.test(frontmatter)
    if (!hasName || !hasDescription) {
      issue(`${skill.name} 的 SKILL.md 缺少 name 或 description`)
    }
    if (!existsSync(agentPath)) issue(`${skill.name} 缺少 agents/openai.yaml`)
  }
}

if (issueCount === 0) {
  console.log('插件安装检查通过：目录、清单和岗位元数据均完整。')
} else {
  console.error(`插件安装检查失败：发现 ${issueCount} 个问题。`)
  process.exitCode = 1
}
