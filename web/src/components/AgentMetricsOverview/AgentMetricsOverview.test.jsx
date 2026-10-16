import { fireEvent, render, screen } from '@cedarjs/testing/web'

import AgentMetricsOverview, { formatTokenCount } from './AgentMetricsOverview'

const agent = {
  id: 'software-engineer',
  slug: 'software-engineer-agent',
  name: '软件工程师',
  group: '工程交付',
  icon: '⌘',
  color: '#4c78c8',
  joinedAt: '2026-09-04',
}

describe('AgentMetricsOverview', () => {
  it('展示团队总量和员工真实统计', () => {
    render(
      <AgentMetricsOverview
        agents={[agent]}
        totalAgents={27}
        overview={{
          totalWorkCount: 4,
          totalTaskCount: 4,
          trackedWorkCount: 2,
          totalTokens: 12600,
          totalTokenCoverage: 'PARTIAL',
          agents: [
            {
              agent: agent.slug,
              workCount: 4,
              trackedWorkCount: 2,
              inputTokens: 10000,
              outputTokens: 2600,
              cachedTokens: 4000,
              totalTokens: 12600,
              inputTokenCoverage: 'COMPLETE',
              outputTokenCoverage: 'COMPLETE',
              cachedTokenCoverage: 'PARTIAL',
              totalTokenCoverage: 'COMPLETE',
              latestModelId: 'gpt-6.1-sol',
            },
          ],
        }}
        runtimeStateFor={() => ({ label: '工作中', tone: 'working' })}
        onSelectAgent={jest.fn()}
      />
    )

    expect(screen.getByText('50%')).toBeVisible()
    expect(screen.getByText('1.3万（部分）')).toBeVisible()
    expect(screen.getByText('1.3万')).toBeVisible()
    expect(screen.getByText(/缓存 4000（部分）/)).toBeVisible()
    expect(screen.getByText('gpt-6.1-sol')).toBeVisible()
    expect(screen.getByText('2026年9月4日')).toBeVisible()
  })

  it('未采集 Token 时保持未知而不是显示为零', () => {
    expect(formatTokenCount(0, 'NONE')).toBe('未采集')
    expect(formatTokenCount(0, 'COMPLETE')).toBe('0')
    expect(formatTokenCount(1200, 'PARTIAL')).toBe('1200（部分）')
  })

  it('点击员工时打开对应详情', () => {
    const onSelectAgent = jest.fn()
    render(
      <AgentMetricsOverview
        agents={[agent]}
        totalAgents={1}
        overview={{
          totalWorkCount: 0,
          totalTaskCount: 0,
          trackedWorkCount: 0,
          agents: [],
        }}
        runtimeStateFor={() => ({ label: '空闲', tone: 'idle' })}
        onSelectAgent={onSelectAgent}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /软件工程师/ }))
    expect(onSelectAgent).toHaveBeenCalledWith(agent)
  })

  it('切换时间范围时回传预设和自定义日期', () => {
    const onRangeChange = jest.fn()
    render(
      <AgentMetricsOverview
        agents={[agent]}
        totalAgents={1}
        overview={{
          totalWorkCount: 0,
          totalTaskCount: 0,
          trackedWorkCount: 0,
          agents: [],
        }}
        runtimeStateFor={() => ({ label: '空闲', tone: 'idle' })}
        onSelectAgent={jest.fn()}
        onRangeChange={onRangeChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '7天' }))
    fireEvent.click(screen.getByRole('button', { name: '自定义' }))
    expect(onRangeChange).toHaveBeenLastCalledWith({
      preset: 'custom',
      customRange: { from: '', to: '' },
    })
  })
})
