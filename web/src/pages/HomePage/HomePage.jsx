import { useEffect, useMemo, useState } from 'react'

import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  Command,
  FileText,
  FolderGit2,
  GitBranch,
  Inbox,
  LayoutGrid,
  List,
  Store,
  Sun,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react'

import { useQuery, useSubscription } from '@cedarjs/web'

import { useAuth } from 'src/auth'
import { useTheme } from 'src/theme'

import AgentOfficeView, {
  formatTaskStage,
} from 'src/components/AgentOfficeView/AgentOfficeView'
import ActionCenter from 'src/components/ActionCenter/ActionCenter'
import { buildActionCenterModel } from 'src/components/ActionCenter/actionItems'
import AgentMetricsOverview, {
  formatJoinedAt,
} from 'src/components/AgentMetricsOverview/AgentMetricsOverview'
import CapabilityHealthCenter from 'src/components/CapabilityHealthCenter/CapabilityHealthCenter'
import SkillMarket from 'src/components/SkillMarket/SkillMarket'
import { resolveMetricsRange } from 'src/components/AgentMetricsOverview/metricsTimeRange'
import TaskRuntimeCell from 'src/components/TaskRuntimeCell/TaskRuntimeCell'
import WeeklyReport from 'src/components/WeeklyReport/WeeklyReport'

import agentManifest from '../../../../agents/manifest.json'
import { RAFIKI_CREDIT, sceneForAgent } from 'src/illustrations/rafikiScenes'
import { useThemedSceneSrc } from 'src/illustrations/useThemedSceneSrc'

const agents = agentManifest.agents
const groups = ['全部岗位', ...agentManifest.groups]
const agentPaths = Object.fromEntries(agents.map(({ id, slug }) => [id, slug]))
const agentDocuments = import.meta.glob('../../../../agents/*/AGENTS.md', {
  eager: true,
  import: 'default',
  query: '?raw',
})

const AGENT_RUNTIME_STATUSES = gql`
  query AgentRuntimeStatuses($overviewRange: RuntimeTimeRange) {
    taskRuns(
      filter: { statuses: [QUEUED, RUNNING, WAITING_CONFIRMATION] }
      first: 100
    ) {
      edges {
        node {
          id
          title
          primaryAgent
          status
          currentStage
          updatedAt
        }
      }
    }
    teamRuntimeOverview(range: $overviewRange) {
      totalWorkCount
      totalTaskCount
      trackedWorkCount
      inputTokens
      outputTokens
      cachedTokens
      totalTokens
      inputTokenCoverage
      outputTokenCoverage
      cachedTokenCoverage
      totalTokenCoverage
      agents {
        agent
        workCount
        trackedWorkCount
        inputTokens
        outputTokens
        cachedTokens
        totalTokens
        inputTokenCoverage
        outputTokenCoverage
        cachedTokenCoverage
        totalTokenCoverage
        latestModelId
        firstTaskAt
        lastTaskAt
      }
    }
  }
`

const AGENT_RUNTIME_CHANGED = gql`
  subscription AgentRuntimeChanged {
    taskRunsChanged {
      id
      primaryAgent
      status
      updatedAt
    }
  }
`

const ACTION_CENTER_OVERVIEW = gql`
  query ActionCenterOverview {
    taskRuns(
      filter: { statuses: [QUEUED, RUNNING, WAITING_CONFIRMATION, FAILED] }
      first: 100
    ) {
      edges {
        node {
          id
          title
          primaryAgent
          status
          summary
          updatedAt
        }
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
    }
    installedSkills {
      id
      name
      updatable
    }
  }
`

const ACTIVE_STATUS_PRIORITY = {
  WAITING_CONFIRMATION: 3,
  RUNNING: 2,
  QUEUED: 1,
}

const getAgentRuntimeState = ({ activeTask, loading, error }) => {
  if (!activeTask && loading) {
    return { label: '同步中', tone: 'syncing', task: null }
  }
  if (!activeTask && error) {
    return { label: '状态未知', tone: 'unknown', task: null }
  }
  if (!activeTask) {
    return { label: '空闲', tone: 'idle', task: null }
  }
  if (activeTask.status === 'WAITING_CONFIRMATION') {
    return { label: '待确认', tone: 'waiting', task: activeTask }
  }
  return { label: '工作中', tone: 'working', task: activeTask }
}

function MarkdownDocument({ content }) {
  return (
    <div className="markdown-document">
      {content.split(/\r?\n/).map((line, index) => {
        if (!line.trim()) return <div className="md-spacer" key={index} />
        if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={index}>{line.slice(4)}</h3>
        if (line.startsWith('> '))
          return <blockquote key={index}>{line.slice(2)}</blockquote>
        if (line.startsWith('- ')) return <li key={index}>{line.slice(2)}</li>
        if (/^\d+\. /.test(line))
          return <li key={index}>{line.replace(/^\d+\. /, '')}</li>
        return <p key={index}>{line}</p>
      })}
    </div>
  )
}

function App() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [workspaceView, setWorkspaceView] = useState('overview')
  const [directoryMode, setDirectoryMode] = useState('office')
  const [activeGroup, setActiveGroup] = useState('全部岗位')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('main')
  const [detailOpen, setDetailOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [documentState, setDocumentState] = useState({
    open: false,
    loading: false,
    content: '',
    error: '',
  })
  const [systemState, setSystemState] = useState({
    tone: 'idle',
    label: '系统状态待同步',
  })
  const [metricsPreset, setMetricsPreset] = useState('all')
  const [metricsCustomRange, setMetricsCustomRange] = useState({
    from: '',
    to: '',
  })
  const metricsRange = useMemo(
    () =>
      resolveMetricsRange({
        preset: metricsPreset,
        customFrom: metricsCustomRange.from,
        customTo: metricsCustomRange.to,
      }),
    [metricsCustomRange.from, metricsCustomRange.to, metricsPreset]
  )
  const metricsRangeError = metricsRange?.invalid
    ? '开始日期不能晚于结束日期'
    : ''
  const metricsRangeHint = metricsRange?.incomplete
    ? '请选择开始和结束日期'
    : ''
  const [overviewRange, setOverviewRange] = useState(null)
  useEffect(() => {
    if (metricsRange?.incomplete || metricsRange?.invalid) return
    setOverviewRange(
      metricsRange
        ? {
            from: metricsRange.from.toISOString(),
            to: metricsRange.to.toISOString(),
          }
        : null
    )
  }, [metricsRange])
  const {
    data: runtimeData,
    loading: runtimeLoading,
    error: runtimeError,
    refetch: refetchRuntimeStatuses,
  } = useQuery(AGENT_RUNTIME_STATUSES, {
    skip: workspaceView !== 'overview',
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    variables: { overviewRange },
  })
  const {
    data: actionCenterData,
    loading: actionCenterLoading,
    error: actionCenterError,
    refetch: refetchActionCenter,
  } = useQuery(ACTION_CENTER_OVERVIEW, {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  })

  const actionCenterModel = useMemo(
    () =>
      buildActionCenterModel({
        taskRuns:
          actionCenterData?.taskRuns?.edges?.map((edge) => edge.node) || [],
        runtimeHealth: actionCenterData?.runtimeHealth,
        skills: actionCenterData?.installedSkills || [],
        queryError: actionCenterError,
      }),
    [actionCenterData, actionCenterError]
  )

  useSubscription(AGENT_RUNTIME_CHANGED, {
    skip: workspaceView !== 'overview',
    onData: () => void refetchRuntimeStatuses(),
  })
  useSubscription(AGENT_RUNTIME_CHANGED, {
    onData: () => void refetchActionCenter(),
  })

  const activeTasksByAgent = useMemo(() => {
    const activeTasks = new Map()
    for (const edge of runtimeData?.taskRuns?.edges || []) {
      const task = edge.node
      const current = activeTasks.get(task.primaryAgent)
      const taskPriority = ACTIVE_STATUS_PRIORITY[task.status] || 0
      const currentPriority = current
        ? ACTIVE_STATUS_PRIORITY[current.status] || 0
        : -1
      const isNewerAtSamePriority =
        current &&
        taskPriority === currentPriority &&
        new Date(task.updatedAt).getTime() >
          new Date(current.updatedAt).getTime()

      if (!current || taskPriority > currentPriority || isNewerAtSamePriority) {
        activeTasks.set(task.primaryAgent, task)
      }
    }
    return activeTasks
  }, [runtimeData])

  const runtimeStateFor = (agent) =>
    getAgentRuntimeState({
      activeTask: activeTasksByAgent.get(agent.slug),
      loading: runtimeLoading && !runtimeData,
      error: runtimeError && !runtimeData,
    })

  useEffect(() => {
    if (workspaceView !== 'overview') return
    if (runtimeError && !runtimeData) {
      setSystemState({ tone: 'danger', label: '运行时不可用' })
      return
    }
    if (runtimeLoading && !runtimeData) {
      setSystemState({ tone: 'idle', label: '正在同步状态' })
      return
    }

    const activeTasks = [...activeTasksByAgent.values()]
    if (activeTasks.some((task) => task.status === 'WAITING_CONFIRMATION')) {
      setSystemState({ tone: 'warning', label: '等待确认' })
    } else if (activeTasks.length > 0) {
      setSystemState({ tone: 'active', label: '任务运行中' })
    } else {
      setSystemState({ tone: 'idle', label: '系统空闲' })
    }
  }, [
    activeTasksByAgent,
    runtimeData,
    runtimeError,
    runtimeLoading,
    workspaceView,
  ])

  const filtered = useMemo(
    () =>
      agents.filter((agent) => {
        const inGroup =
          activeGroup === '全部岗位' || agent.group === activeGroup
        const text =
          `${agent.name} ${agent.en} ${agent.role} ${agent.skills.join(' ')}`.toLowerCase()
        return inGroup && text.includes(query.toLowerCase())
      }),
    [activeGroup, query]
  )

  const selected = agents.find((agent) => agent.id === selectedId) || agents[0]
  const selectedRuntimeState = runtimeStateFor(selected)
  const selectedScene = sceneForAgent(selected.slug)
  const officeHero = useThemedSceneSrc('/illustrations/rafiki/team-work.svg')
  const detailScene = useThemedSceneSrc(selectedScene.src)
  const teamStats = agents.reduce(
    (stats, agent) => {
      const tone = runtimeStateFor(agent).tone
      if (tone === 'working') stats.working += 1
      if (tone === 'waiting') stats.waiting += 1
      if (tone === 'idle') stats.idle += 1
      return stats
    },
    { total: agents.length, working: 0, waiting: 0, idle: 0 }
  )

  const selectAgent = (agent) => {
    setSelectedId(agent.id)
    setDetailOpen(true)
  }

  const openAgentDocument = async () => {
    setDocumentState({ open: true, loading: true, content: '', error: '' })
    try {
      const documentPath = `../../../../agents/${agentPaths[selected.id]}/AGENTS.md`
      let content = agentDocuments[documentPath]
      if (!content) {
        const response = await fetch(
          `/agents/${agentPaths[selected.id]}/AGENTS.md`
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = await response.arrayBuffer()
        content = new TextDecoder('utf-8').decode(buffer)
      }
      setDocumentState({ open: true, loading: false, content, error: '' })
    } catch (error) {
      setDocumentState({
        open: true,
        loading: false,
        content: '',
        error: `暂时无法读取岗位规则（${error.message}）。请确认应用运行在项目根目录。`,
      })
    }
  }

  return (
    <div className={`app-shell view-${workspaceView}`}>
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        aria-label="关闭导航"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <Command size={17} strokeWidth={2.1} />
          </div>
          <div>
            <strong>个人数字团队</strong>
            <small>PERSONAL DIGITAL TEAM</small>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭导航"
          >
            <X size={17} />
          </button>
        </div>
        <nav className="side-nav" aria-label="团队导航">
          <div className="nav-caption">工作区</div>
          <button
            className={`nav-item ${workspaceView === 'overview' ? 'active' : ''}`}
            onClick={() => {
              setWorkspaceView('overview')
              setSidebarOpen(false)
              setDetailOpen(false)
            }}
          >
            <LayoutGrid size={16} /> 团队总览{' '}
            <span className="nav-count">{agents.length}</span>
          </button>
          <button
            className={`nav-item ${workspaceView === 'actions' ? 'active' : ''}`}
            onClick={() => {
              setWorkspaceView('actions')
              setSidebarOpen(false)
              setDetailOpen(false)
            }}
          >
            <Inbox size={16} /> 待处理
            {actionCenterModel.counts.total > 0 && (
              <span className="nav-count action-count">
                {actionCenterModel.counts.total}
              </span>
            )}
          </button>
          <button
            className={`nav-item ${workspaceView === 'runs' ? 'active' : ''}`}
            onClick={() => {
              setWorkspaceView('runs')
              setSidebarOpen(false)
              setDetailOpen(false)
            }}
          >
            <Activity size={16} /> 运行记录
          </button>
          <button
            className={`nav-item ${workspaceView === 'report' ? 'active' : ''}`}
            onClick={() => {
              setWorkspaceView('report')
              setSidebarOpen(false)
              setDetailOpen(false)
            }}
          >
            <BarChart3 size={16} /> 工作总结
          </button>
          <button
            className={`nav-item ${workspaceView === 'market' ? 'active' : ''}`}
            onClick={() => {
              setWorkspaceView('market')
              setSidebarOpen(false)
              setDetailOpen(false)
            }}
          >
            <Store size={16} /> 插件市场
          </button>
          <div className="nav-caption separated">管理</div>
          <button className="nav-item" disabled title="开发中">
            <Plus size={16} /> 新增 Agent
          </button>
          <button
            className={`nav-item ${workspaceView === 'health' ? 'active' : ''}`}
            onClick={() => {
              setWorkspaceView('health')
              setSidebarOpen(false)
              setDetailOpen(false)
            }}
          >
            <Settings size={16} /> 团队设置
          </button>
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="theme-toggle"
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? '浅色模式' : '深色模式'}
          </button>
          <div className={`sync-status ${systemState.tone}`}>
            <span className="pulse" /> {systemState.label}
          </div>
          <div className="profile">
            <div className="avatar">{(user?.username || 'F').slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user?.username || 'Fan'}</strong>
              <small>团队所有者</small>
            </div>
            <button type="button" className="logout-button" onClick={logout}>
              退出
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {workspaceView === 'overview' ? (
          <>
            <header className="topbar">
              <button
                className="mobile-menu"
                onClick={() => setSidebarOpen(true)}
                aria-label="打开导航"
              >
                <Menu size={20} />
              </button>
              <div className="breadcrumbs">
                <FolderGit2 size={15} />
                <strong>个人数字团队</strong>
                <span>/</span>
                <span>团队总览</span>
              </div>
              <div className="top-actions">
                <button className="branch-chip" disabled title="开发中">
                  <GitBranch size={13} /> main
                  <ChevronDown size={13} />
                </button>
                <div className="status-chip">
                  <span className="pulse" /> 本地
                </div>
                <button className="round-action" aria-label="通知（开发中）" disabled title="开发中">
                  <Bell size={17} />
                  <i />
                </button>
                <button className="round-action" aria-label="设置（开发中）" disabled title="开发中">
                  <Settings size={17} />
                </button>
              </div>
            </header>

            <section className="directory-section">
              <div className="office-overview">
                <div className="office-overview-copy">
                  <div className="office-emblem">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="section-kicker">团队实时状态</div>
                    <h1>数字办公室</h1>
                    <p>按部门查看每位数字员工的职位与当前工作状态。</p>
                  </div>
                </div>
                <figure className="office-hero-art">
                  <img
                    className={officeHero.pending ? 'is-pending' : undefined}
                    src={officeHero.src}
                    alt="团队协作"
                  />
                  <figcaption>
                    <a
                      href={RAFIKI_CREDIT.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {RAFIKI_CREDIT.label}
                    </a>
                  </figcaption>
                </figure>
                <div className="office-stat-grid" aria-label="团队状态统计">
                  <div>
                    <span>员工总数</span>
                    <strong>{teamStats.total}</strong>
                  </div>
                  <div className="working">
                    <span>工作中</span>
                    <strong>{teamStats.working}</strong>
                  </div>
                  <div className="waiting">
                    <span>待确认</span>
                    <strong>{teamStats.waiting}</strong>
                  </div>
                  <div className="idle">
                    <span>空闲</span>
                    <strong>{teamStats.idle}</strong>
                  </div>
                </div>
              </div>
              <div className="section-heading">
                <div>
                  <div className="section-kicker">数字员工</div>
                  <h2>
                    员工与岗位 <span>{filtered.length}</span>
                  </h2>
                </div>
                <div className="directory-tools">
                  <label className="search-box">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索角色或 Skill"
                    />
                  </label>
                  <div className="directory-view-switch" aria-label="员工视图">
                    <button
                      type="button"
                      className={directoryMode === 'office' ? 'active' : ''}
                      onClick={() => setDirectoryMode('office')}
                    >
                      <Building2 size={14} /> 办公室
                    </button>
                    <button
                      type="button"
                      className={directoryMode === 'list' ? 'active' : ''}
                      onClick={() => setDirectoryMode('list')}
                    >
                      <List size={14} /> 列表
                    </button>
                    <button
                      type="button"
                      className={directoryMode === 'metrics' ? 'active' : ''}
                      onClick={() => setDirectoryMode('metrics')}
                    >
                      <BarChart3 size={14} /> 数据总览
                    </button>
                  </div>
                  {directoryMode === 'list' && (
                    <button
                      className={`view-toggle ${showSkills ? 'selected' : ''}`}
                      onClick={() => setShowSkills(!showSkills)}
                    >
                      <FileText size={15} />{' '}
                      {showSkills ? '收起 Skill' : '显示 Skill'}
                    </button>
                  )}
                </div>
              </div>
              <div className="filter-row">
                {groups.map((group) => (
                  <button
                    key={group}
                    className={
                      activeGroup === group ? 'filter active' : 'filter'
                    }
                    onClick={() => setActiveGroup(group)}
                  >
                    {group}
                    {group === '全部岗位' && <span>{agents.length}</span>}
                  </button>
                ))}
              </div>
              {filtered.length > 0 && directoryMode === 'office' && (
                <AgentOfficeView
                  agents={filtered}
                  groups={agentManifest.groups}
                  runtimeStateFor={runtimeStateFor}
                  selectedId={selectedId}
                  onSelectAgent={selectAgent}
                />
              )}
              {filtered.length > 0 && directoryMode === 'list' && (
                <div className="agent-grid">
                  {filtered.map((agent) => {
                    const runtimeState = runtimeStateFor(agent)
                    return (
                      <article
                        className={`agent-card ${selectedId === agent.id ? 'selected' : ''}`}
                        key={agent.id}
                        onClick={() => selectAgent(agent)}
                        tabIndex="0"
                        onKeyDown={(event) =>
                          event.key === 'Enter' && selectAgent(agent)
                        }
                      >
                        <div className="card-top">
                          <div
                            className="agent-icon"
                            style={{
                              background: `${agent.color}14`,
                              color: agent.color,
                            }}
                          >
                            {agent.icon}
                          </div>
                          <span className="agent-open">
                            <ChevronRight size={15} />
                          </span>
                        </div>
                        <div className="agent-card-content">
                          <div className="agent-card-heading">
                            <h3>{agent.name}</h3>
                            <span className="agent-group">{agent.group}</span>
                          </div>
                          <p className="agent-role">{agent.role}</p>
                          <p className="agent-en">{agent.en}</p>
                        </div>
                        {showSkills && (
                          <div className="skill-list">
                            {agent.skills.map((skill) => (
                              <span key={skill}>{skill}</span>
                            ))}
                          </div>
                        )}
                        <div className="card-footer">
                          <span
                            className={`agent-runtime-state ${runtimeState.tone}`}
                            title={
                              runtimeState.task?.title || runtimeState.label
                            }
                          >
                            <i className="mini-pulse" /> {runtimeState.label}
                          </span>
                          <span>{formatJoinedAt(agent.joinedAt)}</span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
              {filtered.length > 0 && directoryMode === 'metrics' && (
                <AgentMetricsOverview
                  agents={filtered}
                  totalAgents={agents.length}
                  overview={runtimeData?.teamRuntimeOverview}
                  runtimeStateFor={runtimeStateFor}
                  loading={runtimeLoading}
                  error={runtimeError}
                  onSelectAgent={selectAgent}
                  rangePreset={metricsPreset}
                  customRange={metricsCustomRange}
                  rangeError={metricsRangeError}
                  rangeHint={metricsRangeHint}
                  onRangeChange={({ preset, customRange }) => {
                    setMetricsPreset(preset)
                    setMetricsCustomRange(customRange)
                  }}
                />
              )}
              {filtered.length === 0 && (
                <div className="empty-state">
                  <span>⌕</span>
                  <h3>没有匹配的角色</h3>
                  <p>换个关键词，或清除当前筛选。</p>
                  <button
                    onClick={() => {
                      setQuery('')
                      setActiveGroup('全部岗位')
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </section>
          </>
        ) : workspaceView === 'actions' ? (
          <ActionCenter
            model={actionCenterModel}
            loading={actionCenterLoading}
            onNavigate={setWorkspaceView}
            onRefresh={() => refetchActionCenter()}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        ) : workspaceView === 'market' ? (
          <SkillMarket onOpenSidebar={() => setSidebarOpen(true)} />
        ) : workspaceView === 'health' ? (
          <CapabilityHealthCenter onOpenSidebar={() => setSidebarOpen(true)} />
        ) : workspaceView === 'report' ? (
          <WeeklyReport onOpenSidebar={() => setSidebarOpen(true)} />
        ) : (
          <TaskRuntimeCell
            onSystemState={setSystemState}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
      </main>

      <aside className={`detail-panel ${detailOpen ? 'open' : ''}`}>
        <div className="detail-head">
          <span>ROLE PROFILE</span>
          <button
            onClick={() => setDetailOpen(false)}
            aria-label="关闭岗位详情"
          >
            <X size={17} />
          </button>
        </div>
        <div className="detail-hero">
          <figure className="detail-scene">
            <img
              className={detailScene.pending ? 'is-pending' : undefined}
              src={detailScene.src}
              alt={selectedScene.title}
            />
            <figcaption>
              <a
                href={RAFIKI_CREDIT.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {RAFIKI_CREDIT.label}
              </a>
            </figcaption>
          </figure>
          <div
            className="detail-icon"
            style={{ background: `${selected.color}14`, color: selected.color }}
          >
            {selected.icon}
          </div>
          <span
            className={`detail-online ${selectedRuntimeState.tone}`}
            title={selectedRuntimeState.task?.title || undefined}
            aria-live="polite"
          >
            <i /> {selectedRuntimeState.label}
          </span>
        </div>
        <h2>{selected.name}</h2>
        <p className="detail-en">{selected.en}</p>
        <div className="detail-rule" />
        <div className="detail-block">
          <span className="detail-label">入职时间</span>
          <p>{formatJoinedAt(selected.joinedAt)}</p>
        </div>
        <div className="detail-block">
          <span className="detail-label">岗位使命</span>
          <p>{selected.role}</p>
        </div>
        {selectedRuntimeState.task && (
          <div className="detail-block">
            <span className="detail-label">当前任务</span>
            <div className="detail-current-task">
              <strong>{selectedRuntimeState.task.title}</strong>
              <span>
                {formatTaskStage(selectedRuntimeState.task.currentStage)}
              </span>
            </div>
          </div>
        )}
        <div className="detail-block">
          <span className="detail-label">触发条件</span>
          <div className="trigger-box">{selected.trigger}</div>
        </div>
        <div className="detail-block">
          <div className="detail-label-row">
            <span className="detail-label">已连接 Skill</span>
            <span className="skill-total">{selected.skills.length} 项</span>
          </div>
          <div className="detail-skills">
            {selected.skills.map((skill) => (
              <span key={skill}>
                <b>•</b>
                {skill}
              </span>
            ))}
          </div>
        </div>
        <button className="open-agent" onClick={openAgentDocument}>
          查看岗位规则 <span>↗</span>
        </button>
        <div className="detail-note">
          <span>i</span> 所有岗位遵循团队公共边界与确认机制。
        </div>
      </aside>
      {documentState.open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            setDocumentState((state) => ({ ...state, open: false }))
          }
        >
          <section
            className="agent-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-document-title"
          >
            <header className="modal-header">
              <div>
                <span className="modal-kicker">AGENT RULEBOOK</span>
                <h2 id="agent-document-title">{selected.name}</h2>
                <p>{selected.en}</p>
              </div>
              <button
                className="modal-close"
                onClick={() =>
                  setDocumentState((state) => ({ ...state, open: false }))
                }
                aria-label="关闭"
              >
                ×
              </button>
            </header>
            <div className="modal-body">
              {documentState.loading ? (
                <div className="modal-loading">
                  <span className="pulse" /> 正在读取岗位规则…
                </div>
              ) : documentState.error ? (
                <div className="modal-error">{documentState.error}</div>
              ) : (
                <MarkdownDocument content={documentState.content} />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
