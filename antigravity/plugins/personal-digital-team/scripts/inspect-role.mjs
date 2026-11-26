import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = dirname(scriptDir)
const referencesRoot = resolve(pluginRoot, 'skills', 'main-agent', 'references')
const requiredSections = ['Role', 'Context', 'Capabilities', 'Instructions']
const ignoredRoles = new Set(['ROUTING_MATRIX', 'DELIVERY_PROTOCOL'])
const externalSkillRoots = [
  join(process.env.HOME || '', '.gemini', 'config', 'skills'),
  join(process.env.HOME || '', '.agents', 'skills'),
  process.env.SKILLS_MANAGER_ROOT ||
    join(process.env.HOME || '', '.skills-manager'),
]

function printHelp() {
  console.log('用法: node scripts/inspect-role.mjs <role> [--format text|json]')
}

function isValidRoleSlug(role) {
  return /^[a-z0-9][a-z0-9-]*$/.test(role) && !ignoredRoles.has(role)
}

function parseArgs(args) {
  const role = args.find((arg) => !arg.startsWith('--'))
  const formatIndex = args.indexOf('--format')
  const format = formatIndex === -1 ? 'text' : args[formatIndex + 1]
  if (!role || (formatIndex !== -1 && !['text', 'json'].includes(format))) {
    return null
  }
  return { role, format }
}

function inspectRole(role) {
  const referencePath = resolve(referencesRoot, `${role}.md`)
  if (!referencePath.startsWith(`${referencesRoot}${sep}`)) {
    throw new Error(`非法岗位路径: ${role}`)
  }
  const result = {
    role,
    referencePath,
    referenceExists: existsSync(referencePath),
    sections: Object.fromEntries(
      requiredSections.map((section) => [section, false])
    ),
    referencedSkills: [],
  }

  if (result.referenceExists) {
    const content = readFileSync(referencePath, 'utf8')
    for (const section of requiredSections) {
      result.sections[section] = new RegExp(
        `^##\\s+${section}\\s*$`,
        'm'
      ).test(content)
    }
    const candidates = [
      ...new Set(
        [...content.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)].map((m) => m[1])
      ),
    ].filter((name) => name !== role)

    result.referencedSkills = candidates
      .filter((name) =>
        externalSkillRoots.some(
          (root) =>
            existsSync(join(root, name, 'SKILL.md')) ||
            existsSync(join(root, 'skills', name, 'SKILL.md'))
        )
      )
      .map((name) => ({ skill: name, installed: true }))
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
  } else if (!isValidRoleSlug(parsed.role)) {
    console.error(`非法岗位标识: ${parsed.role}`)
    printHelp()
    process.exitCode = 2
  } else {
    const result = inspectRole(parsed.role)
    if (!result.referenceExists) {
      console.error(`未找到岗位参考文档: ${parsed.role}`)
      process.exitCode = 1
    } else {
      if (parsed.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(`岗位: ${result.role}`)
        console.log(`参考文档: ${result.referencePath}`)
        console.log(
          `规则章节: ${
            Object.entries(result.sections)
              .filter(([, ok]) => ok)
              .map(([name]) => name)
              .join('、') || '无'
          }`
        )
        console.log(
          `已检测到本机关联 Skill（仅列出已探测项，缺失项请核对岗位「Skill 使用规则」）: ${
            result.referencedSkills.map((item) => item.skill).join('、') || '无'
          }`
        )
      }
      if (Object.values(result.sections).some((ok) => !ok)) {
        process.exitCode = 1
      }
    }
  }
}
