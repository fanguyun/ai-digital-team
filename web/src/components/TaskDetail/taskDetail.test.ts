import {
  formatTokenValue,
  summarizeTaskTokens,
  taskParticipants,
  taskSkills,
} from './taskDetailData'

describe('task detail helpers', () => {
  const events = [
    {
      agent: 'software-engineer-agent',
      skills: ['base-guidelines', 'react-expert'],
      inputTokens: 120,
      outputTokens: 30,
      cachedTokens: 60,
    },
    {
      agent: 'qa-security-engineer-agent',
      skills: ['base-guidelines'],
      inputTokens: 80,
      outputTokens: null,
      cachedTokens: null,
    },
  ]

  it('聚合岗位和 Skill 时保持首次出现顺序并去重', () => {
    expect(taskParticipants('software-engineer-agent', events)).toEqual([
      'software-engineer-agent',
      'qa-security-engineer-agent',
    ])
    expect(taskSkills(events)).toEqual(['base-guidelines', 'react-expert'])
  })

  it('Token 缺失时标记部分覆盖而不是补零', () => {
    const summary = summarizeTaskTokens(events)
    expect(summary.input).toEqual({ value: 200, coverage: 'COMPLETE' })
    expect(summary.output).toEqual({ value: 30, coverage: 'PARTIAL' })
    expect(summary.cached).toEqual({ value: 60, coverage: 'PARTIAL' })
    expect(summary.total).toEqual({ value: 230, coverage: 'PARTIAL' })
    expect(formatTokenValue(230, summary.total.coverage)).toBe('230（部分）')
  })

  it('完全没有 Token 时显示未采集', () => {
    const summary = summarizeTaskTokens([
      {},
    ])
    expect(formatTokenValue(summary.total.value, summary.total.coverage)).toBe(
      '未采集'
    )
  })
})
