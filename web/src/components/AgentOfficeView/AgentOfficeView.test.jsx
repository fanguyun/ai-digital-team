import { fireEvent, render, screen, within } from '@cedarjs/testing/web'

import AgentOfficeView from './AgentOfficeView'

const agents = [
  {
    id: 'main',
    slug: 'main-agent',
    name: '数字总经理',
    en: 'Main Agent',
    role: '负责团队路由与结果整合',
    group: '管理中枢',
    icon: 'M',
    color: '#6e62d9',
  },
  {
    id: 'designer',
    slug: 'interaction-ui-designer-agent',
    name: '交互 UI 设计师',
    en: 'Interaction UI Designer',
    role: '负责页面设计与交互验证',
    group: '设计体验',
    icon: 'D',
    color: '#2e938a',
  },
  {
    id: 'researcher',
    slug: 'user-research-agent',
    name: '用户研究员',
    en: 'User Researcher',
    role: '负责用户研究与需求证据',
    group: '设计体验',
    icon: 'R',
    color: '#2e938a',
  },
]

const states = {
  main: { label: '空闲', tone: 'idle', task: null },
  designer: {
    label: '工作中',
    tone: 'working',
    task: {
      title: '实现数字办公室员工状态面板',
      currentStage: 'VERIFICATION',
    },
  },
  researcher: {
    label: '待确认',
    tone: 'waiting',
    task: { title: '确认访谈提纲', currentStage: 'PLANNING' },
  },
}

describe('AgentOfficeView', () => {
  it('按部门展示员工、状态和当前任务', () => {
    const { container } = render(
      <AgentOfficeView
        agents={agents}
        groups={['管理中枢', '设计体验']}
        runtimeStateFor={(agent) => states[agent.id]}
        selectedId="designer"
        onSelectAgent={jest.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: '管理中枢' })).toBeVisible()
    const designRoom = screen
      .getByRole('heading', { name: '设计体验' })
      .closest('section')

    expect(within(designRoom).getByText('1 工作中')).toBeVisible()
    expect(within(designRoom).getByText('1 待确认')).toBeVisible()
    expect(screen.getByText('实现数字办公室员工状态面板')).toBeVisible()
    expect(screen.getByText('验证确认')).toBeVisible()
    expect(screen.queryByText('当前无活跃任务')).not.toBeInTheDocument()
    expect(screen.queryByText('负责团队路由与结果整合')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.desk-task')).toHaveLength(agents.length)
    expect(container.querySelectorAll('.desk-task.placeholder')).toHaveLength(1)
    expect(container.querySelector('.monitor-status')).not.toBeInTheDocument()
    expect(container.querySelector('.employee-avatar')).not.toBeInTheDocument()
    expect(container.querySelector('.desk-illustration')).toBeInTheDocument()
    expect(
      container.querySelector('.office-desk.working .desk-status b')
    ).toHaveTextContent('工作中')
    expect(container.querySelectorAll('.desk-work-motion')).toHaveLength(1)
    expect(
      container.querySelector('.office-desk.working .desk-work-motion')
    ).toBeInTheDocument()
  })

  it('点击工位时返回对应员工', () => {
    const onSelectAgent = jest.fn()
    render(
      <AgentOfficeView
        agents={agents}
        groups={['管理中枢', '设计体验']}
        runtimeStateFor={(agent) => states[agent.id]}
        selectedId="main"
        onSelectAgent={onSelectAgent}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: '交互 UI 设计师，负责页面设计与交互验证，工作中',
      })
    )

    expect(onSelectAgent).toHaveBeenCalledWith(agents[1])
  })

  it('在工位展示五种运行状态', () => {
    const statusAgents = [
      ['idle', '空闲', 'idle'],
      ['working', '工作中', 'working'],
      ['waiting', '待确认', 'waiting'],
      ['syncing', '同步中', 'syncing'],
      ['unknown', '状态未知', 'unknown'],
    ].map(([id, label, tone]) => ({
      ...agents[0],
      id,
      slug: `${id}-agent`,
      name: label,
      group: '管理中枢',
      runtimeState: { label, tone, task: null },
    }))

    const { container } = render(
      <AgentOfficeView
        agents={statusAgents}
        groups={['管理中枢']}
        runtimeStateFor={(agent) => agent.runtimeState}
        selectedId="idle"
        onSelectAgent={jest.fn()}
      />
    )

    expect(
      [...container.querySelectorAll('.desk-status b')].map(
        (element) => element.textContent
      )
    ).toEqual(['空闲', '工作中', '待确认', '同步中', '状态未知'])
    expect(container.querySelector('.desk-monitor')).not.toBeInTheDocument()
  })

  it('用对应场景插画替换手绘员工和工位', () => {
    const departments = [
      ['管理中枢', 'main-agent', 'team-work'],
      ['产品策略', 'business-strategy-agent', 'data'],
      ['设计体验', 'interaction-ui-designer-agent', 'prototyping-process'],
      ['工程交付', 'software-engineer-agent', 'pair-programming'],
      ['增长经营', 'content-brand-agent', 'marketing-consulting'],
      ['后台支持', 'project-manager-agent', 'time-management'],
      ['个人财富', 'investment-advisor-agent', 'investing'],
      ['个人成长', 'family-parenting-agent', 'family'],
    ]
    const departmentAgents = departments.map(([group, slug], index) => ({
      ...agents[0],
      id: `agent-${index}`,
      slug,
      name: group,
      group,
    }))

    const { container } = render(
      <AgentOfficeView
        agents={departmentAgents}
        groups={departments.map(([group]) => group)}
        runtimeStateFor={() => states.main}
        selectedId="agent-0"
        onSelectAgent={jest.fn()}
      />
    )

    expect(
      [...container.querySelectorAll('.desk-illustration')].map((element) =>
        element.getAttribute('data-scene')
      )
    ).toEqual(departments.map(([, , scene]) => scene))
    expect(container.querySelector('.desk-keyboard')).not.toBeInTheDocument()
    expect(container.querySelector('.desk-chair')).not.toBeInTheDocument()
  })
})
