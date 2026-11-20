import { createHash } from 'node:crypto'

import { spawnTaskAgent } from 'src/lib/agentDispatch'
import { db } from 'src/lib/db'
import {
  retrieveKnowledge,
  type KnowledgeResult,
} from 'src/lib/knowledgeRetrieval'
import { dispatchTask } from 'src/services/tasks/tasks'

jest.mock('src/lib/db', () => ({
  db: {
    task: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    taskRun: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    taskEvent: { create: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}))
jest.mock('src/lib/knowledgeRetrieval', () => ({
  ...jest.requireActual('src/lib/knowledgeRetrieval'),
  retrieveKnowledge: jest.fn(),
}))
jest.mock('src/lib/agentDispatch', () => ({
  ...jest.requireActual('src/lib/agentDispatch'),
  spawnTaskAgent: jest.fn(),
}))
jest.mock('src/lib/taskWorkspace', () => ({
  snapshotWorkspace: async () => ({}),
  snapshotDiffStat: async () => ({}),
}))
jest.mock('src/services/taskImages/taskImages', () => ({
  resolveTaskImages: async () => [],
}))

const mockedDb = db as unknown as {
  task: {
    findUnique: jest.Mock
    findUniqueOrThrow: jest.Mock
    findFirst: jest.Mock
    updateMany: jest.Mock
  }
  taskRun: { findMany: jest.Mock; create: jest.Mock; updateMany: jest.Mock }
  taskEvent: { create: jest.Mock }
  $transaction: jest.Mock
}
const disabled: KnowledgeResult = {
  status: 'disabled',
  mode: 'optional',
  items: [],
  elapsedMs: 0,
}
const hit: KnowledgeResult = {
  status: 'hit',
  mode: 'required',
  elapsedMs: 5,
  items: [
    {
      blockId: '20261120000000-aaaaaaa',
      documentId: '20261120000000-bbbbbbb',
      notebookId: '20261120000000-ccccccc',
      title: '共享规范',
      documentPath: '/共享规范',
      content: '上线须确认',
      sourceUpdatedAt: null,
      retrievedAt: '2026-11-20T00:00:00.000Z',
      sourceUri: 'siyuan://blocks/20261120000000-aaaaaaa',
      contentHash: createHash('sha256').update('上线须确认').digest('hex'),
      rankingMethod: 'keyword-hit-count-v1',
    },
  ],
}

describe('knowledge dispatch orchestration (mocked database, not PostgreSQL concurrency)', () => {
  let inTransaction: boolean
  beforeEach(() => {
    jest.clearAllMocks()
    inTransaction = false
    const row = {
      id: 'task-id',
      title: '核验上线规范',
      brief: '按规范检查',
      acceptance: '',
      agentSlug: 'main-agent',
      status: 'DRAFT',
      mode: 'auto',
      readOnly: true,
      updatedAt: new Date(0),
      runs: [],
      artifacts: [],
      planPath: null,
    }
    mockedDb.task.findUnique.mockResolvedValue(row)
    mockedDb.task.findUniqueOrThrow.mockResolvedValue(row)
    mockedDb.task.findFirst.mockResolvedValue({ id: row.id })
    mockedDb.task.updateMany.mockResolvedValue({ count: 1 })
    mockedDb.taskRun.findMany.mockResolvedValue([])
    mockedDb.taskRun.create.mockResolvedValue({ id: 'run-id' })
    mockedDb.taskRun.updateMany.mockResolvedValue({ count: 1 })
    mockedDb.taskEvent.create.mockResolvedValue({})
    mockedDb.$transaction.mockImplementation(async (callback) => {
      inTransaction = true
      try {
        return await callback(db)
      } finally {
        inTransaction = false
      }
    })
    jest.mocked(retrieveKnowledge).mockResolvedValue(disabled)
    jest.mocked(spawnTaskAgent).mockReturnValue({
      pid: 12345,
      command: 'mock',
      args: [],
      logAbsolute: '',
    })
  })
  it.each(['codex', 'deepseek-harness'])(
    'retrieves after reservation outside the transaction, then passes references to %s',
    async (tool) => {
      jest.mocked(retrieveKnowledge).mockImplementation(async () => {
        expect(inTransaction).toBe(false)
        expect(mockedDb.taskRun.create).toHaveBeenCalledTimes(1)
        expect(spawnTaskAgent).not.toHaveBeenCalled()
        return hit
      })
      await dispatchTask({ id: 'task-id', tool })
      expect(retrieveKnowledge).toHaveBeenCalledTimes(1)
      expect(spawnTaskAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          tool,
          readOnly: true,
          prompt: expect.stringContaining(
            'siyuan://blocks/20261120000000-aaaaaaa'
          ),
        })
      )
      const event = mockedDb.taskEvent.create.mock.calls[0][0].data
      expect(event.taskRunId).toBe('run-id')
      expect(event.evidence.knowledge.status).toBe('hit')
      expect(JSON.stringify(event.evidence)).not.toContain('上线须确认')
      expect(JSON.stringify(event.evidence)).not.toContain('共享规范')
    }
  )
  it('does not retrieve for a queued task that has not acquired a run', async () => {
    mockedDb.taskRun.findMany.mockResolvedValue([
      { status: 'QUEUED', pid: null },
    ])
    await dispatchTask({ id: 'task-id' })
    expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
    expect(retrieveKnowledge).not.toHaveBeenCalled()
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  })
  it.each([
    'empty',
    'config_error',
    'timeout',
    'auth_failed',
    'source_unavailable',
    'invalid_response',
  ] as const)(
    'stops required mode on %s and cleans up the reservation',
    async (status) => {
      jest
        .mocked(retrieveKnowledge)
        .mockResolvedValue({ ...disabled, status, mode: 'required' })
      await expect(dispatchTask({ id: 'task-id' })).rejects.toThrow(
        '知识库证据不可用'
      )
      expect(spawnTaskAgent).not.toHaveBeenCalled()
      expect(mockedDb.taskRun.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      )
      expect(
        mockedDb.taskEvent.create.mock.calls[0][0].data.evidence.knowledge
          .status
      ).toBe(status)
    }
  )
  it('does not spawn after the reservation has been cancelled or its task version changed', async () => {
    jest.mocked(retrieveKnowledge).mockResolvedValue(hit)
    mockedDb.task.findFirst.mockResolvedValue(null)
    await expect(dispatchTask({ id: 'task-id' })).rejects.toThrow(
      '任务已取消或状态已变化'
    )
    expect(spawnTaskAgent).not.toHaveBeenCalled()
    expect(mockedDb.task.findFirst.mock.calls[0][0].where).toMatchObject({
      status: 'DISPATCHED',
      updatedAt: new Date(0),
      runs: { some: { id: 'run-id', status: 'QUEUED' } },
    })
  })
  it('continues optional mode with an explicit lack of evidence', async () => {
    jest
      .mocked(retrieveKnowledge)
      .mockResolvedValue({ ...disabled, status: 'timeout' })
    await dispatchTask({ id: 'task-id' })
    expect(spawnTaskAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('本轮无可用知识库证据'),
      })
    )
  })
  it('still enforces plan approval before attempting retrieval', async () => {
    const row = await mockedDb.task.findUnique()
    mockedDb.task.findUnique.mockResolvedValue({
      ...row,
      status: 'AWAITING_APPROVAL',
    })
    await expect(dispatchTask({ id: 'task-id' })).rejects.toThrow(
      '请先批准方案'
    )
    expect(retrieveKnowledge).not.toHaveBeenCalled()
    expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
  })
})
