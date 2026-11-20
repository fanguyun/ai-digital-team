import { knowledgeConfig } from './knowledgeConfig'

const env = {
  KNOWLEDGE_ENABLED: '1',
  KNOWLEDGE_MODE: 'required',
  KNOWLEDGE_AGENTS: 'main-agent,software-engineer-agent',
  KNOWLEDGE_BRIDGE_URL: 'http://nas.local:8787',
  KNOWLEDGE_BRIDGE_TOKEN: 't'.repeat(32),
}
describe('knowledgeConfig', () => {
  it('is disabled with no configuration', () => {
    expect(knowledgeConfig('main-agent', {})).toEqual({
      enabled: false,
      mode: 'optional',
    })
    expect(
      knowledgeConfig('main-agent', {
        KNOWLEDGE_ENABLED: '0',
        KNOWLEDGE_MODE: 'typo',
      }).enabled
    ).toBe(false)
  })
  it('only enables explicitly selected roles', () => {
    expect(knowledgeConfig('main-agent', env)).toMatchObject({
      enabled: true,
      mode: 'required',
      timeoutMs: 4000,
    })
    expect(knowledgeConfig('finance-operations-agent', env).enabled).toBe(false)
  })
  it.each([
    { KNOWLEDGE_ENABLED: 'yes' },
    { KNOWLEDGE_MODE: 'typo' },
    { KNOWLEDGE_AGENTS: '' },
    { KNOWLEDGE_BRIDGE_URL: 'file:///tmp/source' },
    { KNOWLEDGE_BRIDGE_URL: 'https://user:pass@nas.local' },
    { KNOWLEDGE_BRIDGE_URL: 'http://nas.local/path' },
    { KNOWLEDGE_BRIDGE_URL: 'http://nas.local/?token=x' },
    { KNOWLEDGE_BRIDGE_TOKEN: 'short' },
    { KNOWLEDGE_TIMEOUT_MS: '4001' },
  ])('rejects unsafe or invalid configuration %j', (patch) => {
    expect(() => knowledgeConfig('main-agent', { ...env, ...patch })).toThrow()
  })
})
