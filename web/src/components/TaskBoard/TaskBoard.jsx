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
  Popconfirm,
  Select,
  Tabs,
  Tag,
  notification,
} from 'antd'
import {
  Bell,
  BellOff,
  Menu,
  Play,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react'

import { useMutation, useQuery } from '@cedarjs/web'

import MarkdownDocument from 'src/components/MarkdownDocument/MarkdownDocument'
import MarkdownEditor from 'src/components/MarkdownEditor/MarkdownEditor'

import agentManifest from '../../../../agents/manifest.json'

const TASKS_QUERY = gql`
  query Tasks($status: String, $agentSlug: String) {
    tasks(status: $status, agentSlug: $agentSlug) {
      id
      title
      brief
      acceptance
      agentSlug
      priority
      status
      readOnly
      mode
      planPath
      planNote
      dueAt
      createdAt
      updatedAt
      completedAt
      reviewNote
      reviewedAt
      artifacts {
        id
        kind
        source
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
  mutation DispatchTask($id: ID!, $tool: String) {
    dispatchTask(id: $id, tool: $tool) {
      id
      status
    }
  }
`

const CANCEL_TASK = gql`
  mutation CancelTask($id: ID!) {
    cancelTask(id: $id) {
      id
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
  mutation ExecuteTaskPlan($id: ID!, $tool: String) {
    executeTaskPlan(id: $id, tool: $tool) {
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
    match: ['AWAITING_REVIEW', 'AWAITING_APPROVAL'],
  },
  { key: 'done', label: '已完成', match: ['DONE'] },
  { key: 'closed', label: '失败 / 取消', match: ['FAILED', 'CANCELLED'] },
]

const STATUS_LABELS = {
  DRAFT: '待派发',
  DISPATCHED: '已派发',
  RUNNING: '执行中',
  QUEUED: '排队中',
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

const TaskBoard = ({ onOpenSidebar, initialAgentFilter = null }) => {
  const { data, loading, error, refetch } = useQuery(TASKS_QUERY, {
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
  const [reviewTask] = useMutation(REVIEW_TASK)

  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [openId, setOpenId] = useState(null)
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

  const current = tasks.find((item) => item.id === openId) || null

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
    setNotice(null)
    try {
      await dispatchTasks({ variables: { ids: selectedIds, tool: 'codex' } })
      setNotice({
        type: 'success',
        message: `已派发 ${selectedIds.length} 个任务（同岗位自动排队）`,
      })
      setSelectedIds([])
      await refetch()
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      title: '',
      brief: '',
      acceptance: '',
      agentSlug: 'main-agent',
      priority: 'P1',
      readOnly: false,
      mode: 'auto',
    })
    setModalOpen(true)
  }

  const openEdit = (task) => {
    if (task.status === 'RUNNING') {
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
        setNotice({ type: 'success', message: '任务已更新' })
      } else {
        await createTask({ variables: { input: values } })
        setNotice({ type: 'success', message: '任务已创建' })
      }
      setModalOpen(false)
      await refetch()
    } catch (submitError) {
      setNotice({ type: 'error', message: submitError.message })
    } finally {
      setSaving(false)
    }
  }

  const run = async (task) => {
    setNotice(null)
    try {
      await dispatchTask({ variables: { id: task.id, tool: 'codex' } })
      setNotice({ type: 'success', message: `已派发「${task.title}」` })
      await refetch()
    } catch (dispatchError) {
      setNotice({ type: 'error', message: dispatchError.message })
    }
  }

  const approvePlan = async (task) => {
    setNotice(null)
    try {
      await executePlan({ variables: { id: task.id, tool: 'codex' } })
      setNotice({
        type: 'success',
        message: `已按方案开始执行「${task.title}」`,
      })
      await refetch()
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }

  const cancel = async (task) => {
    setNotice(null)
    try {
      await cancelTask({ variables: { id: task.id } })
      await refetch()
    } catch (cancelError) {
      setNotice({ type: 'error', message: cancelError.message })
    }
  }

  const review = async (task, decision, note) => {
    setNotice(null)
    try {
      await reviewTask({ variables: { id: task.id, decision, note } })
      await refetch()
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
                      {['DRAFT', 'FAILED', 'AWAITING_REVIEW'].includes(
                        task.status
                      ) && (
                        <Button
                          size="small"
                          type="primary"
                          icon={<Play size={13} />}
                          onClick={() => run(task)}
                        >
                          派发
                        </Button>
                      )}
                      {['DISPATCHED', 'RUNNING', 'QUEUED'].includes(
                        task.status
                      ) && (
                        <Popconfirm
                          title="取消这个任务？"
                          okText="取消"
                          cancelText="返回"
                          onConfirm={() => cancel(task)}
                        >
                          <Button
                            size="small"
                            danger
                            type="text"
                            icon={<X size={13} />}
                          >
                            取消
                          </Button>
                        </Popconfirm>
                      )}
                      {task.status === 'AWAITING_APPROVAL' && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => approvePlan(task)}
                        >
                          批准并执行
                        </Button>
                      )}
                      {task.status === 'AWAITING_REVIEW' && (
                        <Button
                          size="small"
                          onClick={() =>
                            review(task, 'APPROVE', task.reviewNote || '')
                          }
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
        open={Boolean(current)}
        size="var(--drawer-width)"
        onClose={() => setOpenId(null)}
        title={current?.title || '任务详情'}
        destroyOnHidden
      >
        {current && (
          <TaskDetail
            task={current}
            onEdit={() => openEdit(current)}
            onDispatch={() => run(current)}
            onCancel={() => cancel(current)}
            onApprove={() => approvePlan(current)}
            onReview={review}
            onChanged={refetch}
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
        }
      >
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
          <Button onClick={() => setTemplateModalOpen(true)}>另存为模板</Button>
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
            rules={[{ required: true, message: '请填写标题' }, { max: 120 }]}
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
          <Form.Item name="acceptance" label="验收标准" rules={[{ max: 2000 }]}>
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
          </Flex>
        </Form>
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

const TaskDetail = ({
  task,
  onEdit,
  onDispatch,
  onCancel,
  onApprove,
  onReview,
  onChanged,
  setNotice,
}) => {
  const [tab, setTab] = useState('brief')
  const [note, setNote] = useState(task.reviewNote || '')
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

      {task.status === 'AWAITING_APPROVAL' && (
        <div className="task-plan-box">
          <div className="task-plan-head">
            <span>方案待确认</span>
            {task.planPath && <code>{task.planPath}</code>}
          </div>
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
              disabled={!planDraft.trim()}
              onClick={async () => {
                setRevising(true)
                try {
                  await revisePlan({
                    variables: {
                      id: task.id,
                      note: planDraft.trim(),
                      tool: 'codex',
                    },
                  })
                  setPlanDraft('')
                  await onChanged()
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
              onClick={onApprove}
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
            </div>
          ))}
        </div>
      )}

      {tab === 'artifacts' && (
        <div className="task-artifacts">
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
          {task.artifacts.map((item) => (
            <div className="task-artifact" key={item.id}>
              <span className="task-artifact-kind">{item.kind}</span>
              <span className="task-artifact-source">
                {item.source === 'git'
                  ? 'git 改动'
                  : item.source === 'manual'
                    ? '手动'
                    : '声明'}
              </span>
              <span className="task-artifact-label">{item.label}</span>
              <code>{item.path}</code>
              <Flex gap={4}>
                <Button size="small" onClick={() => openArtifact(item)}>
                  打开
                </Button>
                <Popconfirm
                  title="删除这条产物？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={async () => {
                    await removeArtifact({ variables: { id: item.id } })
                    await onChanged()
                  }}
                >
                  <Button size="small" danger type="text">
                    删除
                  </Button>
                </Popconfirm>
              </Flex>
            </div>
          ))}
        </div>
      )}

      <div className="task-detail-actions">
        {['DRAFT', 'FAILED', 'AWAITING_REVIEW', 'CANCELLED'].includes(
          task.status
        ) && (
          <Button type="primary" icon={<Play size={14} />} onClick={onDispatch}>
            {task.status === 'AWAITING_REVIEW' ? '打回重跑' : '派发执行'}
          </Button>
        )}
        {['DISPATCHED', 'RUNNING'].includes(task.status) && (
          <Button danger icon={<X size={14} />} onClick={onCancel}>
            取消
          </Button>
        )}
        <Button onClick={onEdit} disabled={task.status === 'RUNNING'}>
          编辑
        </Button>
      </div>

      {task.status === 'AWAITING_REVIEW' && (
        <div className="task-review">
          <MarkdownEditor
            value={note}
            onChange={setNote}
            minRows={2}
            maxRows={4}
            placeholder="验收结论（打回时必填，支持 Markdown）"
          />
          <Flex gap={8}>
            <Button
              type="primary"
              onClick={() => onReview(task, 'APPROVE', note)}
            >
              通过
            </Button>
            <Button onClick={() => onReview(task, 'REJECT', note)}>打回</Button>
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
        width={880}
        title={artifact?.label}
        destroyOnHidden
      >
        {artifact?.kind === 'report' ? (
          <MarkdownDocument content={data?.taskArtifactContent || ''} />
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
