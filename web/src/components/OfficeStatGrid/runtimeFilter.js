// 团队总览的状态筛选：把运行状态（tone）映射为可筛选的维度。
// 纯逻辑放在这里，方便 HomePage 与单元测试复用。

export const RUNTIME_FILTER_KEYS = ['all', 'working', 'waiting', 'idle']

export const RUNTIME_FILTERS = [
  { key: 'all', label: '员工总数', statKey: 'total' },
  { key: 'working', label: '工作中', statKey: 'working' },
  { key: 'waiting', label: '待确认', statKey: 'waiting' },
  { key: 'idle', label: '空闲', statKey: 'idle' },
]

export const RUNTIME_FILTER_LABELS = RUNTIME_FILTERS.reduce(
  (labels, filter) => ({ ...labels, [filter.key]: filter.label }),
  {}
)

export const isRuntimeFilterKey = (key) => RUNTIME_FILTER_KEYS.includes(key)

export function matchesRuntimeFilter(runtimeState, filter) {
  if (!filter || filter === 'all') return true
  return runtimeState?.tone === filter
}

export function filterAgentsByRuntime(
  agents = [],
  filter = 'all',
  runtimeStateFor
) {
  if (!filter || filter === 'all') return agents
  const getRuntimeState =
    typeof runtimeStateFor === 'function'
      ? runtimeStateFor
      : (agent) => agent.runtimeState
  return agents.filter((agent) =>
    matchesRuntimeFilter(getRuntimeState(agent), filter)
  )
}
