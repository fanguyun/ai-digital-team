import { taskRunKnowledge } from 'src/services/taskKnowledge/taskKnowledge'

import { db } from './db'
import { sessionIdFromLog } from './roleEvaluationSessions'
import { readSessionTurnTrace } from './sessionTrace'
import { parseTaskRunOutput } from './taskOutput'

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  existsSync: jest.fn(() => true),
  realpathSync: (value: string) => value,
}))
jest.mock('src/lib/roleEvaluationSessions', () => ({
  ...jest.requireActual('src/lib/roleEvaluationSessions'),
  sessionIdFromLog: jest.fn(),
}))
jest.mock('src/lib/taskOutput', () => ({ parseTaskRunOutput: jest.fn() }))

jest.mock('src/lib/db', () => ({ db: { taskRun: { findFirst: jest.fn() } } }))
jest.mock('src/lib/roleEvaluationDispatch', () => ({
  resolveRepoRoot: () => '/repo',
}))
jest.mock('src/lib/sessionTrace', () => ({
  ...jest.requireActual('src/lib/sessionTrace'),
  readSessionTurnTrace: jest.fn(),
}))
const session = { context: { currentUser: { id: 'user' } } }
beforeEach(() => jest.clearAllMocks())

it('prefers the session ID recorded by this run over a discovered unrelated session', async () => {
  jest.mocked(db.taskRun.findFirst).mockResolvedValue({
    events: [],
    platform: 'codex',
    externalReference: 'task:run:unrelated-session',
    logPath: 'docs/tasks/logs/run.log',
  } as never)
  jest.mocked(sessionIdFromLog).mockReturnValue('exact-session')
  jest
    .mocked(parseTaskRunOutput)
    .mockReturnValue({ completed: true, finalText: '结果' } as never)
  jest.mocked(readSessionTurnTrace).mockResolvedValue({ messages: [] } as never)
  await taskRunKnowledge({ taskId: 'task', runId: 'run' }, session)
  expect(readSessionTurnTrace).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: 'exact-session',
      limits: expect.objectContaining({ messageChars: 60_000 }),
    })
  )
})

it('requires authentication before reading a run or its session', async () => {
  await expect(
    taskRunKnowledge({ taskId: 'task', runId: 'run' })
  ).rejects.toThrow('请先登录')
  expect(db.taskRun.findFirst).not.toHaveBeenCalled()
})

it('checks task membership before reading any trace', async () => {
  jest.mocked(db.taskRun.findFirst).mockResolvedValue(null)
  await expect(
    taskRunKnowledge({ taskId: 'task', runId: 'other' }, session)
  ).rejects.toThrow('不匹配')
  expect(db.taskRun.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'other', taskId: 'task' } })
  )
  expect(readSessionTurnTrace).not.toHaveBeenCalled()
})

it('returns old missing evidence explicitly without making up sources', async () => {
  jest.mocked(db.taskRun.findFirst).mockResolvedValue({
    events: [],
    externalReference: '',
    logPath: null,
  } as never)
  expect(
    await taskRunKnowledge({ taskId: 'task', runId: 'run' }, session)
  ).toMatchObject({ status: 'not_recorded', sources: [] })
})

it('preserves recorded retrieval failures for the page', async () => {
  jest.mocked(db.taskRun.findFirst).mockResolvedValue({
    events: [
      {
        eventType: 'task.dispatch_failed',
        evidence: {
          knowledge: {
            status: 'source_unavailable',
            mode: 'required',
            sources: [],
          },
        },
      },
    ],
    externalReference: '',
    logPath: null,
  } as never)
  expect(
    await taskRunKnowledge({ taskId: 'task', runId: 'run' }, session)
  ).toMatchObject({
    status: 'source_unavailable',
    mode: 'required',
    sources: [],
  })
})
