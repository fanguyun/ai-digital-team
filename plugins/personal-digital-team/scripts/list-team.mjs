import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = dirname(scriptDir)
const skillsRoot = join(pluginRoot, 'skills')

function help() {
  console.log('用法: node scripts/list-team.mjs [--format text|json]')
}

function frontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  return Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.match(/^([^:]+):\s*["']?(.*?)["']?\s*$/))
      .filter(Boolean)
      .map(([, key, value]) => [key.trim(), value.trim()]),
  )
}

function readTeam() {
  if (!existsSync(skillsRoot)) return []
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const skillPath = join(skillsRoot, entry.name, 'SKILL.md')
      const markdown = existsSync(skillPath) ? readFileSync(skillPath, 'utf8') : ''
      const metadata = frontmatter(markdown)
      const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || entry.name
      return {
        skill: `$${metadata.name || entry.name}`,
        name: heading,
        description: metadata.description || '',
      }
    })
    .sort((first, second) => first.skill.localeCompare(second.skill, 'en'))
}

const args = process.argv.slice(2)
const formatIndex = args.indexOf('--format')
const format = formatIndex === -1 ? 'text' : args[formatIndex + 1]
const validArgs =
  args.length === 0 ||
  (args.length === 2 && formatIndex === 0 && ['text', 'json'].includes(format)) ||
  (args.length === 1 && args[0] === '--help')

if (!validArgs) {
  console.error('参数无效。')
  help()
  process.exitCode = 2
} else if (args[0] === '--help') {
  help()
} else {
  const team = readTeam()
  if (format === 'json') {
    console.log(JSON.stringify(team, null, 2))
  } else {
    console.log(`当前可用岗位：${team.length} 个`)
    for (const member of team) {
      console.log(`- ${member.skill}｜${member.name}｜${member.description}`)
    }
  }
}
