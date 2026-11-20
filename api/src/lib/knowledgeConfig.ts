export type KnowledgeMode = 'optional' | 'required'

export type KnowledgeConfig = {
  enabled: boolean
  mode: KnowledgeMode
  url?: string
  token?: string
  timeoutMs?: number
}

/** 只从部署环境读取；岗位名单是试点开关，不是资料访问权限。 */
export const knowledgeConfig = (
  agentSlug: string,
  env: NodeJS.ProcessEnv = process.env
): KnowledgeConfig => {
  if (!env.KNOWLEDGE_ENABLED || env.KNOWLEDGE_ENABLED === '0') {
    return { enabled: false, mode: 'optional' }
  }
  if (env.KNOWLEDGE_ENABLED !== '1') throw new Error('invalid config')
  const mode = env.KNOWLEDGE_MODE || 'optional'
  if (mode !== 'optional' && mode !== 'required')
    throw new Error('invalid config')
  const agents = (env.KNOWLEDGE_AGENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!agents.length || agents.some((s) => !/^[a-z][a-z0-9-]+$/.test(s))) {
    throw new Error('invalid config')
  }
  if (!agents.includes(agentSlug)) return { enabled: false, mode }
  const url = new URL(env.KNOWLEDGE_BRIDGE_URL || '')
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  )
    throw new Error('invalid config')
  const token = env.KNOWLEDGE_BRIDGE_TOKEN || ''
  if (token.length < 32 || token.length > 512 || /\s/.test(token))
    throw new Error('invalid config')
  const timeoutMs = Number(env.KNOWLEDGE_TIMEOUT_MS || 4000)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 4000)
    throw new Error('invalid config')
  return { enabled: true, mode, url: url.origin, token, timeoutMs }
}
