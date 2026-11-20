import { fireEvent, render, screen } from '@cedarjs/testing/web'

import ActionCenter from './ActionCenter'
import { buildActionCenterModel } from './actionItems'

it.each([
  ['AWAITING_APPROVAL', '审阅方案', 'plan'],
  ['AWAITING_REVIEW', '验收成果', 'review'],
  ['FAILED', '查看失败原因', 'runs'],
])('opens the exact %s task and section', (status, label, section) => {
  const onNavigate = jest.fn()
  const model = buildActionCenterModel({
    tasks: [
      {
        id: 'outside-board-filter',
        title: '指定任务',
        agentSlug: 'main-agent',
        priority: 'P1',
        status,
        updatedAt: new Date().toISOString(),
      },
    ],
  })
  render(<ActionCenter model={model} onNavigate={onNavigate} />)
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(onNavigate).toHaveBeenCalledWith('tasks', {
    taskId: 'outside-board-filter',
    section,
  })
})

jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  // 默认给一个可用的 mutation，行内操作用例再按调用顺序覆盖
  useMutation: jest.fn(() => [jest.fn().mockResolvedValue({ data: {} }), {}]),
}))

describe('inline actions', () => {
  // antd Modal 依赖 ResizeObserver，jsdom 没有
  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  const { useMutation } = require('@cedarjs/web')

  const mockMutations = () => {
    const plan = jest.fn().mockResolvedValue({ data: {} })
    const review = jest.fn().mockResolvedValue({ data: {} })
    const refresh = jest.fn().mockResolvedValue({ data: {} })
    // 组件按固定顺序调用三次 useMutation：执行方案 / 验收 / 刷新运行；
    // 用取模而不是一次性的队列，避免 StrictMode 二次渲染把顺序打乱
    const order = [plan, review, refresh]
    let index = 0
    useMutation.mockReset()
    useMutation.mockImplementation(() => {
      const mutation = order[index % order.length]
      index += 1
      return [mutation, {}]
    })
    return { plan, review, refresh }
  }

  const task = (overrides) => ({
    id: 'task-1',
    title: '示例任务',
    agentSlug: 'main-agent',
    priority: 'P1',
    updatedAt: new Date().toISOString(),
    runs: [{ summary: '完成', platform: 'codex' }],
    artifacts: [],
    ...overrides,
  })

  it('批准方案直接调用执行接口', async () => {
    const { plan } = mockMutations()
    const model = buildActionCenterModel({
      tasks: [
        task({
          status: 'AWAITING_APPROVAL',
          planPath: 'docs/plans/task-1/run-1.md',
        }),
      ],
    })

    render(<ActionCenter model={model} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '批准并执行' }))

    await screen.findByText('已批准方案并开始执行')
    expect(plan).toHaveBeenCalledWith({
      variables: {
        id: 'task-1',
        tool: 'codex',
        planPath: 'docs/plans/task-1/run-1.md',
      },
    })
  })

  it('有产物的任务一键通过验收', async () => {
    const { review } = mockMutations()
    const model = buildActionCenterModel({
      tasks: [
        task({
          status: 'AWAITING_REVIEW',
          artifacts: [{ id: 'artifact-1' }],
        }),
      ],
    })

    render(<ActionCenter model={model} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '通过' }))

    await screen.findByText('已通过验收')
    expect(review).toHaveBeenCalledWith({
      variables: { id: 'task-1', decision: 'APPROVE', note: '' },
    })
  })

  it('没有产物时通过验收需要先写交付物位置', async () => {
    const { review } = mockMutations()
    const model = buildActionCenterModel({
      tasks: [task({ status: 'AWAITING_REVIEW', artifacts: [] })],
    })

    render(<ActionCenter model={model} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '通过' }))

    const confirm = await screen.findByRole('button', { name: '确认通过' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('交付物位置说明'), {
      target: { value: '交付物是 git 改动' },
    })
    fireEvent.click(confirm)

    await screen.findByText('已通过验收')
    expect(review).toHaveBeenCalledWith({
      variables: {
        id: 'task-1',
        decision: 'APPROVE',
        note: '交付物是 git 改动',
      },
    })
  })

  it('打回必须填写原因', async () => {
    const { review } = mockMutations()
    const model = buildActionCenterModel({
      tasks: [task({ status: 'AWAITING_REVIEW', artifacts: [{ id: 'a' }] })],
    })

    render(<ActionCenter model={model} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '打回' }))

    const confirm = await screen.findByRole('button', { name: '确认打回' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('打回原因'), {
      target: { value: '缺少验证说明' },
    })
    fireEvent.click(confirm)

    await screen.findByText('已打回任务')
    expect(review).toHaveBeenCalledWith({
      variables: {
        id: 'task-1',
        decision: 'REJECT',
        note: '缺少验证说明',
      },
    })
  })

  it('长时间未更新的运行可以就地刷新状态', async () => {
    const { refresh } = mockMutations()
    const now = new Date()
    const model = buildActionCenterModel({
      now,
      taskRuns: [
        {
          id: 'run-1',
          status: 'RUNNING',
          primaryAgent: 'main-agent',
          taskId: null,
          updatedAt: new Date(now.getTime() - 60 * 60 * 1000),
        },
      ],
    })

    render(<ActionCenter model={model} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '刷新状态' }))

    await screen.findByText('已按最近一次执行刷新状态')
    expect(refresh).toHaveBeenCalledWith({ variables: { runId: 'run-1' } })
  })
})
