import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { loadAgentManifest } from './agent-manifest.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const agentsRoot = join(repoRoot, 'agents')
const pluginRoot = join(repoRoot, 'plugins', 'personal-digital-team')
const skillsRoot = join(pluginRoot, 'skills')
const manifestPath = join(pluginRoot, '.codex-plugin', 'plugin.json')
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
const requiredSections = ['Role', 'Context', 'Capabilities', 'Instructions']
let issueCount = 0

function issue(message) {
  console.error(`问题: ${message}`)
  issueCount += 1
}

if (!existsSync(runtimeTelemetryPluginPath)) {
  issue(
    '缺少插件运行时遥测适配器: plugins/personal-digital-team/scripts/runtime-telemetry.mjs'
  )
} else if (
  readFileSync(runtimeTelemetryPluginPath, 'utf8') !==
  readFileSync(runtimeTelemetrySourcePath, 'utf8')
) {
  issue('插件运行时遥测适配器与源文件不同步')
}

let agentManifest
try {
  agentManifest = loadAgentManifest()
} catch (error) {
  issue(`Agent 清单无效: ${error.message}`)
  agentManifest = { agents: [] }
}

const agentSlugs = agentManifest.agents.map((agent) => agent.slug)
const pluginSlugs = existsSync(skillsRoot)
  ? readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort()
  : []

if (!existsSync(taskRuntimePluginPath)) {
  issue(
    '缺少插件任务运行时 CLI: plugins/personal-digital-team/scripts/task-runtime.mjs'
  )
} else if (
  readFileSync(taskRuntimePluginPath, 'utf8') !==
  readFileSync(taskRuntimeSourcePath, 'utf8')
) {
  issue('插件任务运行时 CLI 与源文件不同步')
}

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
  if (!existsSync(skillPath))
    issue(`缺少插件 Skill: ${skillPath.replace(`${repoRoot}/`, '')}`)
  if (!existsSync(yamlPath))
    issue(`缺少插件元数据: ${yamlPath.replace(`${repoRoot}/`, '')}`)
  if (existsSync(skillPath)) {
    const skillContent = readFileSync(skillPath, 'utf8')
    if (!skillContent.includes('## 团队统一交付协议（共享规则）')) {
      issue(`${skillPath.replace(`${repoRoot}/`, '')} 缺少统一交付协议`)
    }
    if (!skillContent.includes('## 真实任务运行记录')) {
      issue(`${skillPath.replace(`${repoRoot}/`, '')} 缺少真实任务运行记录协议`)
    }
    if (
      slug === 'main-agent' &&
      !skillContent.includes('## 团队路由矩阵（共享规则）')
    ) {
      issue(`${skillPath.replace(`${repoRoot}/`, '')} 缺少团队路由矩阵`)
    }
    if (/`\.\.\/(ROUTING_MATRIX|DELIVERY_PROTOCOL)\.md`/.test(skillContent)) {
      issue(
        `${skillPath.replace(`${repoRoot}/`, '')} 保留了不可用的共享规则相对路径`
      )
    }
  }
}

for (const slug of pluginSlugs) {
  if (!agentSlugs.includes(slug)) issue(`插件存在过期岗位: ${slug}`)
}

if (!existsSync(manifestPath)) {
  issue('缺少 plugins/personal-digital-team/.codex-plugin/plugin.json')
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const match = String(manifest.description || '').match(
      /与 (\d+) 个岗位 Agent/
    )
    if (!match || Number(match[1]) !== agentSlugs.length) {
      issue(`plugin.json 岗位数量与源目录不一致，应为 ${agentSlugs.length}`)
    }
  } catch (error) {
    issue(`plugin.json 不是合法 JSON: ${error.message}`)
  }
}

const syncCheck = spawnSync(
  process.execPath,
  [join(scriptDir, 'sync-plugin.mjs'), '--check'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  }
)
if (syncCheck.stdout) process.stdout.write(syncCheck.stdout)
if (syncCheck.stderr) process.stderr.write(syncCheck.stderr)
if (syncCheck.status !== 0) issue('插件导出内容与源目录不同步')

if (issueCount === 0) {
  console.log(
    `插件检查通过：${agentSlugs.length} 个岗位，源目录与导出内容一致。`
  )
} else {
  console.error(`插件检查失败：发现 ${issueCount} 个问题。`)
  process.exitCode = 1
}
