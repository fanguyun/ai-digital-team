import {
  CATEGORY_ALL,
  CATEGORY_OTHER,
  CATEGORY_PLATFORM,
  buildTabs,
  categoryOf,
  mapCategories,
} from './skillCategories'

const skill = (overrides) => ({
  id: overrides.id || `用户:${overrides.name}`,
  name: overrides.name,
  description: overrides.description || '',
  source: overrides.source || '用户',
  path: overrides.path || `/home/user/.codex/skills/${overrides.name}`,
  tags: [],
})

describe('skillCategories', () => {
  it('岗位技能按 manifest 分组归类', () => {
    expect(
      categoryOf(
        skill({
          name: 'software-engineer-agent',
          source: '插件',
          path: '/home/user/.codex/plugins/cache/personal-digital-team/software-engineer-agent',
        })
      )
    ).toBe('工程交付')

    expect(
      categoryOf(
        skill({
          name: 'finance-operations-agent',
          source: '插件',
          path: '/home/user/.codex/plugins/cache/personal-digital-team/finance-operations-agent',
        })
      )
    ).toBe('后台支持')
  })

  it('按关键词归类常见技能', () => {
    expect(categoryOf(skill({ name: 'figma-implement-design' }))).toBe(
      '设计体验'
    )
    expect(categoryOf(skill({ name: 'copywriting' }))).toBe('增长经营')
    expect(categoryOf(skill({ name: 'dca-strategy' }))).toBe('个人财富')
    expect(categoryOf(skill({ name: 'learning-mentor' }))).toBe('个人成长')
    expect(categoryOf(skill({ name: 'postgres-pro' }))).toBe('工程交付')
    expect(categoryOf(skill({ name: 'stripe' }))).toBe('平台与工具')
  })

  it('短关键词按词边界匹配，不会误命中', () => {
    // "ui" 不应命中 "build"，"go" 不应命中 "google"
    expect(categoryOf(skill({ name: 'build-tools' }))).not.toBe('设计体验')
    expect(categoryOf(skill({ name: 'google-analytics' }))).not.toBe('工程交付')
  })

  it('技能库来源不再参与归组，关键词命中平台类，未知技能落其他', () => {
    expect(categoryOf(skill({ name: 'imagegen', source: '技能库' }))).toBe(
      CATEGORY_PLATFORM
    )
    expect(categoryOf(skill({ name: 'zzz-unknown-skill' }))).toBe(
      CATEGORY_OTHER
    )
  })

  it('mapCategories 与 categoryOf 结果一致', () => {
    const skills = [
      skill({ id: 'a', name: 'copywriting' }),
      skill({ id: 'b', name: 'dca-strategy' }),
    ]
    const map = mapCategories(skills)

    expect([...map.entries()]).toEqual([
      ['a', '增长经营'],
      ['b', '个人财富'],
    ])
  })

  it('buildTabs 以全部开头、以其他结尾，只保留有内容的分类', () => {
    const skills = [
      skill({ id: '1', name: 'copywriting' }),
      skill({ id: '2', name: 'postgres-pro' }),
      skill({ id: '3', name: 'zzz-unknown-skill' }),
    ]
    const tabs = buildTabs(skills)

    expect(tabs[0].key).toBe(CATEGORY_ALL)
    expect(tabs[0].count).toBe(3)
    expect(tabs.at(-1).key).toBe(CATEGORY_OTHER)
    expect(tabs.map((tab) => tab.key)).not.toContain('个人财富')
    expect(tabs.find((tab) => tab.key === '工程交付').count).toBe(1)

    const total = tabs
      .filter((tab) => tab.key !== CATEGORY_ALL)
      .reduce((sum, tab) => sum + tab.count, 0)
    expect(total).toBe(3)
  })
})
