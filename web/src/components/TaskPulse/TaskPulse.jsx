import { useQuery } from '@cedarjs/web'

const TASK_PULSE = gql`
  query TaskPulse {
    taskPulse {
      awaitingReview
      running
      queued
      completedToday
      failedToday
    }
  }
`

const TaskPulse = ({ onOpenTasks }) => {
  const { data, loading } = useQuery(TASK_PULSE, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 30_000,
  })

  const pulse = data?.taskPulse
  if (!pulse) {
    return (
      <div className="task-pulse">
        <span className="task-pulse-loading">
          {loading ? '正在读取任务…' : '暂无任务数据'}
        </span>
      </div>
    )
  }

  const items = [
    {
      key: 'review',
      label: '待验收',
      value: pulse.awaitingReview,
      tone: 'warning',
    },
    { key: 'running', label: '执行中', value: pulse.running, tone: 'working' },
    { key: 'queued', label: '排队中', value: pulse.queued, tone: 'idle' },
    {
      key: 'done',
      label: '今日完成',
      value: pulse.completedToday,
      tone: 'success',
    },
    {
      key: 'failed',
      label: '今日失败',
      value: pulse.failedToday,
      tone: 'danger',
    },
  ]

  return (
    <div className="task-pulse">
      <div className="task-pulse-head">
        <span className="section-kicker">任务</span>
        <button type="button" onClick={onOpenTasks}>
          打开任务看板 →
        </button>
      </div>
      <div className="task-pulse-items">
        {items.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`task-pulse-item ${item.tone}`}
            onClick={onOpenTasks}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

export default TaskPulse
