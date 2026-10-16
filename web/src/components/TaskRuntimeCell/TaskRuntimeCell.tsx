import { useEffect, useMemo, useState } from 'react'

import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  Menu,
  RefreshCw,
  RotateCcw,
  ServerCrash,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'

import { useSubscription } from '@cedarjs/web'

import {
  TaskDetail,
  type TaskDetailTask,
} from 'src/components/TaskDetail/TaskDetail'

import { groupTaskRuns } from './activityGroups'
import { describeWorkflowStage, WORKFLOW_STAGES } from './workflowFlow'

export const QUERY = gql`
  query TaskRuntimeDashboard($filter: TaskRunFilter) {
    taskRuns(filter: $filter, first: 50) {
      edges {
        cursor
        node {
          id
          title
          platform
          externalReference
          primaryAgent
          status
          currentStage
          summary
          version
          startedAt
          updatedAt
          completedAt
          events {
            id
            sequence
            eventType
            status
            stage
            agent
            skills
            summary
            evidence
            inputTokens
            outputTokens
            cachedTokens
            modelId
            createdAt
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    runtimeHealth {
      database {
        status
        message
      }
      realtime {
        status
        message
      }
      serverTime
    }
  }
`

const TASK_RUNS_CHANGED = gql`
  subscription TaskRunsChanged {
    taskRunsChanged {
      id
      status
      currentStage
      summary
      version
      updatedAt
      completedAt
    }
  }
`

type TaskStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

type TaskStage =
  | 'INTAKE'
  | 'PLANNING'
  | 'EXECUTION'
  | 'VERIFICATION'
  | 'DELIVERY'

type TaskEvent = {
  id: string
  sequence: number
  eventType: string
  status?: TaskStatus | null
  stage: TaskStage
  agent: string
  skills: string[]
  summary: string
  evidence?: unknown
  inputTokens?: number | null
  outputTokens?: number | null
  cachedTokens?: number | null
  modelId?: string | null
  createdAt: string
}

type TaskRun = {
  id: string
  title: string
  platform: string
  externalReference?: string | null
  primaryAgent: string
  status: TaskStatus
  currentStage: TaskStage
  summary?: string | null
  version: number
  startedAt: string
  updatedAt: string
  completedAt?: string | null
  events: TaskEvent[]
}

type RuntimeHealth = {
  database: { status: string; message?: string | null }
  realtime: { status: string; message?: string | null }
  serverTime: string
}

type CellProps = {
  onSystemState?: (state: SystemState) => void
  onOpenSidebar?: () => void
}

type SystemState = {
  tone: 'danger' | 'warning' | 'active' | 'idle'
  label: string
}

type SuccessProps = CellProps & {
  taskRuns: {
    edges: Array<{ cursor: string; node: TaskRun }>
    pageInfo: { endCursor?: string | null; hasNextPage: boolean }
  }
  runtimeHealth: RuntimeHealth
  queryResult: { refetch: () => Promise<unknown> }
  updating?: boolean
}

const STATUS_OPTIONS: Array<{ value: TaskStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'QUEUED', label: '排队中' },
  { value: 'RUNNING', label: '进行中' },
  { value: 'WAITING_CONFIRMATION', label: '待确认' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'FAILED', label: '失败' },
  { value: 'CANCELLED', label: '已取消' },
]

const STATUS_META: Record<
  TaskStatus,
  { label: string; tone: string; icon: typeof Clock3 }
> = {
  QUEUED: { label: '排队中', tone: 'queued', icon: Clock3 },
  RUNNING: { label: '进行中', tone: 'running', icon: CircleDashed },
  WAITING_CONFIRMATION: {
    label: '待确认',
    tone: 'waiting',
    icon: AlertCircle,
  },
  COMPLETED: { label: '已完成', tone: 'completed', icon: CheckCircle2 },
  FAILED: { label: '失败', tone: 'failed', icon: XCircle },
  CANCELLED: { label: '已取消', tone: 'cancelled', icon: XCircle },
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))

const evidenceLabel = (evidence: unknown) => {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return null
  }
  const path = 'path' in evidence ? evidence.path : undefined
  return typeof path === 'string' ? path : JSON.stringify(evidence)
}

const calculateSystemState = (
  health: RuntimeHealth,
  taskRuns: TaskRun[]
): SystemState => {
  if (health.database.status !== 'UP') {
    return { tone: 'danger', label: '数据库异常' }
  }
  if (taskRuns.some((task) => task.status === 'FAILED')) {
    return { tone: 'danger', label: '存在失败任务' }
  }
  if (taskRuns.some((task) => task.status === 'WAITING_CONFIRMATION')) {
    return { tone: 'warning', label: '等待确认' }
  }
  if (taskRuns.some((task) => task.status === 'RUNNING')) {
    return { tone: 'active', label: '任务运行中' }
  }
  return { tone: 'idle', label: '系统空闲' }
}

export const beforeQuery = () => ({
  variables: { filter: null },
  fetchPolicy: 'cache-and-network' as const,
  nextFetchPolicy: 'cache-first' as const,
})

export const Loading = () => (
  <section className="workspace-view runtime-state-panel" aria-busy="true">
    <RefreshCw className="spin" size={22} />
    <h1>正在加载运行记录</h1>
    <p>正在连接本地任务运行时。</p>
  </section>
)

export const Failure = ({
  error,
  queryResult,
}: CellProps & {
  error: Error
  queryResult: { refetch: () => Promise<unknown> }
}) => (
  <section className="workspace-view runtime-state-panel failure">
    <ServerCrash size={24} />
    <h1>任务运行时暂不可用</h1>
    <p>{error.message}</p>
    <button type="button" onClick={() => queryResult.refetch()}>
      <RotateCcw size={15} /> 重试连接
    </button>
  </section>
)

export const Empty = () => (
  <section className="workspace-view runtime-state-panel">
    <Database size={24} />
    <h1>还没有真实任务记录</h1>
    <p>使用 task-runtime CLI 创建任务后，记录会自动出现在这里。</p>
  </section>
)

const RealtimeStatus = ({
  connected,
  health,
}: {
  connected: boolean
  health: RuntimeHealth
}) => (
  <span className={`realtime-badge ${connected ? 'online' : 'offline'}`}>
    {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
    {connected && health.realtime.status === 'UP' ? '实时在线' : '实时重连中'}
  </span>
)

const stageLabel = (stage: TaskStage) =>
  WORKFLOW_STAGES.find((item) => item.value === stage)?.label || stage

const ActivityView = ({ taskRuns }: { taskRuns: TaskRun[] }) => {
  const [status, setStatus] = useState<TaskStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const groupedTasks = useMemo(() => groupTaskRuns(taskRuns), [taskRuns])
  const visibleGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return groupedTasks.filter((group) => {
      const task = group.task
      const searchable = [
        task.title,
        task.summary,
        task.primaryAgent,
        task.platform,
        stageLabel(task.currentStage),
        STATUS_META[task.status].label,
      ]
        .join(' ')
        .toLowerCase()
      return (
        (status === 'ALL' || task.status === status) &&
        (!keyword || searchable.includes(keyword))
      )
    })
  }, [groupedTasks, query, status])

  const selectedTask = taskRuns.find((task) => task.id === selectedTaskId)

  if (selectedTask) {
    return (
      <TaskDetail
        task={selectedTask as TaskDetailTask}
        onBack={() => setSelectedTaskId(null)}
      />
    )
  }

  return (
    <>
      <label className="runtime-search">
        <input
          aria-label="搜索运行记录"
          placeholder="搜索任务、岗位或阶段"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="runtime-filter" aria-label="运行状态筛选">
        {STATUS_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            className={status === option.value ? 'active' : ''}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
            <span>
              {option.value === 'ALL'
                ? groupedTasks.length
                : groupedTasks.filter(
                    (group) => group.task.status === option.value
                  ).length}
            </span>
          </button>
        ))}
      </div>
      {visibleGroups.length ? (
        <div className="runtime-list">
          {visibleGroups.map((group) => {
            const task = group.task
            const statusMeta = STATUS_META[task.status]
            const StatusIcon = statusMeta.icon
            const latestEvent = task.events.at(-1)
            const evidence = evidenceLabel(latestEvent?.evidence)
            return (
              <article className="runtime-row" key={group.key}>
                <button
                  type="button"
                  className="runtime-row-main"
                  onClick={() => setSelectedTaskId(task.id)}
                  aria-label={`查看任务详情：${task.title}`}
                >
                  <span className={`runtime-status-icon ${statusMeta.tone}`}>
                    <StatusIcon size={17} />
                  </span>
                  <span className="runtime-row-copy">
                    <span className="runtime-row-title">
                      {task.title}
                      {group.items.length > 1 && (
                        <span className="runtime-repeat-count">
                          共 {group.items.length} 次
                        </span>
                      )}
                    </span>
                    <span className="runtime-row-summary">
                      {task.summary || '暂无摘要'}
                    </span>
                    <span className="runtime-row-meta">
                      <b>{task.platform}</b>
                      <span>{task.primaryAgent}</span>
                      <span>{stageLabel(task.currentStage)}</span>
                      <span
                        className="runtime-stage-track"
                        aria-label={`阶段进度：${WORKFLOW_STAGES.map(
                          (stage, index) => {
                            const described = describeWorkflowStage(
                              task,
                              stage.value,
                              index
                            )
                            const status = {
                              done: '已完成',
                              active: '进行中',
                              waiting: '待确认',
                              failed: '异常',
                              next: '未开始',
                            }[described.state]
                            return `${stage.label}${status}`
                          }
                        ).join('，')}`}
                      >
                        <span className="runtime-stage-label">阶段进度</span>
                        {WORKFLOW_STAGES.map((stage, index) => {
                          const described = describeWorkflowStage(
                            task,
                            stage.value,
                            index
                          )
                          const status = {
                            done: '已完成',
                            active: '进行中',
                            waiting: '待确认',
                            failed: '异常',
                            next: '未开始',
                          }[described.state]
                          const tooltip = `${stage.label}：${status}`
                          return (
                            <i
                              key={stage.value}
                              className={described.state}
                              role="img"
                              aria-label={tooltip}
                              data-tooltip={tooltip}
                              title={tooltip}
                            />
                          )
                        })}
                      </span>
                      {latestEvent?.skills.map((skill) => (
                        <em key={skill}>{skill}</em>
                      ))}
                    </span>
                    {evidence && (
                      <span className="runtime-evidence">证据：{evidence}</span>
                    )}
                  </span>
                  <span className="runtime-row-side">
                    <span className={`runtime-status ${statusMeta.tone}`}>
                      {statusMeta.label}
                    </span>
                    <time>{formatDate(task.updatedAt)}</time>
                  </span>
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="runtime-empty-inline">
          <Database size={22} />
          <strong>暂无匹配记录</strong>
          <span>换个关键词，或切换状态筛选。</span>
        </div>
      )}
    </>
  )
}

export const Success = ({
  onSystemState,
  onOpenSidebar,
  taskRuns,
  runtimeHealth,
  queryResult,
  updating,
}: SuccessProps) => {
  const tasks = taskRuns.edges.map((edge) => edge.node)
  const [subscriptionFailed, setSubscriptionFailed] = useState(false)
  const systemState = calculateSystemState(runtimeHealth, tasks)

  useSubscription(TASK_RUNS_CHANGED, {
    onData: () => {
      setSubscriptionFailed(false)
      void queryResult.refetch()
    },
    onError: () => setSubscriptionFailed(true),
  })

  useEffect(() => {
    const reconnect = () => {
      setSubscriptionFailed(false)
      void queryResult.refetch()
    }
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [queryResult])

  useEffect(() => {
    onSystemState?.(systemState)
  }, [onSystemState, systemState.label, systemState.tone])

  return (
    <section className="workspace-view task-runtime-view">
      <div className="page-intro runtime-page-intro">
        <button
          type="button"
          className="mobile-menu"
          onClick={onOpenSidebar}
          aria-label="打开导航"
        >
          <Menu size={20} />
        </button>
        <div>
          <div className="section-kicker">ACTIVITY LOG</div>
          <h1>运行记录</h1>
          <p>点击任务记录查看阶段、日志、岗位、Skill、证据、模型和 Token。</p>
        </div>
        <div className="runtime-page-actions">
          <span className={`system-state ${systemState.tone}`}>
            {systemState.label}
          </span>
          <RealtimeStatus
            connected={
              !subscriptionFailed && runtimeHealth.realtime.status === 'UP'
            }
            health={runtimeHealth}
          />
          <button
            type="button"
            className="runtime-refresh"
            onClick={() => queryResult.refetch()}
            disabled={updating}
            aria-label="刷新任务状态"
            title="刷新任务状态"
          >
            <RefreshCw className={updating ? 'spin' : ''} size={17} />
          </button>
        </div>
      </div>
      <ActivityView taskRuns={tasks} />
    </section>
  )
}
