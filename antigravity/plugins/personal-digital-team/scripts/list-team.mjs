import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pluginRoot = dirname(scriptDir)
const referencesRoot = join(pluginRoot, 'skills', 'main-agent', 'references')
const ignoredFiles = new Set(['ROUTING_MATRIX.md', 'DELIVERY_PROTOCOL.md'])

function help() {
  console.log('用法: node scripts/list-team.mjs [--format text|json]')
}

function readTeam() {
  if (!existsSync(referencesRoot)) return []
  return readdirSync(referencesRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !entry.name.startsWith('.') &&
        !ignoredFiles.has(entry.name)
    )
    .map((entry) => {
      const slug = entry.name.slice(0, -3)
      const filePath = join(referencesRoot, entry.name)
      const markdown = readFileSync(filePath, 'utf8')
      const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || slug
      const summary = markdown.match(/^>\s*(.+)$/m)?.[1]?.trim() || ''
      return {
        slug,
        name: heading,
        description: summary,
        reference: `skills/main-agent/references/${entry.name}`,
      }
    })
    .sort((first, second) => first.slug.localeCompare(second.slug, 'en'))
}

const args = process.argv.slice(2)
const formatIndex = args.indexOf('--format')
const format = formatIndex === -1 ? 'text' : args[formatIndex + 1]
const validArgs =
  args.length === 0 ||
  (args.length === 2 &&
    formatIndex === 0 &&
    ['text', 'json'].includes(format)) ||
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
      console.log(`- ${member.slug}｜${member.name}｜${member.description}`)
    }
  }
}
