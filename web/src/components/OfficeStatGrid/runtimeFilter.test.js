import {
  RUNTIME_FILTER_LABELS,
  filterAgentsByRuntime,
  isRuntimeFilterKey,
  matchesRuntimeFilter,
} from './runtimeFilter'

const runtimeStates = {
  main: { label: '工作中', tone: 'working', task: { title: '实现筛选' } },
  designer: { label: '待确认', tone: 'waiting', task: { title: '确认稿' } },
  researcher: { label: '空闲', tone: 'idle', task: null },
  syncing: { label: '同步中', tone: 'syncing', task: null },
}

const agents = [
  { id: 'main', runtimeState: runtimeStates.main },
  { id: 'designer', runtimeState: runtimeStates.designer },
  { id: 'researcher', runtimeState: runtimeStates.researcher },
  { id: 'syncing', runtimeState: runtimeStates.syncing },
]

const runtimeStateFor = (agent) => agent.runtimeState
const idsFor = (filter) =>
  filterAgentsByRuntime(agents, filter, runtimeStateFor).map(
    (agent) => agent.id
  )

describe('runtimeFilter', () => {
  it('all 返回全部员工（同一数组，不做拷贝）', () => {
    expect(filterAgentsByRuntime(agents, 'all', runtimeStateFor)).toBe(agents)
    expect(filterAgentsByRuntime(agents, undefined, runtimeStateFor)).toBe(
      agents
    )
  })

  it('按 working / waiting / idle 过滤', () => {
    expect(idsFor('working')).toEqual(['main'])
    expect(idsFor('waiting')).toEqual(['designer'])
    expect(idsFor('idle')).toEqual(['researcher'])
  })

  it('syncing / unknown 等状态不会命中三个筛选', () => {
    expect(idsFor('working')).not.toContain('syncing')
    expect(idsFor('waiting')).not.toContain('syncing')
    expect(idsFor('idle')).not.toContain('syncing')
  })

  it('matchesRuntimeFilter 对空状态安全', () => {
    expect(matchesRuntimeFilter(undefined, 'all')).toBe(true)
    expect(matchesRuntimeFilter(undefined, 'working')).toBe(false)
    expect(matchesRuntimeFilter({ tone: 'working' }, 'working')).toBe(true)
    expect(matchesRuntimeFilter({ tone: 'working' }, 'idle')).toBe(false)
  })

  it('不传 runtimeStateFor 时回退读取 agent.runtimeState', () => {
    expect(filterAgentsByRuntime(agents, 'waiting').map((a) => a.id)).toEqual([
      'designer',
    ])
  })

  it('空列表 / 空筛选参数安全', () => {
    expect(filterAgentsByRuntime([], 'working', runtimeStateFor)).toEqual([])
    expect(filterAgentsByRuntime()).toEqual([])
  })

  it('暴露展示文案与合法 key 判断', () => {
    expect(RUNTIME_FILTER_LABELS).toEqual({
      all: '员工总数',
      working: '工作中',
      waiting: '待确认',
      idle: '空闲',
    })
    expect(isRuntimeFilterKey('working')).toBe(true)
    expect(isRuntimeFilterKey('syncing')).toBe(false)
  })
})
