import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const home = process.env.HOME || process.env.USERPROFILE || repoRoot
const agentsRoot = join(repoRoot, 'agents')
const pluginRoot = join(repoRoot, 'plugins', 'personal-digital-team')
const skillsRoot = join(pluginRoot, 'skills')
const pluginJsonPath = join(pluginRoot, '.codex-plugin', 'plugin.json')
const defaultValidatorPath = join(
  home,
  '.codex',
  'skills',
  '.system',
  'plugin-creator',
  'scripts',
  'validate_plugin.py',
)
const validatorPath = process.env.PLUGIN_VALIDATOR_PATH || defaultValidatorPath

function quote(value) {
  return JSON.stringify(value)
}

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

function extractSummary(markdown, fallback) {
  const match = markdown.match(/^>\s*(.+)$/m)
  return match ? match[1].trim() : fallback
}

function transformBody(body) {
  return body
    .replace(/\.\.\/\.\.\/scripts\//g, '__PLUGIN_SCRIPTS__/')
    .replace(/\.\.\/([a-z0-9-]+)\/AGENTS\.md/g, (_, slug) => `$${slug}`)
    .replace(/\.\.\/([a-z0-9-]+)\//g, (_, slug) => `$${slug}`)
    .replace(
      /agents\/([a-z0-9-]+)\/\.agents\/skills\/([a-z0-9-]+)/g,
      (_, _agent, skill) => `$${skill}`,
    )
    .replace(/\.agents\/skills\/([a-z0-9-]+)/g, (_, skill) => `$${skill}`)
    .replace(/(?<!\.)agents\/([a-z0-9-]+)\/AGENTS\.md/g, (_, slug) => `$${slug}`)
    .replace(/(?<!\.)agents\/([a-z0-9-]+)\//g, (_, slug) => `$${slug}`)
    .replace(/__PLUGIN_SCRIPTS__\//g, '../../scripts/')
}

function listAgentSlugs() {
  if (!existsSync(agentsRoot)) return []
  return readdirSync(agentsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        existsSync(join(agentsRoot, entry.name, 'AGENTS.md')),
    )
    .map((entry) => entry.name)
    .sort()
}

function writeIfChanged(path, content, log, { dryRun = false } = {}) {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return false
  if (dryRun) {
    log(`would sync ${path.replace(`${repoRoot}/`, '')}`)
    return true
  }
  writeFileSync(path, content, 'utf8')
  log(`synced ${path.replace(`${repoRoot}/`, '')}`)
  return true
}

function bumpPluginVersion(log, count, { dryRun = false } = {}) {
  if (!existsSync(pluginJsonPath)) {
    log(`skip version bump: ${pluginJsonPath} not found`)
    return
  }

  const manifest = JSON.parse(readFileSync(pluginJsonPath, 'utf8'))
  const oldVersion = manifest.version || '0.1.0'
  const baseVersion = oldVersion.split('+')[0]
  const stamp = Date.now().toString()
  const nextVersion = `${baseVersion}+codex.${stamp}`

  manifest.version = nextVersion
  manifest.description = `个人数字团队：默认入口、任务路由与 ${count} 个岗位 Agent 的插件化能力包。`
  manifest.interface = {
    ...(manifest.interface || {}),
    shortDescription: `一键调用 ${count} 个数字员工岗位。`,
    longDescription: `个人数字团队插件，把默认入口、任务路由和 ${count} 个岗位 Agent 打包为可在 Codex 中复用和调度的能力包。`,
  }
  if (dryRun) {
    log(`would bump version ${oldVersion} -> ${nextVersion}`)
    return
  }
  writeFileSync(pluginJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  log(`version ${oldVersion} -> ${nextVersion}`)
}

function validatePlugin(log) {
  if (!existsSync(validatorPath)) {
    log(`skip validation: ${validatorPath} not found`)
    return
  }

  const result = spawnSync('python3', [validatorPath, pluginRoot], {
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const message = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(message || `plugin validation failed with status ${result.status}`)
  }

  const output = (result.stdout || '').trim()
  if (output) log(output)
}

export function syncPlugin({ log = console.log, dryRun = false } = {}) {
  if (!dryRun) mkdirSync(skillsRoot, { recursive: true })

  const slugs = listAgentSlugs()
  let changed = false

  for (const slug of slugs) {
    const sourcePath = join(agentsRoot, slug, 'AGENTS.md')
    if (!existsSync(sourcePath)) continue

    const source = readFileSync(sourcePath, 'utf8')
    const title = extractTitle(source, slug)
    const summary = extractSummary(source, title)
    const body = transformBody(source.trim())

    const skillContent = [
      '---',
      `name: ${slug}`,
      `description: ${quote(summary)}`,
      'disable-model-invocation: false',
      '---',
      '',
      `> 插件导出说明：本技能由仓库 \`agents/${slug}/AGENTS.md\` 导出，并由同步脚本生成。插件模式下请通过 \`$${slug}\` 调用其他岗位；原始 \`../\` 路径已转换为 skill 调用。`,
      '',
      body,
      '',
    ].join('\n')

    const skillDir = join(skillsRoot, slug)
    const agentsDir = join(skillDir, 'agents')
    if (!dryRun) mkdirSync(agentsDir, { recursive: true })
    const shortDescription =
      summary.length > 64 ? `${summary.slice(0, 63)}…` : summary

    changed =
      writeIfChanged(join(skillDir, 'SKILL.md'), skillContent, log, { dryRun }) || changed

    const agentYaml = [
      'interface:',
      `  display_name: ${quote(title)}`,
      `  short_description: ${quote(shortDescription)}`,
      `  default_prompt: ${quote(`使用 $${slug} 处理对应职责，并在需要时与其他数字团队岗位协作。`)}`,
      'policy:',
      `  allow_implicit_invocation: ${slug === 'main-agent'}`,
      '',
    ].join('\n')

    changed =
      writeIfChanged(join(agentsDir, 'openai.yaml'), agentYaml, log, { dryRun }) || changed
  }

  const pluginSkillEntries = existsSync(skillsRoot)
    ? readdirSync(skillsRoot, { withFileTypes: true })
    : []
  for (const entry of pluginSkillEntries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    if (slugs.includes(entry.name)) continue

    if (dryRun) {
      log(`would remove stale skill ${entry.name}`)
    } else {
      rmSync(join(skillsRoot, entry.name), { recursive: true, force: true })
      log(`removed stale skill ${entry.name}`)
    }
    changed = true
  }

  if (changed) bumpPluginVersion(log, slugs.length, { dryRun })
  validatePlugin(log)
  return changed
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const args = new Set(process.argv.slice(2))
  const supportedArgs = new Set(['--dry-run', '--check'])
  const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg))
  if (unknownArgs.length > 0) {
    console.error(`未知参数: ${unknownArgs.join(', ')}`)
    console.error('用法: node scripts/sync-plugin.mjs [--dry-run|--check]')
    process.exitCode = 2
  } else {
    const dryRun = args.has('--dry-run') || args.has('--check')
    const changed = syncPlugin({ dryRun })
    if (args.has('--check') && changed) {
      console.error('插件与源目录不同步，请先运行 pnpm sync-plugin。')
      process.exitCode = 1
    }
  }
}
