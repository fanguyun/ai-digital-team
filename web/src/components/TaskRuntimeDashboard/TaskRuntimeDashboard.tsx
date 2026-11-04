import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pagination } from 'antd'
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

import { useQuery, useSubscription } from '@cedarjs/web'

import {
  TaskDetail,
  type TaskDetailTask,
} from 'src/components/TaskDetail/TaskDetail'

import { groupTaskRuns } from './activityGroups'
import { describeWorkflowStage, WORKFLOW_STAGES } from './workflowFlow'

export const QUERY = gql`
  query TaskRuntimeDashboard($filter: TaskRunFilter, $first: Int, $skip: Int) {
    taskRuns(filter: $filter, first: $first, skip: $skip) {
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
      totalCount
      statusCounts {
        status
        count
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

type TaskRuntimeDashboardProps = {
  onSystemState?: (state: SystemState) => void
  onOpenSidebar?: () => void
}

type SystemState = {
  tone: 'danger' | 'warning' | 'active' | 'idle'
  label: string
}

type DashboardVariables = {
  filter: { statuses?: TaskStatus[]; search?: string } | null
  first: number
  skip: number
}

type StatusCount = {
  status: TaskStatus
  count: number
}

type DashboardData = {
  taskRuns: {
    edges: Array<{ cursor: string; node: TaskRun }>
    pageInfo: { endCursor?: string | null; hasNextPage: boolean }
    totalCount: number
    statusCounts: StatusCount[]
  }
  runtimeHealth: RuntimeHealth
}

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300
const SUBSCRIPTION_DEBOUNCE_MS = 700

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
  health: RuntimeHealth | undefined,
  taskRuns: TaskRun[]
): SystemState => {
  if (!health || health.database.status !== 'UP') {
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

const Loading = () => (
  <section className="workspace-view runtime-state-panel" aria-busy="true">
    <RefreshCw className="spin" size={22} />
    <h1>正在加载运行记录</h1>
    <p>正在连接本地任务运行时。</p>
  </section>
)

const Failure = ({ error, onRetry }: { error: Error; onRetry: () => void }) => (
  <section className="workspace-view runtime-state-panel failure">
    <ServerCrash size={24} />
    <h1>任务运行时暂不可用</h1>
    <p>{error.message}</p>
    <button type="button" onClick={onRetry}>
      <RotateCcw size={15} /> 重试连接
    </button>
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

const ActivityView = ({
  taskRuns,
  page,
  pendingPage,
  totalCount,
  statusCounts,
  pageLoading,
  status,
  searchInput,
  onStatusChange,
  onSearchInputChange,
  onPageChange,
}: {
  taskRuns: TaskRun[]
  page: number
  pendingPage: number | null
  totalCount: number
  statusCounts: Record<TaskStatus, number>
  pageLoading: boolean
  status: TaskStatus | 'ALL'
  searchInput: string
  onStatusChange: (status: TaskStatus | 'ALL') => void
  onSearchInputChange: (value: string) => void
  onPageChange: (page: number) => void
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // 分组只在当前页内进行；筛选/搜索已由服务端完成。
  const groupedTasks = useMemo(() => groupTaskRuns(taskRuns), [taskRuns])

  const countFor = (option: TaskStatus | 'ALL') =>
    option === 'ALL' ? totalCount : (statusCounts[option] ?? 0)

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
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
        />
      </label>
      <div className="runtime-filter" aria-label="运行状态筛选">
        {STATUS_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            className={status === option.value ? 'active' : ''}
            onClick={() => onStatusChange(option.value)}
          >
            {option.label}
            <span>{countFor(option.value)}</span>
          </button>
        ))}
      </div>
      {groupedTasks.length ? (
        <div className="runtime-list">
          {groupedTasks.map((group) => {
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
                    <time
                      dateTime={task.startedAt}
                      title={`开始时间 ${formatDate(task.startedAt)}`}
                    >
                      {formatDate(task.startedAt)}
                    </time>
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
      {totalCount > PAGE_SIZE && (
        <nav className="runtime-pagination" aria-label="运行记录分页">
          <span className="runtime-pagination-summary">
            {pendingPage === null
              ? `共 ${totalCount} 条 · 每页 ${PAGE_SIZE} 条`
              : `正在加载第 ${pendingPage + 1} 页…`}
          </span>
          <Pagination
            current={page + 1}
            pageSize={PAGE_SIZE}
            total={totalCount}
            disabled={pageLoading}
            responsive
            showLessItems
            showSizeChanger={false}
            showTitle={false}
            onChange={onPageChange}
          />
        </nav>
      )}
    </>
  )
}

const TaskRuntimeDashboard = ({
  onSystemState,
  onOpenSidebar,
}: TaskRuntimeDashboardProps) => {
  const [requestedPage, setRequestedPage] = useState(0)
  const [displayedPage, setDisplayedPage] = useState(0)
  const [view, setView] = useState<DashboardData | null>(null)
  const [status, setStatus] = useState<TaskStatus | 'ALL'>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [subscriptionFailed, setSubscriptionFailed] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const variables = useMemo<DashboardVariables>(() => {
    const filter: { statuses?: TaskStatus[]; search?: string } = {}
    if (status !== 'ALL') filter.statuses = [status]
    if (searchKeyword) filter.search = searchKeyword
    return {
      filter: Object.keys(filter).length ? filter : null,
      first: PAGE_SIZE,
      skip: requestedPage * PAGE_SIZE,
    }
  }, [requestedPage, searchKeyword, status])

  const { data, error, loading, refetch } = useQuery<
    DashboardData,
    DashboardVariables
  >(QUERY, {
    variables,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  })

  // Apollo 在 variables 变化时可能继续暴露上一页的 data。只有目标页请求完成后
  // 才同时提交页码和数据，避免出现“新页码 + 旧列表”的错位状态。
  useEffect(() => {
    if (loading || error || !data) return

    const nextPageCount = Math.max(
      1,
      Math.ceil(data.taskRuns.totalCount / PAGE_SIZE)
    )
    if (requestedPage > nextPageCount - 1) {
      setRequestedPage(nextPageCount - 1)
      return
    }

    setView(data)
    setDisplayedPage(requestedPage)
  }, [data, error, loading, requestedPage])

  useEffect(() => {
    if (error && view && requestedPage !== displayedPage) {
      setRequestedPage(displayedPage)
    }
  }, [displayedPage, error, requestedPage, view])

  const variablesRef = useRef(variables)
  variablesRef.current = variables

  const refreshLatest = useCallback(() => {
    if (requestedPage !== 0) {
      setRequestedPage(0)
      return
    }
    void refetch({ ...variablesRef.current, skip: 0 })
  }, [refetch, requestedPage])

  const refreshTimer = useRef<number | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current)
    }
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      refreshLatest()
    }, SUBSCRIPTION_DEBOUNCE_MS)
  }, [refreshLatest])

  useEffect(
    () => () => {
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current)
      }
    },
    []
  )

  useSubscription(TASK_RUNS_CHANGED, {
    onData: () => {
      setSubscriptionFailed(false)
      scheduleRefresh()
    },
    onError: () => setSubscriptionFailed(true),
  })

  useEffect(() => {
    const reconnect = () => {
      setSubscriptionFailed(false)
      scheduleRefresh()
    }
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [scheduleRefresh])

  const tasks = useMemo(
    () => view?.taskRuns.edges.map((edge) => edge.node) ?? [],
    [view]
  )
  const totalCount = view?.taskRuns.totalCount ?? 0
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.keys(STATUS_META).map((status) => [status, 0])
    ) as Record<TaskStatus, number>
    for (const entry of view?.taskRuns.statusCounts ?? []) {
      counts[entry.status] = entry.count
    }
    return counts
  }, [view])
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const systemState = calculateSystemState(view?.runtimeHealth, tasks)

  useEffect(() => {
    onSystemState?.({ label: systemState.label, tone: systemState.tone })
  }, [onSystemState, systemState.label, systemState.tone])

  const changeStatus = (nextStatus: TaskStatus | 'ALL') => {
    setStatus(nextStatus)
    setRequestedPage(0)
  }

  const changeSearchInput = (value: string) => {
    setSearchInput(value)
    setRequestedPage(0)
  }

  const changePage = (targetPage: number) => {
    const targetIndex = targetPage - 1
    if (
      targetIndex < 0 ||
      targetIndex >= pageCount ||
      targetIndex === requestedPage
    ) {
      return
    }
    setRequestedPage(targetIndex)
  }

  if (!view) {
    if (error) return <Failure error={error} onRetry={refreshLatest} />
    if (loading) return <Loading />
    return null
  }

  const { runtimeHealth } = view

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
            onClick={refreshLatest}
            disabled={loading}
            aria-label="刷新任务状态"
            title="刷新任务状态"
          >
            <RefreshCw className={loading ? 'spin' : ''} size={17} />
          </button>
        </div>
      </div>
      <ActivityView
        taskRuns={tasks}
        page={displayedPage}
        pendingPage={
          loading && requestedPage !== displayedPage ? requestedPage : null
        }
        totalCount={totalCount}
        statusCounts={statusCounts}
        pageLoading={loading}
        status={status}
        searchInput={searchInput}
        onStatusChange={changeStatus}
        onSearchInputChange={changeSearchInput}
        onPageChange={changePage}
      />
    </section>
  )
}

export default TaskRuntimeDashboard
