import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(scriptDir, '..')
export const agentsRoot = join(repoRoot, 'agents')
export const manifestPath = join(agentsRoot, 'manifest.json')

const requiredStringFields = [
  'slug',
  'id',
  'name',
  'en',
  'group',
  'color',
  'icon',
  'role',
  'scope',
  'status',
  'trigger',
]

function listAgentRuleDirectories() {
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

function findDuplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function validateAgentManifest(manifest) {
  const issues = []

  if (manifest?.schemaVersion !== 2) {
    issues.push('schemaVersion 必须为 2')
  }
  if (!Array.isArray(manifest?.groups) || manifest.groups.length === 0) {
    issues.push('groups 必须是非空数组')
  }
  if (!Array.isArray(manifest?.agents) || manifest.agents.length === 0) {
    issues.push('agents 必须是非空数组')
  }
  if (!Array.isArray(manifest?.routingMatrix) || manifest.routingMatrix.length === 0) {
    issues.push('routingMatrix 必须是非空数组')
  }
  if (issues.length > 0) return issues

  const duplicateGroups = findDuplicates(manifest.groups)
  if (duplicateGroups.length > 0) {
    issues.push(`存在重复分组: ${duplicateGroups.join(', ')}`)
  }

  const ids = manifest.agents.map((agent) => agent?.id)
  const slugs = manifest.agents.map((agent) => agent?.slug)
  const duplicateIds = findDuplicates(ids)
  const duplicateSlugs = findDuplicates(slugs)
  if (duplicateIds.length > 0) issues.push(`存在重复 id: ${duplicateIds.join(', ')}`)
  if (duplicateSlugs.length > 0) issues.push(`存在重复 slug: ${duplicateSlugs.join(', ')}`)

  manifest.agents.forEach((agent, index) => {
    const label = agent?.slug || agent?.id || `agents[${index}]`
    for (const field of requiredStringFields) {
      if (typeof agent?.[field] !== 'string' || agent[field].trim() === '') {
        issues.push(`${label} 的 ${field} 必须是非空字符串`)
      }
    }
    if (!Array.isArray(agent?.skills) || agent.skills.some((skill) => typeof skill !== 'string')) {
      issues.push(`${label} 的 skills 必须是字符串数组`)
    }
    if (!manifest.groups.includes(agent?.group)) {
      issues.push(`${label} 使用了未声明分组: ${agent?.group}`)
    }
    if (typeof agent?.color === 'string' && !/^#[0-9a-f]{6}$/i.test(agent.color)) {
      issues.push(`${label} 的 color 必须是六位十六进制颜色`)
    }
  })

  if (manifest.agents[0]?.slug !== 'main-agent') {
    issues.push('main-agent 必须位于 agents 首位')
  }

  const ruleDirectories = listAgentRuleDirectories()
  const manifestSlugs = [...slugs].sort()
  for (const slug of ruleDirectories) {
    if (!manifestSlugs.includes(slug)) issues.push(`清单缺少岗位目录: ${slug}`)
  }
  for (const slug of manifestSlugs) {
    if (!ruleDirectories.includes(slug)) issues.push(`清单引用了不存在的岗位目录: ${slug}`)
  }

  const routeIds = manifest.routingMatrix.map((route) => route?.id)
  const routeScenarios = manifest.routingMatrix.map((route) => route?.scenario)
  const duplicateRouteIds = findDuplicates(routeIds)
  const duplicateRouteScenarios = findDuplicates(routeScenarios)
  if (duplicateRouteIds.length > 0) {
    issues.push(`存在重复路由场景 id: ${duplicateRouteIds.join(', ')}`)
  }
  if (duplicateRouteScenarios.length > 0) {
    issues.push(`存在重复路由场景: ${duplicateRouteScenarios.join(', ')}`)
  }
  manifest.routingMatrix.forEach((route, index) => {
    const label = route?.id || `routingMatrix[${index}]`
    for (const field of ['id', 'scenario', 'primary', 'chooseWhen', 'boundary', 'handoff']) {
      if (typeof route?.[field] !== 'string' || route[field].trim() === '') {
        issues.push(`${label} 的 ${field} 必须是非空字符串`)
      }
    }
    if (!Array.isArray(route?.collaborators)) {
      issues.push(`${label} 的 collaborators 必须是数组`)
      return
    }
    if (!slugs.includes(route.primary)) {
      issues.push(`${label} 的主责岗位不存在: ${route.primary}`)
    }
    const duplicateCollaborators = findDuplicates(route.collaborators)
    if (duplicateCollaborators.length > 0) {
      issues.push(`${label} 存在重复协作岗位: ${duplicateCollaborators.join(', ')}`)
    }
    for (const collaborator of route.collaborators) {
      if (!slugs.includes(collaborator)) {
        issues.push(`${label} 的协作岗位不存在: ${collaborator}`)
      }
      if (collaborator === route.primary) {
        issues.push(`${label} 的主责岗位不能同时作为协作岗位`)
      }
    }
  })

  return issues
}

export function loadAgentManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`缺少 Agent 清单: ${manifestPath.replace(`${repoRoot}/`, '')}`)
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    throw new Error(`Agent 清单不是合法 JSON: ${error.message}`)
  }

  const issues = validateAgentManifest(manifest)
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `- ${issue}`).join('\n'))
  }
  return manifest
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    const manifest = loadAgentManifest()
    console.log(
      `Agent 清单检查通过：${manifest.agents.length} 个岗位，${manifest.groups.length} 个分组，${manifest.routingMatrix.length} 个路由场景。`,
    )
  } catch (error) {
    console.error(`Agent 清单检查失败：\n${error.message}`)
    process.exitCode = 1
  }
}
