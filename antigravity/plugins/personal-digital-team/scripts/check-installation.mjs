import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = dirname(scriptDir)
const manifestPath = join(pluginRoot, 'plugin.json')
const rulesPath = join(pluginRoot, 'rules', 'AGENTS.md')
const mainSkillPath = join(pluginRoot, 'skills', 'main-agent', 'SKILL.md')
const referencesRoot = join(pluginRoot, 'skills', 'main-agent', 'references')
const allowedKeys = new Set([
  'name',
  'displayName',
  'version',
  'description',
  'logo',
  'suggestedPrompts',
  'author',
  'homepage',
  'repository',
  'disabled',
])
const maxRuleBytes = 24_000
let issueCount = 0

function issue(message) {
  console.error(`问题: ${message}`)
  issueCount += 1
}

if (!existsSync(manifestPath)) {
  issue('缺少 plugin.json')
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const field of ['name', 'description']) {
      if (!String(manifest[field] || '').trim()) {
        issue(`plugin.json 缺少 ${field}`)
      }
    }
    for (const key of Object.keys(manifest)) {
      if (!allowedKeys.has(key)) {
        issue(`plugin.json 包含 Antigravity 不识别的顶层字段: ${key}`)
      }
    }
  } catch (error) {
    issue(`plugin.json 不是合法 JSON: ${error.message}`)
  }
}

if (!existsSync(rulesPath)) {
  issue('缺少 rules/AGENTS.md')
} else {
  const rulesText = readFileSync(rulesPath, 'utf8')
  const bytes = Buffer.byteLength(rulesText, 'utf8')
  if (bytes > maxRuleBytes) {
    issue(`rules/AGENTS.md 超过 Antigravity 24,000 字节上限（当前 ${bytes} 字节）`)
  }
  if (/^---\r?\n/.test(rulesText)) {
    issue('rules/AGENTS.md 不应包含 YAML frontmatter')
  }
}

if (!existsSync(mainSkillPath)) {
  issue('缺少 skills/main-agent/SKILL.md')
} else {
  const content = readFileSync(mainSkillPath, 'utf8')
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] || ''
  if (!/^name:\s*main-agent\s*$/m.test(frontmatter)) {
    issue('skills/main-agent/SKILL.md 缺少 name: main-agent')
  }
  if (!/^description:\s*\S+/m.test(frontmatter)) {
    issue('skills/main-agent/SKILL.md 缺少 description')
  }
}

if (!existsSync(referencesRoot)) {
  issue('缺少 skills/main-agent/references 目录')
} else {
  for (const required of ['ROUTING_MATRIX.md', 'DELIVERY_PROTOCOL.md']) {
    if (!existsSync(join(referencesRoot, required))) {
      issue(`缺少共享参考文档: ${required}`)
    }
  }
  const roleFiles = readdirSync(referencesRoot, { withFileTypes: true }).filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      !['ROUTING_MATRIX.md', 'DELIVERY_PROTOCOL.md'].includes(entry.name)
  )
  if (roleFiles.length === 0) issue('未找到任何岗位参考文档')
}

if (issueCount === 0) {
  console.log('Antigravity 插件安装检查通过：清单、规则、入口 Skill 与岗位参考文档均完整。')
} else {
  console.error(`Antigravity 插件安装检查失败：发现 ${issueCount} 个问题。`)
  process.exitCode = 1
}
