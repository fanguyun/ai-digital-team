import { fireEvent, render, screen, waitFor } from '@cedarjs/testing/web'
import { useMutation, useQuery } from '@cedarjs/web'

import WorkflowCreator from './WorkflowCreator'
import WorkflowPanel from './WorkflowPanel'

jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  useMutation: jest.fn(),
  useQuery: jest.fn(),
}))
jest.mock('src/components/KnowledgePublisher/KnowledgePublisher', () => ({
  __esModule: true,
  default: ({ workflowArtifactId, readOnly }) => (
    <div data-testid="publisher">
      {workflowArtifactId}:{readOnly ? '只读' : '待确认'}
    </div>
  ),
}))
jest.mock('src/components/MarkdownDocument/MarkdownDocument', () => ({
  __esModule: true,
  default: ({ content }) => <pre>{content}</pre>,
}))
const names = [
  '整理研究任务',
  '资料收集',
  '报告成稿',
  '独立核验',
  '预览与确认',
  '入库与回读',
]
let mutations
const originalMessageChannel = global.MessageChannel
beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }))
  global.MessageChannel = class {
    port1 = { onmessage: null }
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }
  }
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterAll(() => {
  global.MessageChannel = originalMessageChannel
})
beforeEach(() => {
  mutations = {
    CreateWorkflowTask: jest.fn().mockResolvedValue({
      data: { createWorkflowTask: { id: 'task', workflow: { version: 1 } } },
    }),
    StartWorkflow: jest
      .fn()
      .mockResolvedValue({ data: { startWorkflow: { id: 'task' } } }),
    RetryWorkflowStep: jest
      .fn()
      .mockResolvedValue({ data: { retryWorkflowStep: { id: 'task' } } }),
  }
  useQuery.mockReturnValue({
    data: {
      workflowTemplates: [
        {
          key: 'research-knowledge',
          name: '资料研究与知识沉淀',
          version: 1,
          steps: names.map((name) => ({ name, agentSlug: 'main-agent' })),
        },
      ],
    },
  })
  useMutation.mockImplementation((query) => [
    mutations[query.definitions[0].name.value],
    {},
  ])
})
const fill = () => {
  fireEvent.change(screen.getByLabelText('研究主题'), {
    target: { value: '工作流研究' },
  })
  fireEvent.change(screen.getByLabelText('研究问题'), {
    target: { value: '串行工作流的用途' },
  })
  fireEvent.change(screen.getByLabelText('范围与时效要求'), {
    target: { value: '本年官方资料' },
  })
}
const task = (status = 'WAITING_CONFIRMATION') => ({
  id: 'task',
  artifacts: [{ id: 'report', path: 'docs/report.md' }],
  workflow: {
    status,
    version: 7,
    templateVersion: 1,
    reworkCount: 1,
    currentStep: 4,
    input: { sourceMode: 'knowledge-web' },
    steps: names.map((name, ordinal) => ({
      id: `s-${ordinal}`,
      name,
      ordinal,
      agentSlug: 'main-agent',
      status: ordinal < 4 ? 'COMPLETED' : 'PENDING',
      attemptCount: ordinal < 4 ? 1 : 0,
      attempts:
        ordinal < 4
          ? [
              {
                id: `a-${ordinal}`,
                number: 1,
                status: 'COMPLETED',
                startedAt: '2026-11-24T07:00:00Z',
                artifactId: ordinal === 2 ? 'report' : null,
                output: {
                  markdown: '正文',
                  ...(ordinal === 3 ? { verdict: 'PASS' } : {}),
                },
              },
            ]
          : [],
    })),
  },
})

it('保存工作流草稿不启动执行，展示固定六步', async () => {
  const created = jest.fn()
  render(<WorkflowCreator onCreated={created} />)
  names.forEach((name) => expect(screen.getByText(name)).toBeInTheDocument())
  fill()
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))
  await waitFor(() =>
    expect(created).toHaveBeenCalledWith('task', '工作流草稿已保存')
  )
  expect(mutations.StartWorkflow).not.toHaveBeenCalled()
})
it('重复点击启动只创建一次，启动失败保留已有草稿', async () => {
  mutations.StartWorkflow.mockRejectedValueOnce(new Error('平台不可用'))
  const created = jest.fn()
  render(<WorkflowCreator onCreated={created} />)
  fill()
  const start = screen.getByRole('button', { name: '确认范围并启动' })
  fireEvent.click(start)
  fireEvent.click(start)
  await waitFor(() =>
    expect(created).toHaveBeenCalledWith(
      'task',
      expect.stringContaining('草稿已保存；启动未完成')
    )
  )
  expect(mutations.CreateWorkflowTask).toHaveBeenCalledTimes(1)
  expect(mutations.StartWorkflow).toHaveBeenCalledWith({
    variables: { taskId: 'task', version: 1, tool: 'codex' },
  })
})
it('核验通过只显示当前报告的人工入库入口，不自动写入', () => {
  render(<WorkflowPanel task={task()} onChanged={jest.fn()} />)
  expect(screen.getByTestId('publisher')).toHaveTextContent('report:待确认')
  expect(mutations.StartWorkflow).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('button', { name: '通过验收' })
  ).not.toBeInTheDocument()
})
it('核验未通过不展示入库按钮，历史尝试仍可查看', () => {
  const data = task('REVIEW_FAILED')
  data.workflow.currentStep = 3
  data.workflow.steps[3].attempts[0].output.verdict = 'REWORK'
  render(<WorkflowPanel task={data} onChanged={jest.fn()} />)
  expect(screen.queryByTestId('publisher')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('独立核验 · 1次尝试'))
  expect(screen.getByText(/Token：输入 未采集/)).toBeInTheDocument()
})
it('失败步骤重试携带当前版本，不创建顶层运行', async () => {
  const data = task('FAILED')
  data.workflow.currentStep = 2
  const changed = jest.fn()
  render(<WorkflowPanel task={data} onChanged={changed} />)
  fireEvent.change(screen.getByLabelText('工作流补充或返工意见'), {
    target: { value: '环境已修复' },
  })
  fireEvent.click(screen.getByRole('button', { name: '补充后重试当前步骤' }))
  await waitFor(() => expect(changed).toHaveBeenCalled())
  expect(mutations.RetryWorkflowStep).toHaveBeenCalledWith({
    variables: {
      taskId: 'task',
      version: 7,
      note: '环境已修复',
      sourceMode: 'knowledge-web',
      target: null,
    },
  })
  expect(mutations.CreateWorkflowTask).not.toHaveBeenCalled()
})
it('已取消工作流只允许查看与核对已有入库', () => {
  render(<WorkflowPanel task={task('CANCELLED')} onChanged={jest.fn()} />)
  expect(screen.getByTestId('publisher')).toHaveTextContent('report:只读')
  expect(
    screen.queryByRole('button', { name: '补充后重试当前步骤' })
  ).not.toBeInTheDocument()
})
