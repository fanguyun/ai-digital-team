import { fireEvent, render, screen } from '@cedarjs/testing/web'
import { useQuery } from '@cedarjs/web'

import TaskKnowledge from './TaskKnowledge'

jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  useQuery: jest.fn(),
}))
const source = {
  citation: '[KB-1]',
  documentId: 'doc',
  blockId: 'block',
  title: '长期主义',
  content: '长期方向需要近期反馈。',
  contentHash: 'hash',
  documentPath: '/笔记',
  retrievedAt: '2026-11-24T00:00:00Z',
  sourceUri: 'siyuan://blocks/20261124114528-q4huiws',
  citationStatus: 'marker_and_link',
}
const open = () => {
  render(<TaskKnowledge taskId="task" runId="run" />)
  fireEvent.click(screen.getByRole('button', { name: '查看知识库引用' }))
}
beforeEach(() =>
  useQuery.mockReturnValue({
    data: {
      taskRunKnowledge: {
        status: 'hit',
        sources: [source],
        unknownCitations: [],
        elapsedMs: 5,
      },
    },
  })
)

it('loads on demand and shows retrieved evidence separately from answer citation checks', () => {
  open()
  expect(useQuery.mock.calls[0][1].skip).toBe(true)
  expect(useQuery.mock.calls.at(-1)[1].skip).toBe(false)
  expect(screen.getByText('长期方向需要近期反馈。')).toBeInTheDocument()
  expect(screen.getByText('回答已标注引用及来源链接')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: '在思源中打开来源 [KB-1]' })
  ).toHaveAttribute('href', source.sourceUri)
  expect(screen.getByText(/事实是否得到片段支持仍需验收/)).toBeInTheDocument()
})
it.each(['empty', 'timeout', 'source_unavailable'])(
  'explains %s without fabricating a source',
  (status) => {
    useQuery.mockReturnValue({
      data: { taskRunKnowledge: { status, sources: [], unknownCitations: [] } },
    })
    open()
    expect(screen.getByText(/本轮没有可用的知识库来源/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  }
)
it('labels missing snapshots and unrecognized answer references', () => {
  useQuery.mockReturnValue({
    data: {
      taskRunKnowledge: {
        status: 'hit',
        sources: [{ ...source, content: null, citationStatus: 'not_marked' }],
        unknownCitations: ['[KB-9]'],
      },
    },
  })
  open()
  expect(screen.getByText('已提供给模型，回答未标注引用')).toBeInTheDocument()
  expect(screen.getByText(/原始片段快照不可用/)).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('[KB-9]')
})
