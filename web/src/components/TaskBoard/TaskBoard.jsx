import { useEffect, useMemo, useRef, useState } from 'react'

import {
  Alert,
  Button,
  Card,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  DatePicker,
  Popconfirm,
  Segmented,
  Select,
  Tabs,
  Tag,
  Tree,
  notification,
} from 'antd'
import dayjs from 'dayjs'
import {
  Bell,
  BellOff,
  FileCode2,
  FileText,
  Folder,
  Menu,
  Play,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react'

import { useMutation, useQuery } from '@cedarjs/web'

import {
  buildArtifactTree,
  isMarkdownPath,
  languageForPath,
} from 'src/components/CodePreview/artifactTree'
import CodePreview from 'src/components/CodePreview/CodePreview'
import KnowledgePublisher from 'src/components/KnowledgePublisher/KnowledgePublisher'
import MarkdownDocument from 'src/components/MarkdownDocument/MarkdownDocument'
import MarkdownEditor from 'src/components/MarkdownEditor/MarkdownEditor'
import TaskKnowledge from 'src/components/TaskKnowledge/TaskKnowledge'
import WorkflowCreator from 'src/components/Workflow/WorkflowCreator'
import WorkflowPanel from 'src/components/Workflow/WorkflowPanel'

import agentManifest from '../../../../agents/manifest.json'

const TASKS_QUERY = gql`
  query Tasks(
    $status: String
    $agentSlug: String
    $from: DateTime
    $to: DateTime
  ) {
    tasks(status: $status, agentSlug: $agentSlug, from: $from, to: $to) {
      id
      workflow {
        id
        status
        currentStep
        version
      }
      title
      brief
      acceptance
      agentSlug
      priority
      status
      readOnly
      useKnowledge
      mode
      planPath
      planNote
      dueAt
      createdAt
      updatedAt
      completedAt
      reviewNote
      reviewedAt
      blocker {
        prompt
      }
      confirmation {
        runId
        prompt
      }
      artifacts {
        id
        kind
        source
        lastRunId
        availability
        projectName
        path
        label
        createdAt
      }
      runs {
        id
        status
        currentStage
        platform
        mode
        summary
        logPath
        dirtyAtDispatch
        projectName
        continuationStatus
        inputTokens
        outputTokens
        cachedTokens
        startedAt
        completedAt
        externalReference
        events {
          id
          eventType
          summary
          createdAt
        }
      }
    }
  }
`

const TASK_BY_ID = gql`
  query ActionTask($id: ID!) {
    task(id: $id) {
      id
      workflow {
        id
        taskId
        runId
        templateKey
        templateVersion
        status
        currentStep
        version
        reworkCount
        note
        publicationId
        input
        steps {
          id
          ordinal
          key
          name
          kind
          agentSlug
          status
          attemptCount
          attempts {
            id
            number
            status
            sessionId
            logPath
            startedAt
            finishedAt
            error
            artifactId
            contentHash
            inputTokens
            outputTokens
            cachedTokens
            output
          }
        }
      }
      title
      brief
      acceptance
      agentSlug
      priority
      status
      readOnly
      useKnowledge
      mode
      planPath
      planNote
      dueAt
      createdAt
      updatedAt
      completedAt
      reviewNote
      reviewedAt
      blocker {
        prompt
      }
      confirmation {
        runId
        prompt
      }
      artifacts {
        id
        kind
        source
        lastRunId
        availability
        projectName
        path
        label
        createdAt
      }
      runs {
        id
        status
        currentStage
        platform
        mode
        summary
        logPath
        dirtyAtDispatch
        projectName
        continuationStatus
        inputTokens
        outputTokens
        cachedTokens
        startedAt
        completedAt
        externalReference
        events {
          id
          eventType
          summary
          createdAt
        }
      }
    }
  }
`

const TASK_PLAN = gql`
  query ApprovalPlan($taskId: ID!, $planPath: String) {
    taskPlanContent(taskId: $taskId, planPath: $planPath)
  }
`

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
    }
  }
`

const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
    }
  }
`

const DISPATCH_TASK = gql`
  mutation DispatchTask($id: ID!, $tool: String, $note: String) {
    dispatchTask(id: $id, tool: $tool, note: $note) {
      id
      status
    }
  }
`

const CONFIRM_TASK_CONTINUATION = gql`
  mutation ConfirmTaskContinuation($id: ID!, $runId: ID!, $note: String) {
    confirmTaskContinuation(id: $id, runId: $runId, note: $note) {
      id
      status
    }
  }
`

const CANCEL_TASK = gql`
  mutation CancelTask($id: ID!, $version: Int) {
    cancelTask(id: $id, version: $version) {
      id
    }
  }
`

const TASK_PRECHECK = gql`
  query TaskPrecheck($id: ID!) {
    taskPrecheck(id: $id) {
      warnings
      expectedPaths
      environment {
        ready
        checks {
          key
          label
          status
          detail
          remedy
        }
      }
    }
  }
`

const RETRY_TASK_ENVIRONMENT = gql`
  mutation RetryTaskEnvironment($id: ID!) {
    retryTaskEnvironment(id: $id) {
      id
      status
    }
  }
`

const { RangePicker } = DatePicker

const TIME_TABS = [
  { label: '全部', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '自定义', value: 'custom' },
]

/** 按创建时间给出查询区间：只给起点，避免「到此刻」每次渲染都变导致重复请求 */
const rangeForTab = (tab, customRange) => {
  const now = dayjs()
  if (tab === 'today') return { from: now.startOf('day') }
  if (tab === 'week') {
    // 周一为一周起点
    const mondayOffset = (now.day() + 6) % 7
    return { from: now.subtract(mondayOffset, 'day').startOf('day') }
  }
  if (tab === 'month') return { from: now.startOf('month') }
  if (tab === 'custom' && customRange?.[0] && customRange?.[1]) {
    return {
      from: customRange[0].startOf('day'),
      to: customRange[1].endOf('day'),
    }
  }
  return {}
}

const DISPATCH_TOOLS = [
  { value: 'codex', label: 'Codex' },
  { value: 'deepseek-harness', label: 'DeepSeek Harness' },
]

const DISPATCH_TOOL_STORAGE_KEY = 'pdt.taskDispatch.tool'

const readStoredTool = () => {
  try {
    const saved = window.localStorage.getItem(DISPATCH_TOOL_STORAGE_KEY)
    return DISPATCH_TOOLS.some((tool) => tool.value === saved) ? saved : 'codex'
  } catch {
    return 'codex'
  }
}

const storeTool = (value) => {
  try {
    window.localStorage.setItem(DISPATCH_TOOL_STORAGE_KEY, value)
  } catch {
    // 隐私模式下写不进去就算了
  }
}

const REFRESH_TASK = gql`
  mutation RefreshTask($id: ID!) {
    refreshTask(id: $id) {
      id
      status
    }
  }
`

const REVIEW_TASK = gql`
  mutation ReviewTask($id: ID!, $decision: String!, $note: String) {
    reviewTask(id: $id, decision: $decision, note: $note) {
      id
      status
    }
  }
`

const TASK_TEMPLATES = gql`
  query TaskTemplates {
    taskTemplates {
      id
      name
      title
      brief
      acceptance
      agentSlug
      priority
      readOnly
    }
  }
`

const CREATE_TASK_TEMPLATE = gql`
  mutation CreateTaskTemplate($input: CreateTaskTemplateInput!) {
    createTaskTemplate(input: $input) {
      id
      name
    }
  }
`

const UPDATE_TASK_TEMPLATE = gql`
  mutation UpdateTaskTemplate($id: ID!, $input: UpdateTaskTemplateInput!) {
    updateTaskTemplate(id: $id, input: $input) {
      id
      name
    }
  }
`

const DELETE_TASK_TEMPLATE = gql`
  mutation DeleteTaskTemplate($id: ID!) {
    deleteTaskTemplate(id: $id) {
      id
    }
  }
`

const REVISE_TASK_PLAN = gql`
  mutation ReviseTaskPlan($id: ID!, $note: String!, $tool: String) {
    reviseTaskPlan(id: $id, note: $note, tool: $tool) {
      id
      status
    }
  }
`

const EXECUTE_TASK_PLAN = gql`
  mutation ExecuteTaskPlan($id: ID!, $tool: String, $planPath: String!) {
    executeTaskPlan(id: $id, tool: $tool, planPath: $planPath) {
      id
      status
    }
  }
`

const DISPATCH_TASKS = gql`
  mutation DispatchTasks($ids: [ID!]!, $tool: String) {
    dispatchTasks(ids: $ids, tool: $tool) {
      id
      status
    }
  }
`

const TASK_RUN_MESSAGES = gql`
  query TaskRunMessages($runId: ID!) {
    taskRunMessages(runId: $runId) {
      role
      content
      createdAt
    }
  }
`

const WORKSPACE_STATUS = gql`
  query WorkspaceStatus {
    workspaceStatus {
      dirty
      changedCount
    }
  }
`

const ADD_TASK_ARTIFACT = gql`
  mutation AddTaskArtifact($taskId: ID!, $input: AddTaskArtifactInput!) {
    addTaskArtifact(taskId: $taskId, input: $input) {
      id
    }
  }
`

const REMOVE_TASK_ARTIFACT = gql`
  mutation RemoveTaskArtifact($id: ID!) {
    removeTaskArtifact(id: $id) {
      id
    }
  }
`

const TASK_RUN_LOG = gql`
  query TaskRunLog($runId: ID!) {
    taskRunLog(runId: $runId)
  }
`

const ARTIFACT_CONTENT = gql`
  query TaskArtifactContent($id: ID!) {
    taskArtifactContent(id: $id)
  }
`

const COLUMNS = [
  { key: 'draft', label: '待派发', match: ['DRAFT', 'QUEUED'] },
  { key: 'running', label: '执行中', match: ['DISPATCHED', 'RUNNING'] },
  {
    key: 'review',
    label: '待验收',
    match: [
      'AWAITING_REVIEW',
      'AWAITING_APPROVAL',
      'WAITING_CONFIRMATION',
      'ENVIRONMENT_BLOCKED',
    ],
  },
  { key: 'done', label: '已完成', match: ['DONE'] },
  { key: 'closed', label: '失败 / 取消', match: ['FAILED', 'CANCELLED'] },
]

const STATUS_LABELS = {
  DRAFT: '待派发',
  DISPATCHED: '已派发',
  RUNNING: '执行中',
  QUEUED: '排队中',
  WAITING_CONFIRMATION: '待人工确认',
  ENVIRONMENT_BLOCKED: '环境阻塞',
  AWAITING_APPROVAL: '待确认方案',
  AWAITING_REVIEW: '待验收',
  DONE: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
}

const agentOptions = (agentManifest.agents || []).map((agent) => ({
  label: agent.name,
  value: agent.slug,
}))

const agentName = (slug) =>
  (agentManifest.agents || []).find((agent) => agent.slug === slug)?.name ||
  slug

const formatTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', { hour12: false })
}

const formatTokens = (value) => {
  if (!value) return null
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

const formatDuration = (start, end) => {
  if (!start) return ''
  const from = new Date(start).getTime()
  const to = end ? new Date(end).getTime() : Date.now()
  if (Number.isNaN(from) || Number.isNaN(to)) return ''
  const seconds = Math.max(0, Math.round((to - from) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

const TaskBoard = ({
  onOpenSidebar,
  initialAgentFilter = null,
  createRequest = null,
  onCreateRequestHandled,
  openRequest = null,
  onOpenRequestHandled,
  onTaskChanged,
}) => {
  const [timeTab, setTimeTab] = useState('all')
  const [customRange, setCustomRange] = useState(null)
  // 依赖里不放 now：区间起点在切换 tab 时才重算，避免轮询触发变量抖动
  const timeVars = useMemo(() => {
    const range = rangeForTab(timeTab, customRange)
    return {
      ...(range.from ? { from: range.from.toISOString() } : {}),
      ...(range.to ? { to: range.to.toISOString() } : {}),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTab, customRange])

  const { data, loading, error, refetch } = useQuery(TASKS_QUERY, {
    variables: timeVars,
    fetchPolicy: 'cache-and-network',
    pollInterval: 10_000,
  })
  const [createTask] = useMutation(CREATE_TASK)
  const [updateTask] = useMutation(UPDATE_TASK)
  const [dispatchTask] = useMutation(DISPATCH_TASK)
  const [dispatchTasks] = useMutation(DISPATCH_TASKS)
  const [executePlan] = useMutation(EXECUTE_TASK_PLAN)
  const [createTaskTemplate] = useMutation(CREATE_TASK_TEMPLATE)
  const [updateTaskTemplate] = useMutation(UPDATE_TASK_TEMPLATE)
  const [deleteTaskTemplate] = useMutation(DELETE_TASK_TEMPLATE)
  const { data: workspaceData } = useQuery(WORKSPACE_STATUS, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 60_000,
  })
  const workspace = workspaceData?.workspaceStatus
  const { data: templateData } = useQuery(TASK_TEMPLATES, {
    fetchPolicy: 'cache-and-network',
  })
  const templates = templateData?.taskTemplates || []
  const [cancelTask] = useMutation(CANCEL_TASK)
  const [refreshTaskMutation, { loading: refreshingState }] =
    useMutation(REFRESH_TASK)
  // @cedarjs/web 没有导出 useLazyQuery：用 skip + refetch 按需触发预检
  const { refetch: runPrecheck } = useQuery(TASK_PRECHECK, {
    skip: true,
    fetchPolicy: 'no-cache',
  })
  const [reviewTask] = useMutation(REVIEW_TASK)

  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [taskKind, setTaskKind] = useState('normal')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [openSection, setOpenSection] = useState('brief')
  const [approving, setApproving] = useState(false)
  const [dispatchTool, setDispatchTool] = useState(readStoredTool)
  const selectDispatchTool = (value) => {
    setDispatchTool(value)
    storeTool(value)
  }
  const dispatchToolLabel =
    DISPATCH_TOOLS.find((tool) => tool.value === dispatchTool)?.label ||
    dispatchTool
  const {
    data: targetData,
    error: targetError,
    refetch: refetchTarget,
  } = useQuery(TASK_BY_ID, {
    variables: { id: openId },
    skip: !openId,
    fetchPolicy: 'network-only',
    pollInterval: openId ? 10_000 : 0,
  })
  useEffect(() => {
    if (!openRequest?.taskId) return
    setOpenId(openRequest.taskId)
    setOpenSection(openRequest.section || 'brief')
    onOpenRequestHandled?.()
  }, [openRequest, onOpenRequestHandled])

  const refreshTasks = async () => {
    await refetch()
    if (openId) await refetchTarget({ id: openId })
    onTaskChanged?.()
  }
  const [agentFilter, setAgentFilter] = useState(initialAgentFilter)
  const [selectedIds, setSelectedIds] = useState([])
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [notifyEnabled, setNotifyEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  )

  const prevStatus = useRef(new Map())

  useEffect(() => {
    const list = data?.tasks || []
    if (!list.length) return
    const next = new Map()
    for (const task of list) {
      const previous = prevStatus.current.get(task.id)
      next.set(task.id, task.status)
      if (!previous || previous === task.status) continue
      if (!['AWAITING_REVIEW', 'DONE', 'FAILED'].includes(task.status)) continue

      const label = STATUS_LABELS[task.status] || task.status
      const title = `任务${label}：${task.title}`
      notification.info({
        message: title,
        description: agentName(task.agentSlug),
        duration: 6,
      })
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.hidden
      ) {
        new Notification(title, { body: agentName(task.agentSlug) })
      }
    }
    prevStatus.current = next
  }, [data])

  const tasks = useMemo(() => {
    const all = data?.tasks || []
    return agentFilter
      ? all.filter((item) => item.agentSlug === agentFilter)
      : all
  }, [data, agentFilter])

  const current =
    targetData?.task?.id === openId
      ? targetData.task
      : tasks.find((item) => item.id === openId) || null

  const applyTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    form.setFieldsValue({
      title: template.title,
      brief: template.brief,
      acceptance: template.acceptance,
      agentSlug: template.agentSlug,
      priority: template.priority,
      readOnly: template.readOnly,
    })
  }

  const saveAsTemplate = async () => {
    const name = templateName.trim()
    if (!name) return
    setTemplateSaving(true)
    try {
      const values = await form.validateFields()
      await createTaskTemplate({
        variables: { input: { ...values, name } },
      })
      setTemplateModalOpen(false)
      setTemplateName('')
      setNotice({ type: 'success', message: `模板「${name}」已保存` })
      await refetch()
    } catch (error) {
      if (error?.errorFields) return
      setNotice({ type: 'error', message: error.message })
    } finally {
      setTemplateSaving(false)
    }
  }

  const overwriteTemplate = async () => {
    if (!selectedTemplateId) return
    setNotice(null)
    try {
      const values = await form.validateFields()
      await updateTaskTemplate({
        variables: { id: selectedTemplateId, input: values },
      })
      setNotice({ type: 'success', message: '已覆盖所选模板' })
      await refetch()
    } catch (error) {
      if (error?.errorFields) return
      setNotice({ type: 'error', message: error.message })
    }
  }

  const removeTemplate = async (id) => {
    setNotice(null)
    try {
      await deleteTaskTemplate({ variables: { id } })
      if (selectedTemplateId === id) setSelectedTemplateId(null)
      await refetch()
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const toggleNotify = async () => {
    if (typeof Notification === 'undefined') {
      setNotice({ type: 'error', message: '当前浏览器不支持桌面通知' })
      return
    }
    const permission = await Notification.requestPermission()
    setNotifyEnabled(permission === 'granted')
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const batchDispatch = async () => {
    if (!selectedIds.length) return
    if (
      tasks.some(
        (task) => selectedIds.includes(task.id) && task.mode === 'plan'
      )
    ) {
      if (!(await confirmPlanSave())) return
    }
    setNotice(null)
    try {
      await dispatchTasks({
        variables: { ids: selectedIds, tool: dispatchTool },
      })
      setNotice({
        type: 'success',
        message: `批量派发已完成（${dispatchToolLabel}）；请查看任务状态。`,
      })
      setSelectedIds([])
      await refreshTasks()
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const openCreate = (agentSlug = 'main-agent') => {
    setEditing(null)
    form.setFieldsValue({
      title: '',
      brief: '',
      acceptance: '',
      agentSlug,
      priority: 'P1',
      readOnly: false,
      useKnowledge: true,
      mode: 'auto',
    })
    setModalOpen(true)
  }

  // 从岗位档案「用该角色发起任务」跳过来时，直接打开新建抽屉并预选岗位
  useEffect(() => {
    if (!createRequest?.agentSlug) return
    openCreate(createRequest.agentSlug)
    onCreateRequestHandled?.()
  }, [createRequest, onCreateRequestHandled, openCreate])

  const openEdit = (task) => {
    if (['DISPATCHED', 'RUNNING'].includes(task.status)) {
      setNotice({ type: 'error', message: '任务执行中，不能修改需求' })
      return
    }
    setEditing(task)
    form.setFieldsValue({
      title: task.title,
      brief: task.brief,
      acceptance: task.acceptance,
      agentSlug: task.agentSlug,
      priority: task.priority,
      readOnly: task.readOnly,
      useKnowledge: task.useKnowledge !== false,
      mode: task.mode,
    })
    setModalOpen(true)
  }

  const submit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSaving(true)
    setNotice(null)
    try {
      if (editing) {
        await updateTask({ variables: { id: editing.id, input: values } })
        setNotice({
          type: 'success',
          message:
            editing.status === 'DONE' ? '需求已更新，可再次发起' : '任务已更新',
        })
      } else {
        await createTask({ variables: { input: values } })
        setNotice({ type: 'success', message: '任务已创建' })
      }
      setModalOpen(false)
      await refreshTasks()
    } catch (submitError) {
      setNotice({ type: 'error', message: submitError.message })
    } finally {
      setSaving(false)
    }
  }

  // 派发前预检：把"跑完才发现没法验收"提前到派发前
  const confirmPrecheck = async (task) => {
    let precheck
    try {
      const { data } = await runPrecheck({ id: task.id })
      precheck = data?.taskPrecheck
    } catch {
      return true // 预检本身失败不阻塞派发
    }
    if (!precheck?.warnings?.length) return true

    return new Promise((resolve) => {
      Modal.confirm({
        title: `派发前检查到 ${precheck.warnings.length} 个问题`,
        width: 520,
        content: (
          <div>
            <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
              {precheck.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            {precheck.expectedPaths.length > 0 && (
              <p style={{ margin: 0, color: 'var(--muted, #888)' }}>
                验收标准提到的交付物：
                {precheck.expectedPaths.join('、')}
              </p>
            )}
          </div>
        ),
        okText: '仍然派发',
        cancelText: '返回修改',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  }

  const confirmPlanSave = () =>
    new Promise((resolve) =>
      Modal.confirm({
        title: '生成并保存方案',
        content:
          '生成方案会保存方案文件，不会修改业务代码；业务修改需批准方案后执行。',
        okText: '生成方案',
        cancelText: '返回',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    )

  const run = async (task) => {
    setNotice(null)
    // 待验收/失败的任务再次执行＝按新要求重做：直接进抽屉，在那里写修改要求
    if (['AWAITING_REVIEW', 'FAILED', 'DONE'].includes(task.status)) {
      setOpenId(task.id)
      return
    }
    if (task.mode === 'plan' && !(await confirmPlanSave())) return
    if (!(await confirmPrecheck(task))) return
    try {
      const result = await dispatchTask({
        variables: { id: task.id, tool: dispatchTool },
      })
      setNotice({
        type: 'success',
        message:
          result.data?.dispatchTask?.status === 'ENVIRONMENT_BLOCKED'
            ? '环境预检未通过，请在任务详情查看原因后重试。'
            : `已派发「${task.title}」到 ${dispatchToolLabel}`,
      })
      await refreshTasks()
    } catch (dispatchError) {
      setNotice({ type: 'error', message: dispatchError.message })
    }
  }

  // 抽屉里的「确认重新派发」：带上本轮修改要求再次执行
  const redispatch = async (task, note) => {
    if (modalOpen) return
    setNotice(null)
    if (task.mode === 'plan' && !(await confirmPlanSave())) return
    if (!(await confirmPrecheck(task))) return
    try {
      const result = await dispatchTask({
        variables: { id: task.id, tool: dispatchTool, note },
      })
      setNotice({
        type: 'success',
        message:
          result.data?.dispatchTask?.status === 'ENVIRONMENT_BLOCKED'
            ? '环境预检未通过，请在任务详情查看原因后重试。'
            : `已提交「${task.title}」的新一轮执行到 ${dispatchToolLabel}`,
      })
      await refreshTasks()
    } catch (dispatchError) {
      setNotice({ type: 'error', message: dispatchError.message })
    }
  }

  const approvePlan = async (task, tool) => {
    setNotice(null)
    setApproving(true)
    try {
      const result = await executePlan({
        variables: { id: task.id, tool, planPath: task.planPath },
      })
      setNotice({
        type: 'success',
        message:
          result.data?.executeTaskPlan?.status === 'ENVIRONMENT_BLOCKED'
            ? '环境预检未通过，方案和执行请求已保留。'
            : `已按方案开始执行「${task.title}」`,
      })
      await refreshTasks()
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setApproving(false)
    }
  }

  const cancel = async (task) => {
    setNotice(null)
    try {
      await cancelTask({
        variables: {
          id: task.id,
          ...(task.workflow ? { version: task.workflow.version } : {}),
        },
      })
      await refreshTasks()
    } catch (cancelError) {
      setNotice({ type: 'error', message: cancelError.message })
    }
  }

  // 本地已经跑完、页面还停在执行中时，手动让后端按日志/会话重新判定状态
  const refreshState = async (task) => {
    setNotice(null)
    try {
      await refreshTaskMutation({ variables: { id: task.id } })
      await refreshTasks()
      setNotice({ type: 'success', message: '已按最近一次执行重新判定状态' })
    } catch (refreshError) {
      setNotice({ type: 'error', message: refreshError.message })
    }
  }

  const review = async (task, decision, note) => {
    setNotice(null)
    try {
      await reviewTask({ variables: { id: task.id, decision, note } })
      await refreshTasks()
    } catch (reviewError) {
      setNotice({ type: 'error', message: reviewError.message })
    }
  }

  return (
    <section className="workspace-view task-board">
      <div className="page-intro">
        <button
          type="button"
          className="mobile-menu"
          onClick={onOpenSidebar}
          aria-label="打开导航"
        >
          <Menu size={20} />
        </button>
        <div>
          <div className="section-kicker">TASK BOARD</div>
          <h1>任务</h1>
          <p>布置任务、派发给本地 agent 执行，跑完在这里验收。</p>
        </div>
        <Flex gap={8} style={{ marginLeft: 'auto' }} align="center">
          <label className="task-dispatch-tool">
            <span>派发到</span>
            <Select
              aria-label="派发平台"
              value={dispatchTool}
              onChange={selectDispatchTool}
              style={{ minWidth: 150 }}
              options={DISPATCH_TOOLS}
            />
          </label>
          <Select
            allowClear
            placeholder="全部岗位"
            style={{ minWidth: 160 }}
            value={agentFilter}
            onChange={setAgentFilter}
            options={agentOptions}
          />
          <Button
            icon={notifyEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            title={notifyEnabled ? '桌面通知已开启' : '开启桌面通知'}
            onClick={() => void toggleNotify()}
          />
          {selectedIds.length > 0 && (
            <Button
              icon={<Play size={16} />}
              onClick={() => void batchDispatch()}
            >
              派发 {selectedIds.length} 个
            </Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
            新建任务
          </Button>
        </Flex>
      </div>

      <div className="task-board-toolbar">
        <Segmented
          options={TIME_TABS}
          value={timeTab}
          onChange={(value) => {
            setTimeTab(value)
            if (value === 'custom' && !customRange) {
              setCustomRange([dayjs().startOf('day'), dayjs()])
            }
          }}
        />
        {timeTab === 'custom' && (
          <RangePicker
            value={customRange}
            onChange={setCustomRange}
            allowClear={false}
            presets={[
              {
                label: '近 7 天',
                value: [dayjs().subtract(6, 'day'), dayjs()],
              },
              {
                label: '近 30 天',
                value: [dayjs().subtract(29, 'day'), dayjs()],
              },
              {
                label: '上个月',
                value: [
                  dayjs().subtract(1, 'month').startOf('month'),
                  dayjs().subtract(1, 'month').endOf('month'),
                ],
              },
            ]}
          />
        )}
        <span className="task-muted">按创建时间筛选</span>
        {!loading && timeTab !== 'all' && tasks.length === 0 && (
          <span className="task-muted">
            这个时间范围内没有任务，可以切换时间或新建任务。
          </span>
        )}
      </div>

      {notice && (
        <Alert
          style={{ margin: '14px 0' }}
          type={notice.type}
          message={notice.message}
          showIcon
          closable
          onClose={() => setNotice(null)}
        />
      )}
      {workspace?.dirty && (
        <Alert
          style={{ margin: '14px 0' }}
          type="warning"
          showIcon
          message={`工作区有 ${workspace.changedCount} 个未提交改动`}
          description="派发后的产物来自 git 改动对比，可能混入与本次任务无关的文件。"
        />
      )}
      {error && !tasks.length && (
        <Alert type="error" showIcon message="任务列表读取失败。" />
      )}
      {loading && !tasks.length && (
        <p className="task-board-empty">正在读取任务…</p>
      )}

      <div className="task-board-columns">
        {COLUMNS.map((column) => {
          const items = tasks.filter((task) =>
            column.match.includes(task.status)
          )
          return (
            <div className="task-board-column" key={column.key}>
              <div className="task-board-column-head">
                <span>{column.label}</span>
                <b>{items.length}</b>
              </div>
              <div className="task-board-column-body">
                {items.map((task) => (
                  <Card
                    key={task.id}
                    size="small"
                    className="task-card"
                    onClick={() => setOpenId(task.id)}
                  >
                    <div className="task-card-head">
                      <input
                        type="checkbox"
                        className="task-card-select"
                        checked={selectedIds.includes(task.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelect(task.id)}
                        aria-label={`选择 ${task.title}`}
                      />
                      <strong>{task.title}</strong>
                      <Tag
                        color={
                          task.priority === 'P0'
                            ? 'red'
                            : task.priority === 'P1'
                              ? 'orange'
                              : 'default'
                        }
                      >
                        {task.priority}
                      </Tag>
                    </div>
                    <div className="task-card-meta">
                      <span>{agentName(task.agentSlug)}</span>
                      <span>·</span>
                      <span>{STATUS_LABELS[task.status] || task.status}</span>
                      {task.runs[0]?.startedAt && (
                        <span>
                          {formatDuration(
                            task.runs[0].startedAt,
                            task.runs[0].completedAt
                          )}
                        </span>
                      )}
                    </div>
                    <div
                      className="task-card-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {!task.workflow &&
                        !task.confirmation &&
                        !task.blocker &&
                        ['DRAFT', 'FAILED', 'AWAITING_REVIEW', 'DONE'].includes(
                          task.status
                        ) && (
                          <Button
                            size="small"
                            type="primary"
                            icon={<Play size={13} />}
                            onClick={() => run(task)}
                          >
                            {task.status === 'DRAFT'
                              ? '派发'
                              : task.status === 'DONE'
                                ? '再次发起'
                                : '重新派发'}
                          </Button>
                        )}
                      {!task.workflow &&
                        ['DISPATCHED', 'RUNNING', 'QUEUED'].includes(
                          task.status
                        ) && (
                          <Button
                            size="small"
                            icon={<RotateCcw size={13} />}
                            loading={refreshingState}
                            onClick={() => refreshState(task)}
                          >
                            刷新状态
                          </Button>
                        )}
                      {!task.workflow &&
                        ['DISPATCHED', 'RUNNING', 'QUEUED'].includes(
                          task.status
                        ) && (
                          <Popconfirm
                            title="取消这个任务？"
                            okText="取消"
                            cancelText="返回"
                            onConfirm={() => cancel(task)}
                          >
                            <Button size="small" danger icon={<X size={13} />}>
                              取消
                            </Button>
                          </Popconfirm>
                        )}
                      {task.status === 'AWAITING_APPROVAL' && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => {
                            setOpenSection('plan')
                            setOpenId(task.id)
                          }}
                        >
                          审阅方案
                        </Button>
                      )}
                      {!task.workflow && task.confirmation && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => {
                            setOpenSection('runs')
                            setOpenId(task.id)
                          }}
                        >
                          查看待确认事项
                        </Button>
                      )}
                      {task.blocker && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => {
                            setOpenSection('runs')
                            setOpenId(task.id)
                          }}
                        >
                          检查执行环境
                        </Button>
                      )}
                      {!task.workflow &&
                        !task.confirmation &&
                        !task.blocker &&
                        task.status === 'AWAITING_REVIEW' && (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => {
                              if (
                                !task.artifacts.some(
                                  (item) =>
                                    item.lastRunId &&
                                    item.lastRunId === task.runs[0]?.id
                                )
                              ) {
                                setOpenId(task.id)
                                setNotice({
                                  type: 'warning',
                                  message:
                                    '这次执行没有本轮交付：请说明本轮完成内容或沿用了哪些历史产物，再点通过。',
                                })
                                return
                              }
                              review(task, 'APPROVE', task.reviewNote || '')
                            }}
                          >
                            通过
                          </Button>
                        )}
                    </div>
                  </Card>
                ))}
                {!items.length && <p className="task-board-empty">暂无</p>}
              </div>
            </div>
          )
        })}
      </div>

      <Drawer
        open={Boolean(openId)}
        size="var(--drawer-width)"
        onClose={() => setOpenId(null)}
        title={current?.title || '任务详情'}
        destroyOnHidden
      >
        {targetError && <Alert type="error" message={targetError.message} />}
        {!current && !targetError && <p role="status">正在读取任务详情…</p>}
        {current && !targetError && (
          <TaskDetail
            key={`${current.id}:${current.planPath || ''}`}
            task={current}
            initialSection={openSection}
            approving={approving}
            onEdit={() => openEdit(current)}
            onDispatch={() => run(current)}
            onRedispatch={(note) => redispatch(current, note)}
            onCancel={() => cancel(current)}
            onApprove={(tool) => approvePlan(current, tool)}
            onReview={review}
            onChanged={refreshTasks}
            setNotice={setNotice}
          />
        )}
      </Drawer>

      <Drawer
        title={editing ? '编辑任务' : '新建任务'}
        open={modalOpen}
        size="var(--drawer-width)"
        onClose={() => setModalOpen(false)}
        destroyOnHidden
        footer={
          taskKind === 'workflow' && !editing ? null : (
            <Flex justify="flex-end" gap={8}>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button
                type="primary"
                loading={saving}
                onClick={() => void submit()}
              >
                保存
              </Button>
            </Flex>
          )
        }
      >
        {!editing && (
          <Segmented
            aria-label="任务类型"
            value={taskKind}
            onChange={setTaskKind}
            options={[
              { value: 'normal', label: '普通任务' },
              { value: 'workflow', label: '工作流任务' },
            ]}
          />
        )}
        {taskKind === 'workflow' && !editing ? (
          <WorkflowCreator
            onCreated={async (id, message) => {
              setModalOpen(false)
              setOpenId(id)
              setNotice({ type: 'success', message })
              await refreshTasks()
            }}
          />
        ) : (
          <>
            <div className="task-template-bar">
              <Select
                allowClear
                placeholder="从模板开始"
                style={{ minWidth: 200 }}
                value={selectedTemplateId}
                options={templates.map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
                onChange={(value) => {
                  setSelectedTemplateId(value || null)
                  if (value) applyTemplate(value)
                }}
              />
              <Button onClick={() => setTemplateModalOpen(true)}>
                另存为模板
              </Button>
              <Button
                disabled={!selectedTemplateId}
                onClick={() => void overwriteTemplate()}
              >
                覆盖所选模板
              </Button>
              <Button type="link" onClick={() => setManageOpen(true)}>
                管理
              </Button>
            </div>

            <Form form={form} layout="vertical">
              <Form.Item
                name="title"
                label="标题"
                rules={[
                  { required: true, message: '请填写标题' },
                  { max: 120 },
                ]}
              >
                <Input
                  placeholder="例如：重构登录页并补齐空状态"
                  autoComplete="off"
                />
              </Form.Item>
              <Form.Item
                name="brief"
                label="需求"
                rules={[
                  { required: true, message: '请写清楚要做什么' },
                  { max: 4000 },
                ]}
              >
                <MarkdownEditor
                  minRows={4}
                  maxRows={10}
                  placeholder="背景、要做什么、不要做什么（支持 Markdown）"
                />
              </Form.Item>
              <Form.Item
                name="acceptance"
                label="验收标准"
                rules={[{ max: 2000 }]}
              >
                <MarkdownEditor
                  minRows={2}
                  maxRows={6}
                  placeholder="怎样算做完：可验证的检查项（支持 Markdown）"
                />
              </Form.Item>
              <Flex gap={12} align="flex-start">
                <Form.Item
                  name="agentSlug"
                  label="执行岗位"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Select
                    options={agentOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item
                  name="priority"
                  label="优先级"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Select
                    options={[
                      { label: 'P0', value: 'P0' },
                      { label: 'P1', value: 'P1' },
                      { label: 'P2', value: 'P2' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="mode"
                  label="工作方式"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Select
                    options={[
                      { label: '默认（直接执行）', value: 'auto' },
                      { label: '计划（先出方案）', value: 'plan' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="readOnly"
                  label="只读任务"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Select
                    options={[
                      { label: '可改代码', value: false },
                      { label: '只读', value: true },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="useKnowledge"
                  label="外部知识库"
                  style={{ flex: 1, minWidth: 0 }}
                  extra="开启且可用时带知识片段；未配置或不可用时自动忽略"
                >
                  <Select
                    options={[
                      { label: '使用', value: true },
                      { label: '不使用', value: false },
                    ]}
                  />
                </Form.Item>
              </Flex>
            </Form>
          </>
        )}
      </Drawer>

      <Modal
        title="管理模板"
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <div className="task-template-list">
          {!templates.length && (
            <p className="task-board-empty">还没有模板。</p>
          )}
          {templates.map((item) => (
            <div className="task-template-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {agentName(item.agentSlug)} · {item.priority}
                </span>
              </div>
              <Button
                size="small"
                danger
                type="text"
                onClick={() => void removeTemplate(item.id)}
              >
                删除
              </Button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title="另存为模板"
        open={templateModalOpen}
        confirmLoading={templateSaving}
        okText="保存"
        cancelText="取消"
        onOk={() => void saveAsTemplate()}
        onCancel={() => setTemplateModalOpen(false)}
        destroyOnHidden
      >
        <Input
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          placeholder="模板名称，例如：按截图还原页面"
        />
      </Modal>
    </section>
  )
}

const artifactSourceLabel = (source) =>
  source === 'git' ? 'git 改动' : source === 'manual' ? '手动' : '声明'

/** 产物树：目录只显示名字，文件行带类型、来源与操作 */
const decorateArtifactNode = (node, handlers) => ({
  key: node.key,
  selectable: false,
  isLeaf: node.isLeaf,
  title: node.isLeaf ? (
    <span className="task-artifact-node">
      <span className="task-artifact-icon">
        {node.artifact.kind === 'report' ? (
          <FileText size={13} />
        ) : (
          <FileCode2 size={13} />
        )}
      </span>
      <span className="task-artifact-kind">{node.artifact.kind}</span>
      <span className="task-artifact-source">
        {artifactSourceLabel(node.artifact.source)}
      </span>
      <span className="task-artifact-label">{node.artifact.label}</span>
      <code>{node.artifact.path}</code>
      <Tag>{node.artifact.projectName || '未归属项目'}</Tag>
      {!node.artifact.lastRunId && (
        <Tag>
          {node.artifact.source === 'manual' ? '手动登记' : '历史来源未记录'}
        </Tag>
      )}
      {['missing', 'unavailable'].includes(node.artifact.availability) && (
        <Tag color="warning">文件不可用</Tag>
      )}
      <Flex gap={4}>
        <Button size="small" onClick={() => handlers.onOpen(node.artifact)}>
          打开
        </Button>
        <Popconfirm
          title="删除这条产物？"
          okText="删除"
          cancelText="取消"
          onConfirm={() => handlers.onRemove(node.artifact)}
        >
          <Button size="small" danger type="text">
            删除
          </Button>
        </Popconfirm>
      </Flex>
    </span>
  ) : (
    <span className="task-artifact-dir">
      <Folder size={13} />
      {node.title}
    </span>
  ),
  children: node.children?.map((child) =>
    decorateArtifactNode(child, handlers)
  ),
})

const TaskDetail = ({
  task,
  onEdit,
  onDispatch,
  onRedispatch,
  onCancel,
  onApprove,
  onReview,
  onChanged,
  setNotice,
  initialSection = 'brief',
  approving = false,
}) => {
  const [tab, setTab] = useState(
    initialSection === 'runs'
      ? 'runs'
      : initialSection === 'review'
        ? 'artifacts'
        : 'brief'
  )
  const latestRunId = task.runs[0]?.id
  const latestPlatform = task.runs[0]?.platform || 'codex'
  const [reworkNote, setReworkNote] = useState('')
  const [redispatching, setRedispatching] = useState(false)
  useEffect(() => {
    setReworkNote('')
  }, [task.id, latestRunId])
  const [planTool, setPlanTool] = useState(latestPlatform)
  useEffect(() => {
    setPlanTool(latestPlatform)
  }, [latestPlatform])
  useEffect(() => {
    setTab(
      initialSection === 'runs'
        ? 'runs'
        : initialSection === 'review'
          ? 'artifacts'
          : 'brief'
    )
  }, [initialSection])
  const {
    data: planData,
    loading: planLoading,
    error: planError,
  } = useQuery(TASK_PLAN, {
    variables: { taskId: task.id, planPath: task.planPath },
    skip: task.status !== 'AWAITING_APPROVAL' || !task.planPath,
    fetchPolicy: 'network-only',
  })
  const planReady =
    !planLoading && !planError && Boolean(planData?.taskPlanContent?.trim())
  const [note, setNote] = useState('')
  const [artifactScope, setArtifactScope] = useState('all')
  const currentArtifacts = task.artifacts.filter(
    (item) => item.lastRunId && item.lastRunId === task.runs[0]?.id
  )
  const visibleArtifacts =
    artifactScope === 'current'
      ? currentArtifacts
      : artifactScope === 'history'
        ? task.artifacts.filter((item) => !currentArtifacts.includes(item))
        : task.artifacts
  const [artifact, setArtifact] = useState(null)
  const [threadRun, setThreadRun] = useState(null)
  const [logRun, setLogRun] = useState(null)
  const [addArtifactOpen, setAddArtifactOpen] = useState(false)
  const [artifactForm] = Form.useForm()
  const [addArtifact] = useMutation(ADD_TASK_ARTIFACT)
  const [removeArtifact] = useMutation(REMOVE_TASK_ARTIFACT)
  const [revisePlan] = useMutation(REVISE_TASK_PLAN)
  const [planDraft, setPlanDraft] = useState('')
  const [revising, setRevising] = useState(false)
  const { data: logData, loading: logLoading } = useQuery(TASK_RUN_LOG, {
    variables: { runId: logRun?.id },
    skip: !logRun,
    fetchPolicy: 'cache-and-network',
  })
  const { data: threadData, loading: threadLoading } = useQuery(
    TASK_RUN_MESSAGES,
    {
      variables: { runId: threadRun?.id },
      skip: !threadRun,
      fetchPolicy: 'cache-and-network',
      pollInterval: 5_000,
    }
  )
  const threadMessages = threadData?.taskRunMessages || []
  const { data } = useQuery(ARTIFACT_CONTENT, {
    variables: { id: artifact?.id },
    skip: !artifact || artifact.kind === 'url',
    fetchPolicy: 'cache-and-network',
  })

  const openArtifact = (item) => {
    if (item.kind === 'url') {
      window.open(item.path, '_blank', 'noopener,noreferrer')
      return
    }
    setArtifact(item)
  }

  return (
    <div className="task-detail">
      <Flex gap={6} wrap style={{ marginBottom: 12 }}>
        <Tag color="blue">{agentName(task.agentSlug)}</Tag>
        <Tag>{task.priority}</Tag>
        <Tag>{STATUS_LABELS[task.status] || task.status}</Tag>
        {task.readOnly && <Tag>只读</Tag>}
        {task.useKnowledge === false && <Tag>不检索知识库</Tag>}
        <Tag>{task.runs.length} 次执行</Tag>
      </Flex>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'brief', label: '需求' },
          { key: 'runs', label: '执行记录' },
          { key: 'artifacts', label: `产物 ${task.artifacts.length}` },
        ]}
      />

      {task.workflow && <WorkflowPanel task={task} onChanged={onChanged} />}
      {!task.workflow && (
        <TaskEnvironmentPanel
          task={task}
          onChanged={onChanged}
          setNotice={setNotice}
        />
      )}

      {!task.workflow && (task.blocker || tab === 'artifacts') && (
        <KnowledgePublisher
          key={task.id}
          taskId={task.id}
          artifacts={task.artifacts}
        />
      )}

      {!task.workflow && task.confirmation && (
        <TaskConfirmation
          task={task}
          onChanged={onChanged}
          setNotice={setNotice}
        />
      )}

      {task.status === 'AWAITING_APPROVAL' && (
        <div className="task-plan-box">
          <div className="task-plan-head">
            <span>方案待确认</span>
            {task.planPath && <code>{task.planPath}</code>}
          </div>
          <p>
            生成平台：{task.runs[0]?.platform || '未记录'}；版本：
            {task.planPath || '无有效方案'}
          </p>
          {planLoading && <p role="status">正在读取方案…</p>}
          {planError && <Alert type="error" message={planError.message} />}
          {!planLoading && !planReady && !planError && (
            <Alert type="warning" message="无有效方案正文，请重新生成方案。" />
          )}
          {planReady && <MarkdownDocument content={planData.taskPlanContent} />}
          <Select
            aria-label="方案执行平台"
            value={planTool}
            onChange={setPlanTool}
            options={[
              { value: 'codex', label: 'Codex' },
              { value: 'deepseek-harness', label: 'DeepSeek Harness' },
            ]}
          />
          {task.planNote && (
            <p className="task-plan-last">上一版修正意见：{task.planNote}</p>
          )}
          <MarkdownEditor
            value={planDraft}
            onChange={setPlanDraft}
            placeholder="哪里要改？例如：范围缩小到登录页、去掉数据库迁移、补一节回滚方案"
            minRows={3}
            maxRows={8}
          />
          <div className="task-plan-actions">
            <Button
              loading={revising}
              disabled={!planDraft.trim() || approving}
              onClick={async () => {
                setRevising(true)
                try {
                  await revisePlan({
                    variables: {
                      id: task.id,
                      note: planDraft.trim(),
                      tool: planTool,
                    },
                  })
                  setPlanDraft('')
                  await onChanged()
                } catch (error) {
                  setNotice({ type: 'error', message: error.message })
                } finally {
                  setRevising(false)
                }
              }}
            >
              按意见重写方案
            </Button>
            <Button
              type="primary"
              icon={<Play size={14} />}
              disabled={!planReady || revising}
              loading={approving}
              onClick={() => onApprove(planTool)}
            >
              批准并执行
            </Button>
          </div>
        </div>
      )}

      {tab === 'brief' && (
        <div className="task-brief">
          <h4>需求</h4>
          <p>{task.brief}</p>
          <h4>验收标准</h4>
          <p>{task.acceptance || '（未填写）'}</p>
          {['DONE', 'AWAITING_REVIEW'].includes(task.status) &&
            !task.artifacts.length && (
              <p className="task-board-empty">
                这张卡片没有任何产物：验收标准里要求的交付物如果不在产物列表中，请先补充产物或打回重做。
              </p>
            )}
          {task.reviewNote && (
            <>
              <h4>最近一次结论</h4>
              <p>{task.reviewNote}</p>
            </>
          )}
          <p className="task-muted">创建 {formatTime(task.createdAt)}</p>
        </div>
      )}

      {tab === 'runs' && (
        <div className="task-runs">
          {!task.runs.length && (
            <p className="task-board-empty">还没有执行记录。</p>
          )}
          {task.runs.map((run) => (
            <div className="task-run" key={run.id}>
              <div className="task-run-head">
                <strong>{STATUS_LABELS[run.status] || run.status}</strong>
                <span>{run.platform}</span>
                <span>{formatDuration(run.startedAt, run.completedAt)}</span>
                {(run.inputTokens || run.outputTokens) && (
                  <span className="task-run-tokens">
                    {formatTokens(run.inputTokens) || '0'} in ·{' '}
                    {formatTokens(run.outputTokens) || '0'} out
                    {run.cachedTokens
                      ? ` · ${formatTokens(run.cachedTokens)} cached`
                      : ''}
                  </span>
                )}
              </div>
              {run.externalReference?.includes(':') && (
                <p className="task-muted">
                  会话：
                  {run.externalReference.split(':').slice(2).join(':') ||
                    '未关联'}
                </p>
              )}
              <ol className="task-run-events">
                {run.events.map((event) => (
                  <li key={event.id}>
                    <time>{formatTime(event.createdAt)}</time>
                    <span>{event.summary || event.eventType}</span>
                  </li>
                ))}
              </ol>
              <TaskKnowledge taskId={task.id} runId={run.id} />
            </div>
          ))}
        </div>
      )}

      {tab === 'artifacts' && (
        <div className="task-artifacts">
          <p>所属项目：{task.runs[0]?.projectName || '未归属项目'}</p>
          {task.runs[0]?.continuationStatus && (
            <p className="task-board-hint">{task.runs[0].continuationStatus}</p>
          )}
          <p className="task-board-hint">
            产物指向工作区当前文件，历史内容版本不在此保存。
          </p>
          <Segmented
            value={artifactScope}
            onChange={setArtifactScope}
            options={[
              { value: 'all', label: `全部产物 ${task.artifacts.length}` },
              {
                value: 'current',
                label: `本轮交付 ${currentArtifacts.length}`,
              },
              {
                value: 'history',
                label: `历史产物 ${task.artifacts.length - currentArtifacts.length}`,
              },
            ]}
          />
          <div className="task-artifact-toolbar">
            <Button
              size="small"
              icon={<Plus size={13} />}
              onClick={() => setAddArtifactOpen(true)}
            >
              添加产物
            </Button>
          </div>
          {!task.artifacts.length && (
            <p className="task-board-empty">还没有产物。</p>
          )}
          {task.artifacts.length > 0 && !visibleArtifacts.length && (
            <p className="task-board-empty">当前分类没有产物。</p>
          )}
          {visibleArtifacts.length > 0 && (
            <Tree
              className="task-artifact-tree"
              blockNode
              showLine={{ showLeafIcon: false }}
              defaultExpandAll
              selectable={false}
              treeData={buildArtifactTree(visibleArtifacts).map((node) =>
                decorateArtifactNode(node, {
                  onOpen: openArtifact,
                  onRemove: async (item) => {
                    await removeArtifact({ variables: { id: item.id } })
                    await onChanged()
                  },
                })
              )}
            />
          )}
        </div>
      )}

      <div className="task-detail-actions">
        {!task.workflow && ['DRAFT', 'CANCELLED'].includes(task.status) && (
          <Button type="primary" icon={<Play size={14} />} onClick={onDispatch}>
            派发执行
          </Button>
        )}
        {(task.workflow
          ? !['COMPLETED', 'CANCELLED'].includes(task.workflow.status)
          : [
              'DISPATCHED',
              'RUNNING',
              'QUEUED',
              'WAITING_CONFIRMATION',
              'ENVIRONMENT_BLOCKED',
            ].includes(task.status)) && (
          <Button danger icon={<X size={14} />} onClick={onCancel}>
            取消
          </Button>
        )}
        <Button
          onClick={onEdit}
          disabled={
            Boolean(task.workflow) ||
            ['DISPATCHED', 'RUNNING', 'QUEUED'].includes(task.status)
          }
        >
          编辑
        </Button>
      </div>

      {!task.workflow &&
        !task.confirmation &&
        !task.blocker &&
        ['AWAITING_REVIEW', 'FAILED', 'DONE'].includes(task.status) && (
          <div className="task-redispatch">
            <h4>{task.status === 'DONE' ? '再次发起' : '重新派发'}</h4>
            <p className="task-board-hint">
              复用历史结果、上下文和已有产物；本轮修改要求独立保存，留空则沿用已保存需求。当前工作模式：
              {task.mode === 'plan' ? '重新生成方案，批准后实施' : '直接执行'}
              {task.readOnly ? '；只读' : ''}。
            </p>
            <Input.TextArea
              aria-label="本轮修改要求"
              value={reworkNote}
              onChange={(event) => setReworkNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="本轮修改要求（可留空沿用原需求）"
            />
            <div className="task-redispatch-actions">
              <Button
                type="primary"
                icon={<Play size={14} />}
                loading={redispatching}
                onClick={async () => {
                  setRedispatching(true)
                  try {
                    await onRedispatch?.(reworkNote)
                  } finally {
                    setRedispatching(false)
                  }
                }}
              >
                {task.status === 'DONE' ? '确认再次发起' : '确认重新派发'}
              </Button>
            </div>
          </div>
        )}

      {!task.workflow &&
        !task.confirmation &&
        !task.blocker &&
        task.status === 'AWAITING_REVIEW' && (
          <div className="task-review">
            <h4>验收任务</h4>
            {!currentArtifacts.length && (
              <p className="task-board-empty">
                这次执行没有本轮交付；请说明完成内容、交付物在哪或沿用了哪些历史产物。
              </p>
            )}
            <MarkdownEditor
              value={note}
              onChange={setNote}
              minRows={2}
              maxRows={4}
              placeholder={
                currentArtifacts.length
                  ? '验收结论（打回时必填，支持 Markdown）'
                  : '验收结论（无本轮交付时必填：说明本轮完成内容或沿用成果）'
              }
            />
            <Flex gap={8}>
              <Button
                type="primary"
                disabled={!currentArtifacts.length && !note.trim()}
                onClick={() => onReview(task, 'APPROVE', note)}
              >
                通过
              </Button>
              <Button onClick={() => onReview(task, 'REJECT', note)}>
                打回
              </Button>
            </Flex>
          </div>
        )}

      <Modal
        open={Boolean(threadRun)}
        onCancel={() => setThreadRun(null)}
        footer={null}
        width={880}
        title="执行会话"
        destroyOnHidden
      >
        {threadLoading && !threadMessages.length && (
          <p className="task-board-empty">正在读取会话…</p>
        )}
        {!threadLoading && !threadMessages.length && (
          <p className="task-board-empty">还没有读到会话消息。</p>
        )}
        <div className="eval-thread-list">
          {threadMessages.map((message, index) => (
            <div
              key={`${message.createdAt}-${index}`}
              className={`eval-bubble ${message.role}`}
            >
              <div className="eval-bubble-meta">
                {message.role === 'user' ? '我' : 'Agent'} ·{' '}
                {formatTime(message.createdAt)}
              </div>
              <div className="eval-bubble-body">{message.content}</div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title="添加产物"
        open={addArtifactOpen}
        okText="添加"
        cancelText="取消"
        onCancel={() => setAddArtifactOpen(false)}
        onOk={async () => {
          try {
            const values = await artifactForm.validateFields()
            await addArtifact({
              variables: { taskId: task.id, input: values },
            })
            setAddArtifactOpen(false)
            artifactForm.resetFields()
            await onChanged()
          } catch {
            // 校验失败保持弹窗
          }
        }}
        destroyOnHidden
      >
        <Form form={artifactForm} layout="vertical">
          <Form.Item
            name="path"
            label="路径或链接"
            rules={[{ required: true, message: '请填写路径' }]}
          >
            <Input placeholder="docs/reports/x.md 或 https://example.com" />
          </Form.Item>
          <Form.Item name="label" label="名称">
            <Input placeholder="留空则用文件名" />
          </Form.Item>
          <Form.Item name="kind" label="类型" initialValue="file">
            <Select
              options={[
                { label: '文件', value: 'file' },
                { label: '目录', value: 'dir' },
                { label: '链接', value: 'url' },
                { label: '报告', value: 'report' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(logRun)}
        onCancel={() => setLogRun(null)}
        footer={null}
        width={960}
        title={`执行日志${logRun?.logPath ? ` · ${logRun.logPath}` : ''}`}
        destroyOnHidden
      >
        {logLoading && !logData && (
          <p className="task-board-empty">正在读取日志…</p>
        )}
        <pre className="md-source task-log">{logData?.taskRunLog || ''}</pre>
      </Modal>

      <Modal
        open={Boolean(artifact)}
        onCancel={() => setArtifact(null)}
        footer={null}
        className="artifact-preview-modal"
        width="min(1180px, 94vw)"
        style={{ top: 28 }}
        title={artifact?.label}
        destroyOnHidden
      >
        {artifact?.kind === 'report' || isMarkdownPath(artifact?.path) ? (
          <MarkdownDocument content={data?.taskArtifactContent || ''} />
        ) : languageForPath(artifact?.path) ? (
          <CodePreview
            content={data?.taskArtifactContent || ''}
            language={languageForPath(artifact?.path)}
          />
        ) : (
          <pre className="md-source">
            {data?.taskArtifactContent || '读取中…'}
          </pre>
        )}
      </Modal>
    </div>
  )
}

export default TaskBoard

function TaskEnvironmentPanel({ task, onChanged, setNotice }) {
  const { data, error, loading, refetch } = useQuery(TASK_PRECHECK, {
    variables: { id: task.id },
    fetchPolicy: 'network-only',
  })
  const [retry] = useMutation(RETRY_TASK_ENVIRONMENT)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const environment = data?.taskPrecheck?.environment
  const resume = async () => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      const result = await retry({ variables: { id: task.id } })
      setNotice({
        type: 'info',
        message:
          result.data?.retryTaskEnvironment?.status === 'ENVIRONMENT_BLOCKED'
            ? '环境检查仍未通过，请先处理下面的阻塞项。'
            : '已提交环境修复后的重试；岗位忙碌时会排队。',
      })
      await Promise.all([refetch(), onChanged()])
    } catch (failure) {
      setNotice({ type: 'error', message: failure.message })
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <section className="task-plan-box" aria-label="执行环境预检">
      <h4>执行环境预检</h4>
      {task.blocker && (
        <Alert
          type="error"
          title="环境阻塞，等待修复"
          description={task.blocker.prompt}
        />
      )}
      {loading && <p role="status">正在检查服务连接与目标目录…</p>}
      {error && (
        <Alert
          type="error"
          title="预检暂时无法完成"
          description="请重新检查；执行前服务端仍会再次校验。"
        />
      )}
      {environment && (
        <ul>
          {environment.checks.map((check) => (
            <li key={check.key}>
              <Tag
                color={
                  check.status === 'PASS'
                    ? 'green'
                    : check.status === 'BLOCKED'
                      ? 'red'
                      : 'gold'
                }
              >
                {check.status === 'PASS'
                  ? '通过'
                  : check.status === 'BLOCKED'
                    ? '阻塞'
                    : '需注意'}
              </Tag>
              <strong>{check.label}</strong>：{check.detail}
              {check.remedy && <p>{check.remedy}</p>}
            </li>
          ))}
        </ul>
      )}
      <Flex gap={8}>
        <Button loading={loading} onClick={() => refetch().catch(() => {})}>
          重新检查环境
        </Button>
        {task.blocker && (
          <Button
            type="primary"
            disabled={!environment?.ready || loading || Boolean(error)}
            loading={busy}
            onClick={resume}
          >
            环境已修复，重试
          </Button>
        )}
      </Flex>
      {task.blocker && environment?.ready && (
        <p className="task-board-hint">
          服务端检查已通过。请先处理上次执行报告的沙箱或权限问题，再重试；本次不会扩大原执行权限。
        </p>
      )}
    </section>
  )
}

function TaskConfirmation({ task, onChanged, setNotice }) {
  const [note, setNote] = useState('')
  const [confirm, { loading }] = useMutation(CONFIRM_TASK_CONTINUATION)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [submittedRunId, setSubmittedRunId] = useState(null)
  const request = task.confirmation
  useEffect(() => {
    setNote('')
  }, [request.runId])
  const submit = async () => {
    if (submittingRef.current || submittedRunId === request.runId) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const result = await confirm({
        variables: { id: task.id, runId: request.runId, note: note.trim() },
      })
      setSubmittedRunId(request.runId)
      setNotice({
        type: 'success',
        message:
          result.data?.confirmTaskContinuation?.status === 'ENVIRONMENT_BLOCKED'
            ? '确认已保存，环境预检未通过，请修复后从环境重试入口继续。'
            : '已确认并提交继续执行；岗位忙碌时会排队。',
      })
      await onChanged()
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }
  return (
    <section className="task-plan-box" aria-label="人工确认">
      <h4>等待人工确认</h4>
      <Alert type="warning" title={request.prompt} />
      <p>
        请核对上面的操作对象和影响，再确认继续。需要补充配置或目标信息时，请填写确认意见。
      </p>
      <Input.TextArea
        aria-label="确认意见"
        placeholder="补充目标、配置说明或允许执行的范围（可选）"
        value={note}
        maxLength={1500}
        rows={3}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="task-board-hint">
        确认后会携带本轮结果和历史产物发起下一轮。原只读与沙箱权限保持不变；宿主机权限问题仍需在运行环境处理。
      </p>
      <Button
        type="primary"
        icon={<Play size={14} />}
        loading={loading || submitting}
        disabled={submittedRunId === request.runId}
        onClick={submit}
      >
        确认并继续
      </Button>
    </section>
  )
}
