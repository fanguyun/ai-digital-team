import agentManifest from '../../../../agents/manifest.json'

/**
 * 技能 → 数字员工（岗位）的反向索引。
 *
 * 数据来自 agents/manifest.json 的
 * agents[].capabilityRequirements.requiredSkills / optionalSkills，
 * 这两处引用的是技能目录名（与技能库里的目录同名）。
 */

const AGENTS = Array.isArray(agentManifest.agents) ? agentManifest.agents : []

const SKILLS_BY_AGENT = new Map(
  AGENTS.map((agent) => {
    const requirements = agent.capabilityRequirements || {}
    return [
      agent.slug,
      new Set([
        ...(requirements.requiredSkills || []),
        ...(requirements.optionalSkills || []),
      ]),
    ]
  })
)

/** 技能的匹配键：优先用目录名（manifest 里引用的就是它） */
export const skillKey = (skill) => {
  if (!skill) return ''
  const folder = String(skill.path || '')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
  return folder || skill.name || ''
}

/** 返回引用了这个技能的数字员工列表（按 manifest 顺序） */
export const agentsUsing = (skill) => {
  const key = skillKey(skill)
  if (!key) return []
  return AGENTS.filter((agent) => SKILLS_BY_AGENT.get(agent.slug)?.has(key))
}

/** 批量：skillId → 数字员工列表 */
export const mapSkillOwners = (skills = []) => {
  const result = new Map()
  for (const skill of skills) {
    result.set(skill.id, agentsUsing(skill))
  }
  return result
}
