/**
 * Normalize one team manifest into the shape the panel renders.
 *
 * The manifest in `agents/manifest.json` is the single source of truth for the
 * team. Only fields the panel displays are kept, so a future manifest can grow
 * without leaking unreviewed data into the browser payload.
 */

const STRING_FIELDS = [
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
  'joinedAt',
]

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback
}

function stringList(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeAgent(agent) {
  if (agent === null || typeof agent !== 'object') return null
  const slug = text(agent.slug)
  if (slug === '') return null

  const normalized = {}
  for (const field of STRING_FIELDS) normalized[field] = text(agent[field])
  normalized.slug = slug
  normalized.id = normalized.id || slug
  normalized.name = normalized.name || slug
  normalized.group = normalized.group || '其他'
  normalized.skills = stringList(agent.skills)

  const requirements = agent.capabilityRequirements
  if (requirements !== null && typeof requirements === 'object') {
    normalized.capabilityRequirements = {
      requiredSkills: stringList(requirements.requiredSkills),
      optionalSkills: stringList(requirements.optionalSkills),
      requiredTools: stringList(requirements.requiredTools),
      platforms: stringList(requirements.platforms),
    }
  }

  return normalized
}

function normalizeRoute(route) {
  if (route === null || typeof route !== 'object') return null
  const scenario = text(route.scenario)
  const primary = text(route.primary)
  if (scenario === '' && primary === '') return null
  return {
    id: text(route.id),
    scenario,
    primary,
    collaborators: stringList(route.collaborators),
    chooseWhen: text(route.chooseWhen),
    boundary: text(route.boundary),
    handoff: text(route.handoff),
  }
}

export function normalizeTeam(manifest) {
  if (manifest === null || typeof manifest !== 'object') {
    throw new Error('team manifest must be an object')
  }
  if (!Array.isArray(manifest.agents)) {
    throw new Error('team manifest has no agents array')
  }

  const agents = manifest.agents.map(normalizeAgent).filter(Boolean)
  if (agents.length === 0) throw new Error('team manifest has no valid agents')

  const declaredGroups = stringList(manifest.groups)
  const groups = [...declaredGroups]
  for (const agent of agents) {
    if (!groups.includes(agent.group)) groups.push(agent.group)
  }

  const routingMatrix = Array.isArray(manifest.routingMatrix)
    ? manifest.routingMatrix.map(normalizeRoute).filter(Boolean)
    : []

  return {
    schemaVersion: Number.isInteger(manifest.schemaVersion)
      ? manifest.schemaVersion
      : 0,
    groups,
    agents,
    routingMatrix,
  }
}
