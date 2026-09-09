import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = dirname(scriptDir)
const skillsRoot = join(pluginRoot, 'skills')
const requiredSections = ['Role', 'Context', 'Capabilities', 'Instructions']
const externalSkillRoots = [
  process.env.SKILLS_MANAGER_ROOT || join(process.env.HOME || '', '.skills-manager'),
  join(process.env.HOME || '', '.agents', 'skills'),
]

function printHelp() {
  console.log('用法: node scripts/inspect-role.mjs <role> [--format text|json]')
}

function parseArgs(args) {
  const role = args.find((arg) => !arg.startsWith('--'))
  const formatIndex = args.indexOf('--format')
  const format = formatIndex === -1 ? 'text' : args[formatIndex + 1]
  if (!role || (formatIndex !== -1 && !['text', 'json'].includes(format))) return null
  return { role, format }
}

function inspectRole(role) {
  const roleDir = join(skillsRoot, role)
  const skillPath = join(roleDir, 'SKILL.md')
  const metadataPath = join(roleDir, 'agents', 'openai.yaml')
  const result = {
    role,
    skillPath: resolve(skillPath),
    metadataPath: resolve(metadataPath),
    skillExists: existsSync(skillPath),
    metadataExists: existsSync(metadataPath),
    sections: Object.fromEntries(requiredSections.map((section) => [section, false])),
    referencedSkills: [],
  }
  if (result.skillExists) {
    const content = readFileSync(skillPath, 'utf8')
    for (const section of requiredSections) {
      result.sections[section] = new RegExp(`^##\\s+${section}\\s*$`, 'm').test(content)
    }
    result.referencedSkills = [...new Set(content.match(/\$[a-z0-9-]+/g) || [])]
      .filter((skill) => skill !== `$${role}`)
      .map((skill) => {
        const name = skill.slice(1)
        return {
          skill,
          bundled: existsSync(join(skillsRoot, name, 'SKILL.md')),
          installed: externalSkillRoots.some((root) => existsSync(join(root, 'skills', name, 'SKILL.md')) || existsSync(join(root, name, 'SKILL.md'))),
        }
      })
  }
  return result
}

const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') {
  printHelp()
} else {
  const parsed = parseArgs(args)
  if (!parsed) {
    console.error('参数无效。')
    printHelp()
    process.exitCode = 2
  } else if (!existsSync(join(skillsRoot, parsed.role))) {
    console.error(`未找到岗位: ${parsed.role}`)
    process.exitCode = 1
  } else {
    const result = inspectRole(parsed.role)
    if (parsed.format === 'json') {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(`岗位: ${result.role}`)
      console.log(`Skill.md: ${result.skillExists ? '存在' : '缺失'}`)
      console.log(`openai.yaml: ${result.metadataExists ? '存在' : '缺失'}`)
      console.log(`规则章节: ${Object.entries(result.sections).filter(([, ok]) => ok).map(([name]) => name).join('、') || '无'}`)
      console.log(`引用 Skill: ${result.referencedSkills.map((item) => `${item.skill}（${item.installed ? '已安装' : '未确认安装'}）`).join('、') || '无'}`)
    }
    if (!result.skillExists || !result.metadataExists || Object.values(result.sections).some((ok) => !ok)) process.exitCode = 1
  }
}
