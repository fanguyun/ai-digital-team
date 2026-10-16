import { DatePicker } from 'antd'
import dayjs from 'dayjs'

import { METRICS_RANGE_PRESETS } from './metricsTimeRange'

const compactNumber = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const integerNumber = new Intl.NumberFormat('zh-CN')

export const formatTokenCount = (
  value,
  coverage = value == null ? 'NONE' : 'COMPLETE'
) => {
  if (coverage === 'NONE') return '未采集'

  const formatted = compactNumber.format(value || 0)
  return coverage === 'PARTIAL' ? `${formatted}（部分）` : formatted
}

export const formatJoinedAt = (value) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(`${value}T00:00:00`))
    : '未记录'

const AgentMetricsOverview = ({
  agents,
  totalAgents,
  overview,
  runtimeStateFor,
  loading,
  error,
  onSelectAgent,
  rangePreset = 'all',
  customRange = { from: '', to: '' },
  rangeError = '',
  rangeHint = '',
  onRangeChange,
}) => {
  const metricsByAgent = new Map(
    (overview?.agents || []).map((metric) => [metric.agent, metric])
  )
  const coverage = overview?.totalTaskCount
    ? Math.min(
        100,
        Math.round(
          ((overview.trackedWorkCount || 0) / overview.totalTaskCount) * 100
        )
      )
    : 0
  const ranged = rangePreset !== 'all'

  return (
    <section className="agent-metrics-overview" aria-label="员工数据总览">
      <div className="metrics-range" role="group" aria-label="统计时间">
        {METRICS_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={rangePreset === preset.id ? 'active' : undefined}
            aria-pressed={rangePreset === preset.id}
            onClick={() => onRangeChange?.({ preset: preset.id, customRange })}
          >
            {preset.label}
          </button>
        ))}
        {rangePreset === 'custom' && (
          <DatePicker.RangePicker
            aria-label="自定义日期"
            placeholder={['开始日期', '结束日期']}
            value={[
              customRange.from ? dayjs(customRange.from) : null,
              customRange.to ? dayjs(customRange.to) : null,
            ]}
            onChange={(dates) =>
              onRangeChange?.({
                preset: 'custom',
                customRange: {
                  from: dates?.[0] ? dates[0].format('YYYY-MM-DD') : '',
                  to: dates?.[1] ? dates[1].format('YYYY-MM-DD') : '',
                },
              })
            }
          />
        )}
      </div>
      {rangeError && <div className="metrics-notice error">{rangeError}</div>}
      {!rangeError && rangeHint && (
        <div className="metrics-notice">{rangeHint}</div>
      )}
      <div className="metrics-summary-grid">
        <div>
          <span>员工总数</span>
          <strong>{totalAgents}</strong>
          <small>当前团队清单</small>
        </div>
        <div>
          <span>累计主责工作次数</span>
          <strong>{integerNumber.format(overview?.totalWorkCount || 0)}</strong>
          <small>
            {ranged ? '所选时间内开始，不含已取消' : '不含已取消任务'}
          </small>
        </div>
        <div className="token-total">
          <span>总 Token 消耗</span>
          <strong>
            {formatTokenCount(
              overview?.totalTokens,
              overview?.totalTokenCoverage
            )}
          </strong>
          <small>
            {ranged ? '所选时间内上报的输入与输出' : '输入与输出 Token 合计'}
          </small>
        </div>
        <div>
          <span>Token 数据覆盖</span>
          <strong>{overview?.totalTaskCount ? `${coverage}%` : '—'}</strong>
          <small>
            {overview?.trackedWorkCount || 0}/{overview?.totalTaskCount || 0}{' '}
            个任务已采集
          </small>
        </div>
      </div>

      {loading && !overview && (
        <div className="metrics-notice">正在同步员工统计数据…</div>
      )}
      {error && !overview && (
        <div className="metrics-notice error">
          暂时无法读取统计数据，请检查任务运行时连接。
        </div>
      )}

      <div className="metrics-table-wrap">
        <table className="agent-metrics-table">
          <thead>
            <tr>
              <th>员工</th>
              <th>当前状态</th>
              <th>主责工作次数</th>
              <th>Token 消耗</th>
              <th>最近模型</th>
              <th>入职时间</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const metric = metricsByAgent.get(agent.slug)
              const runtimeState = runtimeStateFor(agent)
              return (
                <tr key={agent.id}>
                  <td>
                    <button
                      type="button"
                      className="metrics-agent"
                      onClick={() => onSelectAgent(agent)}
                    >
                      <span
                        className="metrics-agent-icon"
                        style={{
                          color: agent.color,
                          background: `${agent.color}14`,
                        }}
                      >
                        {agent.icon}
                      </span>
                      <span>
                        <strong>{agent.name}</strong>
                        <small>{agent.group}</small>
                      </span>
                    </button>
                  </td>
                  <td data-label="当前状态">
                    <span className={`metrics-status ${runtimeState.tone}`}>
                      <i /> {runtimeState.label}
                    </span>
                  </td>
                  <td data-label="主责工作次数">
                    <strong>
                      {integerNumber.format(metric?.workCount || 0)}
                    </strong>
                    <small>次</small>
                  </td>
                  <td data-label="Token 消耗">
                    <strong>
                      {formatTokenCount(
                        metric?.totalTokens,
                        metric?.totalTokenCoverage
                      )}
                    </strong>
                    <small>
                      {metric?.totalTokenCoverage !== 'NONE' ||
                      metric?.cachedTokenCoverage !== 'NONE'
                        ? `输入 ${formatTokenCount(metric?.inputTokens, metric?.inputTokenCoverage)} · 输出 ${formatTokenCount(metric?.outputTokens, metric?.outputTokenCoverage)} · 缓存 ${formatTokenCount(metric?.cachedTokens, metric?.cachedTokenCoverage)}`
                        : '等待 CLI 上报真实用量'}
                    </small>
                  </td>
                  <td data-label="最近模型">
                    <code>{metric?.latestModelId || '未记录'}</code>
                  </td>
                  <td data-label="入职时间">
                    <span className="joined-at">{formatJoinedAt(agent.joinedAt)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AgentMetricsOverview
