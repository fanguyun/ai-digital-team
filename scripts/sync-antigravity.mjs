import { Buffer } from 'node:buffer'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadAgentManifest, repoRoot } from './agent-manifest.mjs'

const agentsRoot = join(repoRoot, 'agents')
const pluginRoot = join(
  repoRoot,
  'antigravity',
  'plugins',
  'personal-digital-team'
)
const rulesRoot = join(pluginRoot, 'rules')
const mainSkillRoot = join(pluginRoot, 'skills', 'main-agent')
const referencesRoot = join(mainSkillRoot, 'references')
const pluginScriptsRoot = join(pluginRoot, 'scripts')

const pluginJsonPath = join(pluginRoot, 'plugin.json')
const pluginReadmePath = join(pluginRoot, 'README.md')
const rulesAgentsPath = join(rulesRoot, 'AGENTS.md')
const mainSkillPath = join(mainSkillRoot, 'SKILL.md')
const routingMatrixSourcePath = join(agentsRoot, 'ROUTING_MATRIX.md')
const deliveryProtocolSourcePath = join(agentsRoot, 'DELIVERY_PROTOCOL.md')
const taskRuntimeSourcePath = join(repoRoot, 'scripts', 'task-runtime.mjs')
const runtimeTelemetrySourcePath = join(
  repoRoot,
  'scripts',
  'runtime-telemetry.mjs'
)
const rootPackageJsonPath = join(repoRoot, 'package.json')

export const ANTIGRAVITY_RULE_MAX_BYTES = 24_000
export const ANTIGRAVITY_ALLOWED_MANIFEST_KEYS = new Set([
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

function quote(value) {
  return JSON.stringify(value)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function listInvocableNames(manifest) {
  const names = new Set(manifest.agents.map((agent) => agent.slug))
  for (const agent of manifest.agents) {
    for (const skill of agent.skills) names.add(skill)
    for (const skill of agent.capabilityRequirements?.requiredSkills || []) {
      names.add(skill)
    }
    for (const skill of agent.capabilityRequirements?.optionalSkills || []) {
      names.add(skill)
    }
  }
  return [...names]
    .filter((name) => /^[a-z0-9][a-z0-9-]*$/.test(name))
    .sort((left, right) => right.length - left.length)
}

export function transformAntigravityMarkdown(
  body,
  { scope, invocableNames = [] }
) {
  const refPrefix = scope === 'skill' ? './references/' : './'
  const scriptsPrefix =
    scope === 'skill' ? '../../scripts/' : '../../../scripts/'

  let result = body
    .replace(/\.\.\/\.\.\/scripts\//g, '__AGY_SCRIPTS__/')
    .replace(
      /`?\.\.\/ROUTING_MATRIX\.md`?/g,
      `\`${refPrefix}ROUTING_MATRIX.md\``
    )
    .replace(
      /`?\.\.\/DELIVERY_PROTOCOL\.md`?/g,
      `\`${refPrefix}DELIVERY_PROTOCOL.md\``
    )
    .replace(
      /`?agents\/DELIVERY_PROTOCOL\.md`?/g,
      `\`${refPrefix}DELIVERY_PROTOCOL.md\``
    )
    .replace(
      /\.\.\/([a-z0-9-]+)\/AGENTS\.md/g,
      (_, slug) => `${refPrefix}${slug}.md`
    )
    .replace(/\.\.\/([a-z0-9-]+)\//g, (_, slug) => `${refPrefix}${slug}.md`)
    .replace(
      /agents\/([a-z0-9-]+)\/\.agents\/skills\/([a-z0-9-]+)/g,
      (_, _agent, skill) => `~/.gemini/config/skills/${skill}/SKILL.md`
    )
    .replace(
      /(?<!\.)agents\/([a-z0-9-]+)\/AGENTS\.md/g,
      (_, slug) => `${refPrefix}${slug}.md`
    )
    .replace(
      /(?<!\.)agents\/([a-z0-9-]+)\//g,
      (_, slug) => `${refPrefix}${slug}.md`
    )
    .replaceAll('~/.codex/skills', '~/.gemini/config/skills')
    .replace(/__AGY_SCRIPTS__\//g, scriptsPrefix)

  for (const name of invocableNames) {
    result = result.replace(
      new RegExp(`\\$${escapeRegExp(name)}\\b`, 'g'),
      name
    )
  }

  return result
}

export function buildPluginManifest(manifest, rootPackageJson) {
  const count = manifest.agents.length
  const version =
    typeof rootPackageJson?.version === 'string' &&
    rootPackageJson.version.trim()
      ? rootPackageJson.version.trim()
      : '0.1.0'
  const repository =
    rootPackageJson?.repository &&
    typeof rootPackageJson.repository === 'object'
      ? {
          type: rootPackageJson.repository.type || 'git',
          url: rootPackageJson.repository.url,
        }
      : undefined

  const output = {
    name: 'personal-digital-team',
    displayName: '个人数字团队',
    version,
    description: `个人数字团队：默认入口、任务路由与 ${count} 个岗位 Agent 的 Antigravity 插件能力包。`,
    author: {
      name: 'Personal Digital Team',
    },
    ...(repository?.url ? { repository } : {}),
    suggestedPrompts: [
      '使用个人数字团队理解我的目标并路由到合适的岗位。',
      '用 main-agent 协调多个数字员工完成任务。',
      '列出当前个人数字团队中可用的岗位。',
    ],
  }

  return `${JSON.stringify(output, null, 2)}\n`
}

export function buildPluginRules(manifest) {
  const rows = manifest.agents.map(
    (agent) =>
      `| ${escapeTableCell(agent.name)}（${escapeTableCell(agent.en)}） | \`${agent.slug}\` | ${escapeTableCell(agent.scope)} |`
  )

  return [
    '# 个人数字团队（Antigravity 插件入口规则）',
    '',
    '> 本文件由 `scripts/sync-antigravity.mjs` 根据 `agents/manifest.json` 自动生成，请勿手工编辑。',
    '',
    '## 入口与路由规则',
    '',
    '- 默认通过本插件的 `main-agent` Skill 理解目标、判断主责岗位并整合结果；不把全部 ' +
      `${manifest.agents.length} 个岗位同时展开为独立 Skill，以节省 Antigravity 上下文预算。`,
    '- 需要具体岗位规则时，按需读取 `main-agent` Skill 同目录下的 `references/<slug>.md`；涉及职责重叠、多岗位协作或交付规范时，按需读取 `references/ROUTING_MATRIX.md` 和 `references/DELIVERY_PROTOCOL.md`。',
    '- 若当前打开的工作区本身就是 `ai-digital-team` 源码仓库，优先读取仓库根目录 `AGENTS.md` 与 `agents/<slug>/AGENTS.md` 源文档，避免重复规则冲突。',
    '- 每次实质性回复首行保留路由说明：`本次使用：<子 Agent 或未使用子 Agent>；Skill：<实际使用的 Skill 名称或未使用 Skill>；原因：<一句话>`。',
    '',
    '## 公共边界',
    '',
    '- 涉及文件新增/修改/删除、配置变更、外部发布、发送或付费操作前，先展示变更计划并等待用户明确确认。',
    '- 本插件为薄插件，不复制外部专项 Skill；引用本机全局 Skill（`~/.gemini/config/skills/` 或 `.agents/skills/`）前先核验存在性，缺失时向用户说明并确认后再安装。',
    '- 不编造未执行的测试、构建或外部系统写入结果；不将密钥、令牌或个人凭证写入规则或日志。',
    '',
    `## 岗位索引（共 ${manifest.agents.length} 个）`,
    '',
    '| 岗位 | 引用标识（`references/<slug>.md`） | 负责范围 |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}

function buildMainSkill(manifest, invocableNames) {
  const mainSourcePath = join(agentsRoot, 'main-agent', 'AGENTS.md')
  if (!existsSync(mainSourcePath)) {
    throw new Error('缺少 agents/main-agent/AGENTS.md')
  }
  const source = readFileSync(mainSourcePath, 'utf8').trim()
  const body = transformAntigravityMarkdown(source, {
    scope: 'skill',
    invocableNames,
  })
  const count = manifest.agents.length
  const description = `个人数字团队默认入口与任务协调中枢：负责理解目标、按路由矩阵选择 ${count} 个专业岗位（按需读取 references/<slug>.md）并按统一交付协议整合结果。`

  return [
    '---',
    'name: main-agent',
    `description: ${quote(description)}`,
    '---',
    '',
    '> Antigravity 插件导出说明：本技能由仓库 `agents/main-agent/AGENTS.md` 自动生成。为避免占用过多 Skill 上下文预算，其余岗位规则与共享协议均位于本技能同级 `references/` 目录，路由命中后按需使用 `read_file` 读取。',
    '',
    '## 快速定位',
    '',
    '- 路由矩阵：[ROUTING_MATRIX.md](./references/ROUTING_MATRIX.md)',
    '- 统一交付协议：[DELIVERY_PROTOCOL.md](./references/DELIVERY_PROTOCOL.md)',
    '- 岗位规则目录：`./references/<slug>.md`（与 `agents/manifest.json` 保持同步）',
    '- 只读诊断脚本：`node ../../scripts/list-team.mjs --format json`、`node ../../scripts/check-installation.mjs`',
    '',
    body,
    '',
  ].join('\n')
}

export function buildPluginReadme(manifest) {
  return [
    '# Personal Digital Team（Antigravity 插件）',
    '',
    `> 由 \`scripts/sync-antigravity.mjs\` 自动生成，包含默认入口 Skill（\`main-agent\`）、入口规则与全部 ${manifest.agents.length} 个岗位的按需参考文档。`,
    '',
    '## 目录结构',
    '',
    '```text',
    'antigravity/plugins/personal-digital-team/',
    '├── plugin.json',
    '├── README.md',
    '├── rules/',
    '│   └── AGENTS.md',
    '├── skills/',
    '│   └── main-agent/',
    '│       ├── SKILL.md',
    '│       └── references/',
    '│           ├── ROUTING_MATRIX.md',
    '│           ├── DELIVERY_PROTOCOL.md',
    '│           └── <slug>.md (27 个岗位)',
    '└── scripts/',
    '    ├── list-team.mjs',
    '    ├── inspect-role.mjs',
    '    ├── check-installation.mjs',
    '    ├── task-runtime.mjs',
    '    └── runtime-telemetry.mjs',
    '```',
    '',
    '## 在 Antigravity 中启用',
    '',
    '方式一：在 `~/.gemini/config/plugins.json` 中声明本仓库的插件父目录（推荐，随时跟随 `yarn sync-antigravity` 更新）：',
    '',
    '```json',
    '{',
    '  "entries": [',
    '    { "path": "<repo-root>/antigravity/plugins" }',
    '  ]',
    '}',
    '```',
    '',
    '方式二：软链接到 Antigravity 全局插件目录：',
    '',
    '```bash',
    'mkdir -p ~/.gemini/config/plugins',
    'ln -s <repo-root>/antigravity/plugins/personal-digital-team ~/.gemini/config/plugins/personal-digital-team',
    '```',
    '',
    '## 自检命令',
    '',
    '```bash',
    'node antigravity/plugins/personal-digital-team/scripts/check-installation.mjs',
    'node antigravity/plugins/personal-digital-team/scripts/list-team.mjs --format json',
    '```',
    '',
  ].join('\n')
}

function buildListTeamScript() {
  return `import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
      const heading = markdown.match(/^#\\s+(.+)$/m)?.[1]?.trim() || slug
      const summary = markdown.match(/^>\\s*(.+)$/m)?.[1]?.trim() || ''
      return {
        slug,
        name: heading,
        description: summary,
        reference: \`skills/main-agent/references/\${entry.name}\`,
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
    console.log(\`当前可用岗位：\${team.length} 个\`)
    for (const member of team) {
      console.log(\`- \${member.slug}｜\${member.name}｜\${member.description}\`)
    }
  }
}
`
}

function buildInspectRoleScript() {
  return `import { existsSync, readFileSync } from 'node:fs'
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
  const referencePath = resolve(referencesRoot, \`\${role}.md\`)
  if (!referencePath.startsWith(\`\${referencesRoot}\${sep}\`)) {
    throw new Error(\`非法岗位路径: \${role}\`)
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
        \`^##\\\\s+\${section}\\\\s*$\`,
        'm'
      ).test(content)
    }
    const candidates = [
      ...new Set(
        [...content.matchAll(/\`([a-z0-9][a-z0-9-]*)\`/g)].map((m) => m[1])
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
    console.error(\`非法岗位标识: \${parsed.role}\`)
    printHelp()
    process.exitCode = 2
  } else {
    const result = inspectRole(parsed.role)
    if (!result.referenceExists) {
      console.error(\`未找到岗位参考文档: \${parsed.role}\`)
      process.exitCode = 1
    } else {
      if (parsed.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log(\`岗位: \${result.role}\`)
        console.log(\`参考文档: \${result.referencePath}\`)
        console.log(
          \`规则章节: \${
            Object.entries(result.sections)
              .filter(([, ok]) => ok)
              .map(([name]) => name)
              .join('、') || '无'
          }\`
        )
        console.log(
          \`已检测到本机关联 Skill（仅列出已探测项，缺失项请核对岗位「Skill 使用规则」）: \${
            result.referencedSkills.map((item) => item.skill).join('、') || '无'
          }\`
        )
      }
      if (Object.values(result.sections).some((ok) => !ok)) {
        process.exitCode = 1
      }
    }
  }
}
`
}

function buildCheckInstallationScript() {
  return `import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
  console.error(\`问题: \${message}\`)
  issueCount += 1
}

if (!existsSync(manifestPath)) {
  issue('缺少 plugin.json')
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const field of ['name', 'description']) {
      if (!String(manifest[field] || '').trim()) {
        issue(\`plugin.json 缺少 \${field}\`)
      }
    }
    for (const key of Object.keys(manifest)) {
      if (!allowedKeys.has(key)) {
        issue(\`plugin.json 包含 Antigravity 不识别的顶层字段: \${key}\`)
      }
    }
  } catch (error) {
    issue(\`plugin.json 不是合法 JSON: \${error.message}\`)
  }
}

if (!existsSync(rulesPath)) {
  issue('缺少 rules/AGENTS.md')
} else {
  const rulesText = readFileSync(rulesPath, 'utf8')
  const bytes = Buffer.byteLength(rulesText, 'utf8')
  if (bytes > maxRuleBytes) {
    issue(\`rules/AGENTS.md 超过 Antigravity 24,000 字节上限（当前 \${bytes} 字节）\`)
  }
  if (/^---\\r?\\n/.test(rulesText)) {
    issue('rules/AGENTS.md 不应包含 YAML frontmatter')
  }
}

if (!existsSync(mainSkillPath)) {
  issue('缺少 skills/main-agent/SKILL.md')
} else {
  const content = readFileSync(mainSkillPath, 'utf8')
  const frontmatter = content.match(/^---\\n([\\s\\S]*?)\\n---(?:\\n|$)/)?.[1] || ''
  if (!/^name:\\s*main-agent\\s*$/m.test(frontmatter)) {
    issue('skills/main-agent/SKILL.md 缺少 name: main-agent')
  }
  if (!/^description:\\s*\\S+/m.test(frontmatter)) {
    issue('skills/main-agent/SKILL.md 缺少 description')
  }
}

if (!existsSync(referencesRoot)) {
  issue('缺少 skills/main-agent/references 目录')
} else {
  for (const required of ['ROUTING_MATRIX.md', 'DELIVERY_PROTOCOL.md']) {
    if (!existsSync(join(referencesRoot, required))) {
      issue(\`缺少共享参考文档: \${required}\`)
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
  console.error(\`Antigravity 插件安装检查失败：发现 \${issueCount} 个问题。\`)
  process.exitCode = 1
}
`
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

export function syncAntigravity({ log = console.log, dryRun = false } = {}) {
  for (const [path, label] of [
    [routingMatrixSourcePath, '路由矩阵'],
    [deliveryProtocolSourcePath, '统一交付协议'],
    [taskRuntimeSourcePath, '任务运行时 CLI'],
    [runtimeTelemetrySourcePath, '运行时遥测适配器'],
  ]) {
    if (!existsSync(path)) {
      throw new Error(`缺少${label}: ${path.replace(`${repoRoot}/`, '')}`)
    }
  }

  const manifest = loadAgentManifest()
  const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'))
  const slugs = manifest.agents.map((agent) => agent.slug)
  const invocableNames = listInvocableNames(manifest)

  const rulesContent = buildPluginRules(manifest)
  const ruleBytes = Buffer.byteLength(rulesContent, 'utf8')
  if (ruleBytes > ANTIGRAVITY_RULE_MAX_BYTES) {
    throw new Error(
      `Antigravity rules/AGENTS.md 超过 24,000 字节上限（当前 ${ruleBytes} 字节）`
    )
  }

  if (!dryRun) {
    mkdirSync(rulesRoot, { recursive: true })
    mkdirSync(referencesRoot, { recursive: true })
    mkdirSync(pluginScriptsRoot, { recursive: true })
  }

  let changed = false
  const expectedWrites = [
    [pluginJsonPath, buildPluginManifest(manifest, rootPackageJson)],
    [pluginReadmePath, buildPluginReadme(manifest)],
    [rulesAgentsPath, rulesContent],
    [mainSkillPath, buildMainSkill(manifest, invocableNames)],
    [
      join(referencesRoot, 'ROUTING_MATRIX.md'),
      `${transformAntigravityMarkdown(
        readFileSync(routingMatrixSourcePath, 'utf8').trim(),
        { scope: 'reference', invocableNames }
      )}\n`,
    ],
    [
      join(referencesRoot, 'DELIVERY_PROTOCOL.md'),
      [
        '> Antigravity 插件补充说明：从 `skills/main-agent/SKILL.md` 调用随包脚本使用 `../../scripts/task-runtime.mjs`，从 `skills/main-agent/references/` 调用使用 `../../../scripts/task-runtime.mjs`。当前任务运行时 `--telemetry auto` 仅支持 Codex 与 DeepSeek Harness 会话日志；在 Antigravity 中如需写入运行时，请显式传入元数据参数或使用 `--telemetry off`。',
        '',
        transformAntigravityMarkdown(
          readFileSync(deliveryProtocolSourcePath, 'utf8').trim(),
          { scope: 'reference', invocableNames }
        ),
        '',
      ].join('\n'),
    ],
    [
      join(pluginScriptsRoot, 'task-runtime.mjs'),
      readFileSync(taskRuntimeSourcePath, 'utf8'),
    ],
    [
      join(pluginScriptsRoot, 'runtime-telemetry.mjs'),
      readFileSync(runtimeTelemetrySourcePath, 'utf8'),
    ],
    [join(pluginScriptsRoot, 'list-team.mjs'), buildListTeamScript()],
    [join(pluginScriptsRoot, 'inspect-role.mjs'), buildInspectRoleScript()],
    [
      join(pluginScriptsRoot, 'check-installation.mjs'),
      buildCheckInstallationScript(),
    ],
  ]

  for (const slug of slugs) {
    const sourcePath = join(agentsRoot, slug, 'AGENTS.md')
    if (!existsSync(sourcePath)) continue
    const body = transformAntigravityMarkdown(
      readFileSync(sourcePath, 'utf8').trim(),
      { scope: 'reference', invocableNames }
    )
    const content = [
      `> Antigravity 插件参考文档：由仓库 \`agents/${slug}/AGENTS.md\` 自动生成。`,
      '',
      body,
      '',
    ].join('\n')
    expectedWrites.push([join(referencesRoot, `${slug}.md`), content])
  }

  for (const [path, content] of expectedWrites) {
    changed = writeIfChanged(path, content, log, { dryRun }) || changed
  }

  const expectedReferenceFiles = new Set([
    'ROUTING_MATRIX.md',
    'DELIVERY_PROTOCOL.md',
    ...slugs.map((slug) => `${slug}.md`),
  ])
  const existingRefs = existsSync(referencesRoot)
    ? readdirSync(referencesRoot, { withFileTypes: true })
    : []
  for (const entry of existingRefs) {
    if (entry.name.startsWith('.')) continue
    if (expectedReferenceFiles.has(entry.name)) continue
    const targetPath = join(referencesRoot, entry.name)
    if (dryRun) {
      log(`would remove stale reference ${entry.name}`)
    } else {
      rmSync(targetPath, { recursive: true, force: true })
      log(`removed stale reference ${entry.name}`)
    }
    changed = true
  }

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
    console.error('用法: node scripts/sync-antigravity.mjs [--dry-run|--check]')
    process.exitCode = 2
  } else {
    try {
      const dryRun = args.has('--dry-run') || args.has('--check')
      const changed = syncAntigravity({ dryRun })
      if (args.has('--check') && changed) {
        console.error(
          'Antigravity 插件与源目录不同步，请先运行 yarn sync-antigravity。'
        )
        process.exitCode = 1
      }
    } catch (error) {
      console.error(`Antigravity 插件同步失败: ${error.message}`)
      process.exitCode = 1
    }
  }
}
