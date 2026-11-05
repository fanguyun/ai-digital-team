import { agentsUsing, mapSkillOwners, skillKey } from './skillOwners'

const skill = (overrides) => ({
  id: overrides.id || `技能库:${overrides.name}`,
  name: overrides.name,
  path: overrides.path || `/home/user/.skills-manager/skills/${overrides.name}`,
  description: '',
})

describe('skillOwners', () => {
  it('用目录名匹配 manifest 里引用的技能', () => {
    expect(skillKey(skill({ name: 'base-guidelines' }))).toBe('base-guidelines')
    expect(
      skillKey(
        skill({ name: '显示名', path: '/x/.skills-manager/skills/xlsx/' })
      )
    ).toBe('xlsx')
  })

  it('返回引用了该技能的数字员工', () => {
    const owners = agentsUsing(skill({ name: 'xlsx' }))

    expect(owners.length).toBeGreaterThan(1)
    expect(owners.map((agent) => agent.name)).toContain('财务与行政')
    expect(
      owners.every((agent) => agent.slug && agent.name && agent.color)
    ).toBe(true)
  })

  it('未被任何岗位引用的技能返回空数组', () => {
    expect(agentsUsing(skill({ name: 'zzz-not-referenced-skill' }))).toEqual([])
    expect(agentsUsing(null)).toEqual([])
  })

  it('mapSkillOwners 返回每个技能对应的岗位列表', () => {
    const skills = [
      skill({ id: 'a', name: 'xlsx' }),
      skill({ id: 'b', name: 'zzz-not-referenced-skill' }),
    ]
    const owners = mapSkillOwners(skills)

    expect(owners.get('a').map((agent) => agent.name)).toContain('财务与行政')
    expect(owners.get('b')).toEqual([])
  })
})
