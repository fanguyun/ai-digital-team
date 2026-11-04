import { RUNTIME_FILTERS } from './runtimeFilter'

const toneClassKeys = new Set(['working', 'waiting', 'idle'])

const ariaLabelFor = ({ key, label }, count, active) => {
  const target =
    key === 'all'
      ? '全部员工'
      : key === 'working'
        ? '工作中员工'
        : `${label}员工`
  const suffix =
    key === 'all'
      ? '点击恢复显示全部员工'
      : active
        ? '点击取消该筛选'
        : `点击只显示${target}`
  return `筛选${target}，共 ${count} 人（${suffix}）`
}

export function OfficeStatGrid({ stats = {}, active = 'all', onSelect }) {
  return (
    <div className="office-stat-grid" role="group" aria-label="团队状态统计">
      {RUNTIME_FILTERS.map((filter) => {
        const { key, label, statKey } = filter
        const count = stats[statKey] ?? 0
        const isActive = active === key
        const className = [
          toneClassKeys.has(key) ? key : null,
          isActive ? 'active' : null,
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={key}
            type="button"
            className={className || undefined}
            data-runtime-filter={key}
            aria-pressed={isActive}
            aria-label={ariaLabelFor(filter, count, isActive)}
            title={
              key === 'all'
                ? '显示全部员工'
                : isActive
                  ? `取消“${label}”筛选，显示全部员工`
                  : `点击只显示${label}的员工`
            }
            onClick={() => onSelect?.(key)}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        )
      })}
    </div>
  )
}

export default OfficeStatGrid
