import {
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { existsSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  bindSkill,
  planAgentFixes,
  skillBindingState,
  findInstalledSkill,
} from './skillBinding'

let repoRoot: string
let sharedRoot: string

const makeSkill = (root: string, name: string) => {
  const dir = path.join(root, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'SKILL.md'), `# ${name}\n`)
  return dir
}

beforeEach(() => {
  repoRoot = mkdtempSync(path.join(tmpdir(), 'skill-bind-repo-'))
  sharedRoot = mkdtempSync(path.join(tmpdir(), 'skill-bind-shared-'))
})

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true })
  rmSync(sharedRoot, { recursive: true, force: true })
})

describe('skill binding', () => {
  it('finds an installed skill and reports it as unbound', () => {
    const installed = makeSkill(sharedRoot, 'writing-plans')

    expect(findInstalledSkill('writing-plans', [sharedRoot])?.dir).toBe(
      installed
    )

    const state = skillBindingState(repoRoot, 'main-agent', 'writing-plans')
    expect(state.state).toBe('missing')
  })

  it('links an installed skill into the agent directory', () => {
    const installed = makeSkill(sharedRoot, 'writing-plans')

    const result = bindSkill({
      repoRoot,
      agentSlug: 'main-agent',
      skill: 'writing-plans',
      roots: [sharedRoot],
    })

    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)

    const linkPath = path.join(
      repoRoot,
      'agents/main-agent/.agents/skills/writing-plans'
    )
    expect(existsSync(path.join(linkPath, 'SKILL.md'))).toBe(true)
    expect(readlinkSync(linkPath)).toBe(installed)

    const again = bindSkill({
      repoRoot,
      agentSlug: 'main-agent',
      skill: 'writing-plans',
      roots: [sharedRoot],
    })
    expect(again.ok).toBe(true)
    expect(again.changed).toBe(false)
  })

  it('replaces a broken link with a working one', () => {
    const installed = makeSkill(sharedRoot, 'writing-for-agents')
    const linkPath = path.join(
      repoRoot,
      'agents/role-development-agent/.agents/skills/writing-for-agents'
    )
    mkdirSync(path.dirname(linkPath), { recursive: true })
    symlinkSync(path.join(sharedRoot, 'gone'), linkPath, 'dir')

    expect(
      skillBindingState(
        repoRoot,
        'role-development-agent',
        'writing-for-agents'
      ).state
    ).toBe('broken')

    const result = bindSkill({
      repoRoot,
      agentSlug: 'role-development-agent',
      skill: 'writing-for-agents',
      roots: [sharedRoot],
    })

    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)
    expect(readlinkSync(linkPath)).toBe(installed)
  })

  it('refuses to bind a skill that is not installed', () => {
    const result = bindSkill({
      repoRoot,
      agentSlug: 'main-agent',
      skill: 'missing-skill',
      roots: [sharedRoot],
    })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('没有找到可用的')
  })
})

describe('planAgentFixes', () => {
  it('separates auto-fixable bindings from skills that need installation', () => {
    makeSkill(sharedRoot, 'writing-plans')

    const items = planAgentFixes({
      repoRoot,
      agentSlug: 'main-agent',
      requiredSkills: ['writing-plans', 'not-installed'],
      optionalSkills: [],
      requiredTools: ['definitely-not-a-command-xyz'],
      roots: [sharedRoot],
      toolAvailable: () => false,
    })

    const binding = items.find((item) => item.kind === 'skill-binding')
    expect(binding?.canApply).toBe(true)
    expect(binding?.severity).toBe('required')
    expect(binding?.steps.length).toBeGreaterThan(1)

    const missing = items.find((item) => item.kind === 'skill-missing')
    expect(missing?.canApply).toBe(false)
    expect(missing?.blockedReason).toContain('尚未安装')

    const tool = items.find((item) => item.kind === 'tool-missing')
    expect(tool?.canApply).toBe(false)
  })

  it('returns nothing for an agent whose skills are all bound', () => {
    makeSkill(sharedRoot, 'base-guidelines')
    bindSkill({
      repoRoot,
      agentSlug: 'main-agent',
      skill: 'base-guidelines',
      roots: [sharedRoot],
    })

    const items = planAgentFixes({
      repoRoot,
      agentSlug: 'main-agent',
      requiredSkills: ['base-guidelines'],
      optionalSkills: [],
      requiredTools: [],
      roots: [sharedRoot],
      toolAvailable: () => true,
    })
    expect(items).toEqual([])
  })
})
