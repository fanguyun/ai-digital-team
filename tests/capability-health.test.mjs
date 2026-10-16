import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  buildAgentCapabilityStatus,
  findSkill,
  validateCapabilityRequirements,
} from '../scripts/capability-health.mjs'

function createSkill(root, name) {
  const directory = join(root, name)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: test\n---\n`)
}

test('findSkill 按根目录顺序返回首个存在的 Skill', () => {
  const root = mkdtempSync(join(tmpdir(), 'capability-skill-'))
  const first = join(root, 'first')
  const second = join(root, 'second')
  createSkill(second, 'research')

  assert.deepEqual(findSkill('research', [first, second]), {
    available: true,
    root: second,
    path: join(second, 'research', 'SKILL.md'),
  })
})

test('岗位 Skill 已安装且必需能力齐全时状态为 complete', () => {
  const status = buildAgentCapabilityStatus({
    agentInstalled: true,
    requiredSkills: [{ name: 'research', available: true }],
    optionalSkills: [{ name: 'xlsx', available: false }],
    requiredTools: [{ name: 'node', available: true }],
  })

  assert.equal(status.status, 'complete')
  assert.deepEqual(status.missingRequiredSkills, [])
  assert.deepEqual(status.missingOptionalSkills, ['xlsx'])
})

test('岗位存在但缺少必需 Skill 时状态为 partial', () => {
  const status = buildAgentCapabilityStatus({
    agentInstalled: true,
    requiredSkills: [{ name: 'research', available: false }],
    optionalSkills: [],
    requiredTools: [{ name: 'node', available: false }],
  })

  assert.equal(status.status, 'partial')
  assert.deepEqual(status.missingRequiredSkills, ['research'])
  assert.deepEqual(status.missingRequiredTools, ['node'])
})

test('岗位 Skill 本身不存在时状态为 not-installed', () => {
  const status = buildAgentCapabilityStatus({
    agentInstalled: false,
    requiredSkills: [],
    optionalSkills: [],
    requiredTools: [],
  })

  assert.equal(status.status, 'not-installed')
})

test('能力声明拒绝必需与可选 Skill 重复', () => {
  const issues = validateCapabilityRequirements({
    requiredSkills: ['research'],
    optionalSkills: ['research'],
    requiredTools: [],
    platforms: ['codex', 'deepseek-harness'],
  })

  assert(issues.some((issue) => issue.includes('同时声明为必需和可选')))
})
