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

const selectedTask = {
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
let planResult
let mutations
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
  planResult = {
    data: { taskPlanContent: '# 完整方案\n实施步骤、验收、风险与回滚' },
  }
  mutations = {}
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
