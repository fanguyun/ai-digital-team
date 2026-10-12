import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAgentManifest, repoRoot } from './agent-manifest.mjs'

const rootAgentsPath = join(repoRoot, 'AGENTS.md')
const mainAgentPath = join(repoRoot, 'agents', 'main-agent', 'AGENTS.md')
const routingMatrixPath = join(repoRoot, 'agents', 'ROUTING_MATRIX.md')
const deliveryProtocolPath = join(repoRoot, 'agents', 'DELIVERY_PROTOCOL.md')
const deliveryProtocolSections = [
  '适用范围',
  '任务状态',
  '最小交付字段',
  '跨岗位交接',
  '外部影响与确认',
  '交付模板',
]

function replaceRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`无法定位 ${label}`)
  return content.replace(pattern, replacement)
}

function createRootIndex(agents) {
  const rows = agents.map(
    (agent) =>
      `| ${agent.name}（${agent.en}） | \`agents/${agent.slug}/\` | ${agent.scope} |`,
  )
  return [
    '## Agent 索引（Agent Directory）',
    '',
    '> 本节由 `agents/manifest.json` 自动生成，请勿手工编辑。',
    '',
    '| Agent | 目录 | 负责范围 |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n')
}

function createMainAgentSummary(agents) {
  const names = agents.map((agent) => `${agent.name}（${agent.en}）`).join('、')
  return `- 当前已配置岗位（共 ${agents.length} 个）：${names}。`
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function createRoutingMatrix(manifest) {
  const agentsBySlug = new Map(manifest.agents.map((agent) => [agent.slug, agent]))
  const agentLabel = (slug) => {
    const agent = agentsBySlug.get(slug)
    return `${agent.name}（\`agents/${slug}/\`）`
  }
  const rows = manifest.routingMatrix.map((route) => {
    const collaborators = route.collaborators.length
      ? route.collaborators.map(agentLabel).join('、')
      : '无固定协作岗位'
    return `| ${escapeTableCell(route.scenario)} | ${escapeTableCell(agentLabel(route.primary))} | ${escapeTableCell(collaborators)} | ${escapeTableCell(route.chooseWhen)} | ${escapeTableCell(route.boundary)} | ${escapeTableCell(route.handoff)} |`
  })
  return [
    '# Agent 路由矩阵',
    '',
    '> 本文件由 `agents/manifest.json` 自动生成，请勿手工编辑。',
    '',
    '## 路由原则',
    '',
    '1. 用户明确指定岗位且任务未越过其边界时，优先使用该岗位。',
    '2. 未指定岗位、职责重叠或需要跨岗位协作时，由 Main Agent 使用本矩阵确定一个当前主责岗位。',
    '3. 协作岗位只提供专业输入；主责岗位或 Main Agent 按 `agents/DELIVERY_PROTOCOL.md` 整合交付。',
    '4. 认证、隐私、支付、数据迁移、安全和生产发布等高风险任务，必须保留独立验收或专业复核。',
    '5. 没有匹配项时由 Main Agent 直接处理或提出新增长期岗位建议，不为一次性任务新增岗位。',
    '',
    '## 决策矩阵',
    '',
    '| 场景 | 主责岗位 | 协作岗位 | 选择规则 | 职责边界 | 下一步交接 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## 使用要求',
    '',
    '- 路由前先确认目标、交付物、时限、可用资料和外部影响。',
    '- 路由结果必须说明当前主责岗位；跨岗位时说明协作顺序和最终整合责任。',
    '- 若具体岗位 `AGENTS.md` 与本矩阵存在更严格边界，以具体岗位规则为准。',
    '',
  ].join('\n')
}

function validateDeliveryProtocol() {
  if (!existsSync(deliveryProtocolPath)) {
    throw new Error('缺少 agents/DELIVERY_PROTOCOL.md')
  }
  const content = readFileSync(deliveryProtocolPath, 'utf8')
  for (const section of deliveryProtocolSections) {
    if (!new RegExp(`^##\\s+${section}\\s*$`, 'm').test(content)) {
      throw new Error(`agents/DELIVERY_PROTOCOL.md 缺少 ## ${section}`)
    }
  }
}

function expectedFiles() {
  const manifest = loadAgentManifest()
  validateDeliveryProtocol()
  const rootContent = readFileSync(rootAgentsPath, 'utf8')
  const mainContent = readFileSync(mainAgentPath, 'utf8')
  const nextRoot = replaceRequired(
    rootContent,
    /## Agent 索引（Agent Directory）[\s\S]*?(?=\n## 公共边界)/,
    createRootIndex(manifest.agents),
    '根目录 Agent 索引',
  )
  const nextMain = replaceRequired(
    mainContent,
    /^- 当前已配置岗位（共 \d+ 个）：.*$/m,
    createMainAgentSummary(manifest.agents),
    'Main Agent 岗位总览',
  )
  return [
    [rootAgentsPath, nextRoot],
    [mainAgentPath, nextMain],
    [routingMatrixPath, createRoutingMatrix(manifest)],
  ]
}

export function syncAgentIndexes({ check = false, log = console.log } = {}) {
  let changed = false
  for (const [path, expected] of expectedFiles()) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : ''
    if (current === expected) continue
    changed = true
    const relativePath = path.replace(`${repoRoot}/`, '')
    if (check) {
      log(`would sync ${relativePath}`)
    } else {
      writeFileSync(path, expected, 'utf8')
      log(`synced ${relativePath}`)
    }
  }
  return changed
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const args = new Set(process.argv.slice(2))
  const unknownArgs = [...args].filter((arg) => arg !== '--check')
  if (unknownArgs.length > 0) {
    console.error(`未知参数: ${unknownArgs.join(', ')}`)
    console.error('用法: node scripts/sync-agent-indexes.mjs [--check]')
    process.exitCode = 2
  } else {
    try {
      const changed = syncAgentIndexes({ check: args.has('--check') })
      if (args.has('--check') && changed) {
        console.error('Agent 索引与清单不同步，请先运行 pnpm sync-team。')
        process.exitCode = 1
      }
    } catch (error) {
      console.error(`Agent 索引同步失败: ${error.message}`)
      process.exitCode = 1
    }
  }
}
