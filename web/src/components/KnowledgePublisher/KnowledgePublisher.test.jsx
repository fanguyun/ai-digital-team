import { fireEvent, render, screen, waitFor } from '@cedarjs/testing/web'
import { useMutation, useQuery } from '@cedarjs/web'

import KnowledgePublisher from './KnowledgePublisher'

jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  useMutation: jest.fn(),
  useQuery: jest.fn(),
}))
jest.mock('src/components/MarkdownDocument/MarkdownDocument', () => ({
  __esModule: true,
  default: ({ content }) => <pre>{content}</pre>,
}))

const notebookId = '20261123095000-box1234'
let records
let targets
let mutations
const snapshot = {
  id: 'pub-1',
  title: 'AI报告',
  markdown: '# 已保存正文',
  contentHash: 'snapshot-hash',
  notebookId,
  documentPath: '/团队/AI/AI报告',
  status: 'PREPARED',
}
const originalMessageChannel = global.MessageChannel
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.MessageChannel = class {
    port1 = { onmessage: null }
    port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }
  }
})
afterAll(() => {
  global.MessageChannel = originalMessageChannel
})
beforeEach(() => {
  records = []
  targets = {
    available: true,
    notebooks: [{ id: notebookId, name: '团队笔记本' }],
    pathPrefixes: ['团队/AI'],
  }
  mutations = {
    PrepareKnowledgePublication: jest
      .fn()
      .mockResolvedValue({ data: { prepareKnowledgePublication: snapshot } }),
    PublishKnowledgePublication: jest.fn().mockResolvedValue({
      data: {
        publishKnowledgePublication: {
          ...snapshot,
          status: 'VERIFIED',
          documentUrl: 'siyuan://blocks/20261123095000-doc1234',
        },
      },
    }),
  }
  useQuery.mockImplementation((query) => ({
    data:
      query.definitions[0].name.value === 'KnowledgePublicationTargets'
        ? { knowledgePublicationTargets: targets }
        : { knowledgePublications: records },
    refetch: jest.fn().mockResolvedValue({}),
  }))
  useMutation.mockImplementation((query) => [
    mutations[query.definitions[0].name.value],
    {},
  ])
})

it('prepares pasted content then requires an explicit snapshot confirmation before external writing', async () => {
  render(<KnowledgePublisher taskId="task-1" />)
  fireEvent.click(screen.getByRole('button', { name: '将文档写入知识库' }))
  fireEvent.change(screen.getByLabelText('文档标题'), {
    target: { value: 'AI报告' },
  })
  fireEvent.change(screen.getByLabelText('Markdown 正文'), {
    target: { value: '# 已保存正文' },
  })
  fireEvent.change(screen.getByLabelText('目标目录'), {
    target: { value: '/团队/AI' },
  })
  fireEvent.mouseDown(screen.getByRole('combobox', { name: '目标笔记本' }))
  fireEvent.click(
    await screen.findByText('团队笔记本', {
      selector: '.ant-select-item-option-content',
    })
  )
  fireEvent.click(screen.getByRole('button', { name: '预览待入库文档' }))
  expect(
    await screen.findByRole('button', { name: '确认写入思源并回读验证' })
  ).toBeInTheDocument()
  expect(screen.getByText('# 已保存正文')).toBeInTheDocument()
  expect(mutations.PublishKnowledgePublication).not.toHaveBeenCalled()
  expect(mutations.PrepareKnowledgePublication).toHaveBeenCalledWith({
    variables: {
      input: {
        taskId: 'task-1',
        artifactId: null,
        title: 'AI报告',
        markdown: '# 已保存正文',
        notebookId,
        directory: '/团队/AI',
      },
    },
  })
  fireEvent.click(
    screen.getByRole('button', { name: '确认写入思源并回读验证' })
  )
  await waitFor(() =>
    expect(mutations.PublishKnowledgePublication).toHaveBeenCalledWith({
      variables: { id: 'pub-1', contentHash: 'snapshot-hash' },
    })
  )
  expect(
    await screen.findByRole('link', { name: '在思源中打开已验证文档' })
  ).toHaveAttribute('href', 'siyuan://blocks/20261123095000-doc1234')
})

it('disables preparation when the knowledge source is not available', async () => {
  targets = {
    available: false,
    reason: '检索桥暂不支持文档入库',
    notebooks: [],
  }
  render(<KnowledgePublisher />)
  fireEvent.click(screen.getByRole('button', { name: '将文档写入知识库' }))
  expect(await screen.findByText('检索桥暂不支持文档入库')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '预览待入库文档' })).toBeDisabled()
})

it('resumes the persisted snapshot and prevents duplicate confirmations while submitting', async () => {
  records = [{ ...snapshot, status: 'UNCERTAIN', error: '上次请求超时' }]
  let rejectFirst
  mutations.PublishKnowledgePublication.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectFirst = reject
      })
  )
  render(<KnowledgePublisher taskId="task-1" />)
  fireEvent.click(screen.getByRole('button', { name: '查看并继续' }))
  const retry = await screen.findByRole('button', {
    name: '重试核对（避免重复创建）',
  })
  fireEvent.click(retry)
  fireEvent.click(retry)
  expect(mutations.PublishKnowledgePublication).toHaveBeenCalledTimes(1)
  rejectFirst(new Error('网络暂不可用'))
  expect(await screen.findByText('网络暂不可用')).toBeInTheDocument()
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  await waitFor(() =>
    expect(mutations.PublishKnowledgePublication).toHaveBeenCalledTimes(2)
  )
})
