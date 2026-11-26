import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { loadAgentManifest, repoRoot } from './agent-manifest.mjs'
import {
  ANTIGRAVITY_ALLOWED_MANIFEST_KEYS,
  ANTIGRAVITY_RULE_MAX_BYTES,
  syncAntigravity,
} from './sync-antigravity.mjs'

const pluginRoot = join(
  repoRoot,
  'antigravity',
  'plugins',
  'personal-digital-team'
)
const manifestPath = join(pluginRoot, 'plugin.json')
const rulesPath = join(pluginRoot, 'rules', 'AGENTS.md')
const mainSkillPath = join(pluginRoot, 'skills', 'main-agent', 'SKILL.md')
const referencesRoot = join(pluginRoot, 'skills', 'main-agent', 'references')
const taskRuntimeSourcePath = join(repoRoot, 'scripts', 'task-runtime.mjs')
const taskRuntimePluginPath = join(pluginRoot, 'scripts', 'task-runtime.mjs')
const runtimeTelemetrySourcePath = join(
  repoRoot,
  'scripts',
  'runtime-telemetry.mjs'
)
const runtimeTelemetryPluginPath = join(
  pluginRoot,
  'scripts',
  'runtime-telemetry.mjs'
)
const requiredRuntimePolicy =
  '只要本次任务明确通过个人数字团队的 Main Agent 或任一岗位 Agent 处理，就必须写入任务运行时'

let issueCount = 0

function issue(message) {
  console.error(`问题: ${message}`)
  issueCount += 1
}

const manifest = loadAgentManifest()

if (!existsSync(manifestPath)) {
  issue('缺少 antigravity/plugins/personal-digital-team/plugin.json')
} else {
  try {
    const pluginManifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const key of Object.keys(pluginManifest)) {
      if (!ANTIGRAVITY_ALLOWED_MANIFEST_KEYS.has(key)) {
        issue(`plugin.json 包含不支持的顶层字段: ${key}`)
      }
    }
    if (pluginManifest.name !== 'personal-digital-team') {
      issue(`plugin.json 的 name 应为 personal-digital-team`)
    }
    const match = String(pluginManifest.description || '').match(
      /与 (\d+) 个岗位 Agent/
    )
    if (!match || Number(match[1]) !== manifest.agents.length) {
      issue(
        `plugin.json 岗位数量与源目录不一致，应为 ${manifest.agents.length}`
      )
    }
  } catch (error) {
    issue(`plugin.json 不是合法 JSON: ${error.message}`)
  }
}

if (!existsSync(rulesPath)) {
  issue('缺少 antigravity/plugins/personal-digital-team/rules/AGENTS.md')
} else {
  const rulesText = readFileSync(rulesPath, 'utf8')
  const bytes = Buffer.byteLength(rulesText, 'utf8')
  if (bytes > ANTIGRAVITY_RULE_MAX_BYTES) {
    issue(`rules/AGENTS.md 超过 24,000 字节上限（当前 ${bytes} 字节）`)
  }
  if (/^---\r?\n/.test(rulesText)) {
    issue('rules/AGENTS.md 不应包含 YAML frontmatter')
  }
}

if (!existsSync(mainSkillPath)) {
  issue('缺少 skills/main-agent/SKILL.md')
} else {
  const skillText = readFileSync(mainSkillPath, 'utf8')
  const frontmatter =
    skillText.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] || ''
  if (!/^name:\s*main-agent\s*$/m.test(frontmatter)) {
    issue('skills/main-agent/SKILL.md 缺少 name: main-agent')
  }
  if (!/^description:\s*\S+/m.test(frontmatter)) {
    issue('skills/main-agent/SKILL.md 缺少 description')
  }
  if (skillText.includes('~/.codex/skills')) {
    issue('skills/main-agent/SKILL.md 残留 ~/.codex/skills 路径')
  }
  if (/`\.\.\/(ROUTING_MATRIX|DELIVERY_PROTOCOL)\.md`/.test(skillText)) {
    issue('skills/main-agent/SKILL.md 保留了不可用的共享规则相对路径')
  }
}

for (const [pluginPath, sourcePath, label] of [
  [taskRuntimePluginPath, taskRuntimeSourcePath, '任务运行时 CLI'],
  [runtimeTelemetryPluginPath, runtimeTelemetrySourcePath, '运行时遥测适配器'],
]) {
  if (!existsSync(pluginPath)) {
    issue(
      `缺少 Antigravity 插件${label}: ${pluginPath.replace(`${repoRoot}/`, '')}`
    )
  } else if (
    readFileSync(pluginPath, 'utf8') !== readFileSync(sourcePath, 'utf8')
  ) {
    issue(`Antigravity 插件${label}与源文件不同步`)
  }
}

const deliveryPath = join(referencesRoot, 'DELIVERY_PROTOCOL.md')
if (!existsSync(deliveryPath)) {
  issue('缺少 references/DELIVERY_PROTOCOL.md')
} else {
  const deliveryText = readFileSync(deliveryPath, 'utf8')
  if (!deliveryText.includes(requiredRuntimePolicy)) {
    issue('references/DELIVERY_PROTOCOL.md 缺少团队 Agent 全量任务记录规则')
  }
}

if (!existsSync(join(referencesRoot, 'ROUTING_MATRIX.md'))) {
  issue('缺少 references/ROUTING_MATRIX.md')
}

for (const agent of manifest.agents) {
  const refPath = join(referencesRoot, `${agent.slug}.md`)
  if (!existsSync(refPath)) {
    issue(`缺少岗位参考文档: references/${agent.slug}.md`)
    continue
  }
  const content = readFileSync(refPath, 'utf8')
  if (content.includes('~/.codex/skills')) {
    issue(`references/${agent.slug}.md 残留 ~/.codex/skills 路径`)
  }
  if (/`\.\.\/(ROUTING_MATRIX|DELIVERY_PROTOCOL)\.md`/.test(content)) {
    issue(`references/${agent.slug}.md 保留了不可用的共享规则相对路径`)
  }
}

try {
  const changed = syncAntigravity({ dryRun: true, log: () => {} })
  if (changed) issue('Antigravity 插件导出与源目录不同步')
} catch (error) {
  issue(error.message)
}

const installCheck = spawnSync(
  process.execPath,
  [join(pluginRoot, 'scripts', 'check-installation.mjs')],
  { cwd: repoRoot, encoding: 'utf8' }
)
if (installCheck.status !== 0) {
  issue(
    [installCheck.stdout, installCheck.stderr]
      .filter(Boolean)
      .join('\n')
      .trim() || '内置 check-installation.mjs 执行失败'
  )
}

const listCheck = spawnSync(
  process.execPath,
  [join(pluginRoot, 'scripts', 'list-team.mjs'), '--format', 'json'],
  { cwd: repoRoot, encoding: 'utf8' }
)
if (listCheck.status !== 0) {
  issue(
    [listCheck.stdout, listCheck.stderr].filter(Boolean).join('\n').trim() ||
      '内置 list-team.mjs 执行失败'
  )
} else {
  try {
    const listed = JSON.parse(listCheck.stdout)
    if (!Array.isArray(listed) || listed.length !== manifest.agents.length) {
      issue(
        `list-team.mjs 输出岗位数量不匹配：预期 ${manifest.agents.length}，实际 ${listed?.length}`
      )
    }
  } catch (error) {
    issue(`list-team.mjs 输出不是合法 JSON: ${error.message}`)
  }
}

if (issueCount === 0) {
  console.log(
    `Antigravity 插件检查通过：1 个入口 Skill、${manifest.agents.length} 个岗位参考文档，与源目录一致。`
  )
} else {
  console.error(`Antigravity 插件检查失败：发现 ${issueCount} 个问题。`)
  process.exitCode = 1
}
