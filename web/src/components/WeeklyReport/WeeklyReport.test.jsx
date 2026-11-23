import { render, screen } from '@cedarjs/testing/web'
import { useQuery } from '@cedarjs/web'

import WeeklyReport from './WeeklyReport'

jest.mock('@cedarjs/web', () => ({
  ...jest.requireActual('@cedarjs/web'),
  useQuery: jest.fn(),
}))

jest.mock('src/components/TaskDetail/TaskDetail', () => ({
  TaskDetail: () => null,
}))

const zero = { files: 0, added: 0, removed: 0 }
const report = {
  headline: '统计结果',
  totalTasks: 3,
  completedTasks: 2,
  failedTasks: 0,
  pendingTasks: 0,
  totalTokens: 0,
  totalTokenCoverage: 'NONE',
  contributions: [],
  completed: [],
  failures: [],
  pending: [],
  delivery: {
    files: 2,
    added: 10,
    removed: 1,
    coveredRuns: 2,
    totalRuns: 3,
    byProject: [
      {
        projectKey: 'digital-team',
        projectName: '个人数字团队',
        files: 2,
        added: 10,
        removed: 1,
        coveredRuns: 1,
        totalRuns: 1,
        byDirectory: [{ directory: 'api', files: 1, added: 8, removed: 1 }],
        uncategorized: { files: 1, added: 2, removed: 0 },
      },
      {
        projectKey: null,
        projectName: '未归属项目',
        ...zero,
        coveredRuns: 1,
        totalRuns: 2,
        byDirectory: [],
        uncategorized: zero,
      },
    ],
  },
}

it('groups delivery by project, keeps directories, and labels cumulative statistics and missing coverage', () => {
  useQuery.mockReturnValue({ data: { teamWeeklyReport: report } })
  render(<WeeklyReport />)
  expect(screen.getByText(/个人数字团队 · 2 个文件/)).toBeInTheDocument()
  expect(screen.getByText(/未归属项目 · 0 个文件/)).toBeInTheDocument()
  expect(screen.getByText('api/')).toBeInTheDocument()
  expect(screen.getByText('根目录文件')).toBeInTheDocument()
  expect(screen.getByText(/已采集且没有变化/)).toBeInTheDocument()
  expect(screen.getByText(/按运行累计/)).toBeInTheDocument()
})

it('displays unavailable statistics separately from measured zero changes', () => {
  useQuery.mockReturnValue({
    data: {
      teamWeeklyReport: {
        ...report,
        delivery: { ...report.delivery, coveredRuns: 0 },
      },
    },
  })
  render(<WeeklyReport />)
  expect(screen.getAllByText('未采集').length).toBeGreaterThan(0)
  expect(screen.getByText(/尚未采集交付统计/)).toBeInTheDocument()
})
