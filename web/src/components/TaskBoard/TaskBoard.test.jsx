import { fireEvent, render, screen, waitFor } from '@cedarjs/testing/web'
import { useMutation, useQuery } from '@cedarjs/web'

import TaskBoard from './TaskBoard'

jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}))
jest.mock('src/components/MarkdownDocument/MarkdownDocument', () => ({
  __esModule: true,
  default: ({ content }) => <div>{content}</div>,
}))
jest.mock('src/components/MarkdownEditor/MarkdownEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }) => (
    <textarea
      aria-label="修订意见"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

const initialSelectedTask = {
  id: 'filtered-out',
  title: '筛选范围以外的任务',
  brief: '需求正文',
  acceptance: '明确验收',
  status: 'AWAITING_APPROVAL',
  mode: 'plan',
  agentSlug: 'main-agent',
  priority: 'P1',
  planPath: 'docs/plans/task/run.md',
  readOnly: true,
  artifacts: [],
  runs: [
    {
      id: 'run-1',
      platform: 'deepseek-harness',
      events: [],
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
    },
  ],
}
let selectedTask
let planResult
let mutations
let environmentResult
const originalResizeObserver = global.ResizeObserver

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterAll(() => {
  global.ResizeObserver = originalResizeObserver
})

beforeEach(() => {
  selectedTask = { ...initialSelectedTask }
  planResult = {
    data: { taskPlanContent: '# 完整方案\n实施步骤、验收、风险与回滚' },
  }
  mutations = {}
  environmentResult = { data: {} }
  useQuery.mockImplementation((query, options) => {
    const operation = query.definitions[0].name.value
    const refetch = jest.fn().mockResolvedValue({ data: {} })
    if (operation === 'Tasks') return { data: { tasks: [] }, refetch }
    if (operation === 'ActionTask')
      return {
        data: options.skip ? undefined : { task: selectedTask },
        refetch,
      }
    if (operation === 'ApprovalPlan') return { ...planResult, refetch }
    if (operation === 'TaskPrecheck') return { ...environmentResult, refetch }
    return { data: {}, refetch }
  })
  useMutation.mockImplementation((query) => {
    const operation = query.definitions[0].name.value
    mutations[operation] ||= jest.fn().mockResolvedValue({ data: {} })
    return [mutations[operation], {}]
  })
})

const openTask = () =>
  render(
    <TaskBoard
      openRequest={{ taskId: selectedTask.id, section: 'plan' }}
      onOpenRequestHandled={jest.fn()}
    />
  )

it('shows the environment blocker and remedy while disabling retry until checks pass', async () => {
  selectedTask = {
    ...selectedTask,
    status: 'ENVIRONMENT_BLOCKED',
    blocker: { prompt: '沙箱无法访问服务' },
  }
  environmentResult = {
    data: {
      taskPrecheck: {
        environment: {
          ready: false,
          checks: [
            {
              key: 'runtime',
              label: '团队 API',
              status: 'BLOCKED',
              detail: '连接失败',
              remedy: '请启动API服务',
            },
          ],
        },
      },
    },
  }
  openTask()
  expect(await screen.findByText('沙箱无法访问服务')).toBeInTheDocument()
  expect(screen.getByText('请启动API服务')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '环境已修复，重试' })
  ).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: '确认并继续' })
  ).not.toBeInTheDocument()
})

it('prevents repeated environment retry and allows retry again after a submission error', async () => {
  selectedTask = {
    ...selectedTask,
    status: 'ENVIRONMENT_BLOCKED',
    blocker: { prompt: '原环境问题' },
  }
  environmentResult = {
    data: { taskPrecheck: { environment: { ready: true, checks: [] } } },
  }
  let rejectFirst
  mutations.RetryTaskEnvironment = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject
        })
    )
    .mockResolvedValue({ data: { retryTaskEnvironment: { status: 'QUEUED' } } })
  openTask()
  const button = await screen.findByRole('button', { name: '环境已修复，重试' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(mutations.RetryTaskEnvironment).toHaveBeenCalledTimes(1)
  rejectFirst(new Error('重试提交失败'))
  expect(await screen.findByText('重试提交失败')).toBeInTheDocument()
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  await waitFor(() =>
    expect(mutations.RetryTaskEnvironment).toHaveBeenCalledTimes(2)
  )
  expect(mutations.RetryTaskEnvironment).toHaveBeenLastCalledWith({
    variables: { id: selectedTask.id },
  })
})

it('shows the pending request on the runs tab and confirms exactly that run with user input', async () => {
  selectedTask = {
    ...selectedTask,
    status: 'WAITING_CONFIRMATION',
    confirmation: { runId: 'run-1', prompt: '确认将文档写入笔记本A' },
  }
  render(
    <TaskBoard openRequest={{ taskId: selectedTask.id, section: 'runs' }} />
  )
  expect(await screen.findByText('确认将文档写入笔记本A')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: '确认意见' }), {
    target: { value: '只写入A' },
  })
  fireEvent.click(screen.getByRole('button', { name: '确认并继续' }))
  await waitFor(() =>
    expect(mutations.ConfirmTaskContinuation).toHaveBeenCalledWith({
      variables: { id: selectedTask.id, runId: 'run-1', note: '只写入A' },
    })
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /确认并继续/ })).toBeDisabled()
  )
  expect(
    screen.queryByRole('button', { name: '确认重新派发' })
  ).not.toBeInTheDocument()
})

it('also provides confirmation for historical COMPLETED runs still awaiting review', async () => {
  selectedTask = {
    ...selectedTask,
    status: 'AWAITING_REVIEW',
    confirmation: { runId: 'run-1', prompt: '请确认写入范围' },
  }
  openTask()
  expect(
    await screen.findByRole('button', { name: '确认并继续' })
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: '确认重新派发' })
  ).not.toBeInTheDocument()
})

it('prevents rapid repeat confirmation and lets a failed submission be retried', async () => {
  selectedTask = {
    ...selectedTask,
    status: 'WAITING_CONFIRMATION',
    confirmation: { runId: 'run-1', prompt: '请确认写入范围' },
  }
  let rejectFirst
  mutations.ConfirmTaskContinuation = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject
        })
    )
    .mockResolvedValue({ data: {} })
  openTask()
  const button = await screen.findByRole('button', { name: '确认并继续' })
  fireEvent.change(screen.getByRole('textbox', { name: '确认意见' }), {
    target: { value: '只写入A' },
  })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(mutations.ConfirmTaskContinuation).toHaveBeenCalledTimes(1)
  rejectFirst(new Error('请重试确认'))
  expect(await screen.findByText('请重试确认')).toBeInTheDocument()
  await waitFor(() => expect(button).toBeEnabled())
  expect(screen.getByRole('textbox', { name: '确认意见' })).toHaveValue(
    '只写入A'
  )
  fireEvent.click(button)
  await waitFor(() =>
    expect(mutations.ConfirmTaskContinuation).toHaveBeenCalledTimes(2)
  )
  expect(mutations.ConfirmTaskContinuation).toHaveBeenLastCalledWith({
    variables: { id: selectedTask.id, runId: 'run-1', note: '只写入A' },
  })
})

it('loads a task outside the board filter and approves with its last platform', async () => {
  openTask()
  expect(
    await screen.findByText('# 完整方案\n实施步骤、验收、风险与回滚', {
      collapseWhitespace: false,
    })
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '批准并执行' }))
  await waitFor(() =>
    expect(mutations.ExecuteTaskPlan).toHaveBeenCalledWith({
      variables: {
        id: selectedTask.id,
        tool: 'deepseek-harness',
        planPath: selectedTask.planPath,
      },
    })
  )
})

it.each([
  { loading: true },
  { error: new Error('方案读取失败') },
  { data: { taskPlanContent: '' } },
])(
  'disables approval while the full plan cannot be read: %p',
  async (response) => {
    planResult = response
    openTask()
    expect(
      await screen.findByRole('button', { name: '批准并执行' })
    ).toBeDisabled()
    expect(mutations.ExecuteTaskPlan).not.toHaveBeenCalled()
  }
)

it('submits a revision with the inherited platform', async () => {
  openTask()
  fireEvent.change(await screen.findByLabelText('修订意见'), {
    target: { value: '补充回滚条件' },
  })
  fireEvent.click(screen.getByRole('button', { name: '按意见重写方案' }))
  await waitFor(() =>
    expect(mutations.ReviseTaskPlan).toHaveBeenCalledWith({
      variables: {
        id: selectedTask.id,
        tool: 'deepseek-harness',
        note: '补充回滚条件',
      },
    })
  )
})

it('re-dispatches with the remembered platform and the rework note', async () => {
  window.localStorage.setItem('pdt.taskDispatch.tool', 'deepseek-harness')
  const failed = {
    ...selectedTask,
    id: 'task-dispatch',
    title: '待重做任务',
    status: 'FAILED',
    mode: 'auto',
    planPath: null,
  }

  useQuery.mockImplementation((query, options) => {
    const operation = query.definitions[0].name.value
    const refetch = jest.fn().mockResolvedValue({ data: {} })
    if (operation === 'Tasks') return { data: { tasks: [failed] }, refetch }
    return { data: options?.skip ? undefined : {}, refetch }
  })

  render(<TaskBoard />)
  fireEvent.click(await screen.findByRole('button', { name: '重新派发' }))

  fireEvent.change(await screen.findByLabelText('本轮修改要求'), {
    target: { value: '补上失败回退方案' },
  })
  fireEvent.click(screen.getByRole('button', { name: '确认重新派发' }))

  await waitFor(() =>
    expect(mutations.DispatchTask).toHaveBeenCalledWith({
      variables: {
        id: 'task-dispatch',
        tool: 'deepseek-harness',
        note: '补上失败回退方案',
      },
    })
  )
  window.localStorage.removeItem('pdt.taskDispatch.tool')
})

it('keeps the plain dispatch label for draft tasks', async () => {
  const draft = {
    ...selectedTask,
    id: 'task-draft',
    status: 'DRAFT',
    mode: 'auto',
    planPath: null,
  }

  useQuery.mockImplementation((query, options) => {
    const operation = query.definitions[0].name.value
    const refetch = jest.fn().mockResolvedValue({ data: {} })
    if (operation === 'Tasks') return { data: { tasks: [draft] }, refetch }
    return { data: options?.skip ? undefined : {}, refetch }
  })

  render(<TaskBoard />)
  expect(
    await screen.findByRole('button', { name: '派发' })
  ).toBeInTheDocument()
})

it('shows artifacts as a directory tree in the drawer', async () => {
  const withArtifacts = {
    ...selectedTask,
    id: 'task-artifacts',
    status: 'AWAITING_REVIEW',
    planPath: null,
    artifacts: [
      {
        id: 'a1',
        kind: 'file',
        source: 'git',
        path: 'api/src/lib/knowledgeConfig.ts',
        label: 'knowledgeConfig.ts',
      },
      {
        id: 'a2',
        kind: 'file',
        source: 'git',
        path: 'api/src/lib/knowledgeRetrieval.ts',
        label: 'knowledgeRetrieval.ts',
      },
      {
        id: 'a3',
        kind: 'report',
        source: 'git',
        path: 'docs/plans/run.md',
        label: '执行方案',
      },
    ],
  }

  useQuery.mockImplementation((query, options) => {
    const operation = query.definitions[0].name.value
    const refetch = jest.fn().mockResolvedValue({ data: {} })
    if (operation === 'Tasks')
      return { data: { tasks: [withArtifacts] }, refetch }
    if (operation === 'ActionTask')
      return {
        data: options.skip ? undefined : { task: withArtifacts },
        refetch,
      }
    return { data: {}, refetch }
  })

  render(<TaskBoard />)
  fireEvent.click(await screen.findByText(withArtifacts.title))
  fireEvent.click(await screen.findByText('产物 3'))

  expect(await screen.findByText('knowledgeConfig.ts')).toBeInTheDocument()
  expect(screen.getByText('knowledgeRetrieval.ts')).toBeInTheDocument()
  expect(screen.getByText('api')).toBeInTheDocument()
  expect(screen.getByText('docs')).toBeInTheDocument()
})

it('relaunches a completed task with this round note and retains historical artifacts', async () => {
  selectedTask = {
    ...selectedTask,
    status: 'DONE',
    mode: 'auto',
    reviewNote: '旧验收通过',
    artifacts: [
      {
        id: 'artifact-old',
        path: 'docs/old.md',
        label: '历史报告',
        kind: 'report',
        source: 'item',
        lastRunId: 'old-run',
        availability: 'missing',
      },
    ],
  }
  openTask()
  const note = await screen.findByRole('textbox', { name: '本轮修改要求' })
  expect(note).toHaveValue('')
  fireEvent.change(note, { target: { value: '继续修改报告' } })
  fireEvent.click(screen.getByRole('button', { name: '确认再次发起' }))
  await waitFor(() =>
    expect(mutations.DispatchTask).toHaveBeenCalledWith({
      variables: {
        id: selectedTask.id,
        tool: expect.any(String),
        note: '继续修改报告',
      },
    })
  )
})

it.each(['DISPATCHED', 'RUNNING', 'QUEUED'])(
  'prevents editing executing inputs in %s',
  async (status) => {
    selectedTask = { ...selectedTask, status }
    openTask()
    expect(
      await screen.findByRole('button', { name: /编\s*辑/ })
    ).toBeDisabled()
    expect(
      screen.queryByRole('textbox', { name: '本轮修改要求' })
    ).not.toBeInTheDocument()
  }
)

it('shows project, round ownership and missing history without treating it as this round delivery', async () => {
  selectedTask = {
    ...selectedTask,
    status: 'AWAITING_REVIEW',
    mode: 'auto',
    runs: [
      {
        ...selectedTask.runs[0],
        projectName: '个人数字团队',
        continuationStatus: '历史会话不可用，已使用摘要续接',
      },
    ],
    artifacts: [
      {
        id: 'artifact-old',
        path: 'docs/old.md',
        label: '历史报告',
        kind: 'report',
        source: 'item',
        lastRunId: 'old-run',
        availability: 'missing',
      },
    ],
  }
  render(
    <TaskBoard
      openRequest={{ taskId: selectedTask.id, section: 'review' }}
      onOpenRequestHandled={jest.fn()}
    />
  )
  expect(await screen.findByText('所属项目：个人数字团队')).toBeInTheDocument()
  expect(screen.getByText('历史会话不可用，已使用摘要续接')).toBeInTheDocument()
  expect(screen.getByText('历史产物 1')).toBeInTheDocument()
  expect(screen.getByText('本轮交付 0')).toBeInTheDocument()
  expect(screen.getByText('文件不可用')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^通\s*过$/ })).toBeDisabled()
})
