jest.mock('src/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('src/lib/db', () => ({
  db: {
    workflowAttempt: { findMany: jest.fn() },
    taskRun: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    taskEvent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}))

jest.mock('./roleEvaluationSessions', () => ({
  findDshSessionFile: jest.fn(),
  sessionIdFromLog: jest.fn(),
}))
jest.mock('./roleEvaluationDispatch', () => ({
  resolveRepoRoot: () => '/repo',
}))

import { db } from 'src/lib/db'

import type { DeepSeekSessionSnapshot } from './deepseekSessions'
import { upsertDeepSeekSession } from './deepseekSessionSync'
import { sessionIdFromLog } from './roleEvaluationSessions'

const mockedDb = db as unknown as {
  workflowAttempt: { findMany: jest.Mock }
  taskRun: {
    create: jest.Mock
    update: jest.Mock
    findFirst: jest.Mock
    findUniqueOrThrow: jest.Mock
    findMany: jest.Mock
    deleteMany: jest.Mock
  }
  taskEvent: {
    findUnique: jest.Mock
    findFirst: jest.Mock
    create: jest.Mock
    update: jest.Mock
    deleteMany: jest.Mock
  }
  $transaction: jest.Mock
  $queryRaw: jest.Mock
}

const snapshotFor = (
  overrides: Partial<DeepSeekSessionSnapshot> = {}
): DeepSeekSessionSnapshot => ({
  sessionId: 'session-1',
  platform: 'deepseek-harness',
  title: '修复运行记录分页',
  cwdName: 'ai-digital-team',
  primaryAgent: 'software-engineer-agent',
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T01:00:00.000Z'),
  status: 'COMPLETED',
  stage: 'DELIVERY',
  modelId: 'deepseek-flash',
  inputTokens: 10,
  outputTokens: 20,
  cachedTokens: 0,
  ...overrides,
})

const taskRunFor = (snapshot: DeepSeekSessionSnapshot) => ({
  id: 'run-1',
  title: snapshot.title,
  status: snapshot.status,
  currentStage: snapshot.stage,
  summary: 'DeepSeek Harness · ai-digital-team',
  completedAt: snapshot.status === 'COMPLETED' ? snapshot.updatedAt : null,
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
})

const usageEventFor = (snapshot: DeepSeekSessionSnapshot) => ({
  id: 'usage-1',
  taskRunId: 'run-1',
  status: snapshot.status,
  stage: snapshot.stage,
  agent: snapshot.primaryAgent,
  summary: '已同步模型与 Token',
  modelId: snapshot.modelId ?? null,
  inputTokens: snapshot.inputTokens ?? null,
  outputTokens: snapshot.outputTokens ?? null,
  cachedTokens: snapshot.cachedTokens ?? null,
})

const pubSubFor = () => ({ publish: jest.fn().mockResolvedValue(undefined) })

describe('upsertDeepSeekSession', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockedDb.$transaction.mockImplementation((operation) => operation(mockedDb))
    mockedDb.workflowAttempt.findMany.mockResolvedValue([])
    mockedDb.taskRun.findMany.mockResolvedValue([])
    mockedDb.taskRun.findFirst.mockResolvedValue(null)
    mockedDb.taskEvent.findFirst.mockResolvedValue(null)
  })

  it.each(['codex', 'deepseek-harness'] as const)(
    'keeps workflow %s sessions on the single parent run',
    async (platform) => {
      const parent = { id: 'workflow-run', status: 'RUNNING' }
      mockedDb.workflowAttempt.findMany.mockResolvedValue([
        { sessionId: 'worker-id', step: { workflow: { run: parent } } },
      ])
      const result = await upsertDeepSeekSession(
        snapshotFor({ platform, sessionId: 'worker-id:1' })
      )
      expect(result).toEqual(parent)
      expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
      expect(mockedDb.taskRun.update).not.toHaveBeenCalled()
    }
  )

  it.each([true, false])(
    'cleans only an unmodified automatic workflow mirror (safe=%s)',
    async (safe) => {
      const parent = { id: 'workflow-run', status: 'RUNNING' }
      const reference = 'codex-task:worker-id:1'
      mockedDb.workflowAttempt.findMany.mockResolvedValue([
        { sessionId: 'worker-id', step: { workflow: { run: parent } } },
      ])
      const mirror = {
        id: 'mirror-run',
        taskId: null,
        externalReference: reference,
      }
      mockedDb.taskEvent.findUnique.mockResolvedValue({
        taskRunId: mirror.id,
        taskRun: mirror,
      })
      mockedDb.taskRun.findFirst.mockResolvedValue(safe ? mirror : null)
      const result = await upsertDeepSeekSession(
        snapshotFor({ platform: 'codex', sessionId: 'worker-id:1' })
      )
      expect(result).toEqual(parent)
      expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
      expect(mockedDb.taskRun.update).not.toHaveBeenCalled()
      if (safe) {
        expect(mockedDb.taskRun.deleteMany).toHaveBeenCalledWith({
          where: expect.objectContaining({
            id: mirror.id,
            taskId: null,
            events: { none: {} },
          }),
        })
      } else {
        expect(mockedDb.taskEvent.deleteMany).not.toHaveBeenCalled()
        expect(mockedDb.taskRun.deleteMany).not.toHaveBeenCalled()
      }
    }
  )

  it.each(['codex', 'deepseek-harness'] as const)(
    'reuses the dispatched %s run without overwriting its state or summary',
    async (platform) => {
      const sessionId = '26e1582f-67b1-4bbc-9f0a-a672d4b5fc74'
      const snapshot = snapshotFor({ platform, sessionId: `${sessionId}:1` })
      const managed = {
        ...taskRunFor(snapshot),
        id: 'managed-run',
        taskId: 'task-1',
        status: 'FAILED',
        currentStage: 'PLANNING',
        summary: '真实执行失败原因',
      }
      mockedDb.taskRun.findFirst.mockResolvedValueOnce(managed)
      mockedDb.taskRun.findUniqueOrThrow.mockResolvedValue(managed)
      mockedDb.taskEvent.findUnique.mockResolvedValue(null)
      mockedDb.taskEvent.findFirst.mockResolvedValue({ sequence: 4 })
      const result = await upsertDeepSeekSession(snapshot)
      expect(result).toBe(managed)
      expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
      expect(mockedDb.taskRun.update).not.toHaveBeenCalled()
      expect(mockedDb.taskRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            platform,
            taskId: { not: null },
            OR:
              platform === 'codex'
                ? [
                    {
                      externalReference: {
                        startsWith: 'task:',
                        endsWith: `:${sessionId}`,
                      },
                    },
                  ]
                : [
                    {
                      externalReference: {
                        startsWith: 'task:',
                        endsWith: `:${sessionId}`,
                      },
                    },
                    {
                      externalReference: {
                        startsWith: 'task:',
                        endsWith: `:session-${sessionId}`,
                      },
                    },
                  ],
          },
        })
      )
      expect(mockedDb.taskEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskRunId: 'managed-run',
          sequence: 5,
          status: 'FAILED',
          stage: 'PLANNING',
          inputTokens: 10,
        }),
      })
    }
  )

  it('finds the reserved run from its CLI log before captureSession has saved the reference', async () => {
    const snapshot = snapshotFor({
      platform: 'codex',
      sessionId: 'session-1:1',
    })
    const reserved = {
      ...taskRunFor(snapshot),
      id: 'reserved-run',
      taskId: 'task-1',
      externalReference: 'task:task-1',
      logPath: 'docs/tasks/logs/run.log',
    }
    mockedDb.taskRun.findMany.mockResolvedValue([reserved])
    mockedDb.taskRun.findUniqueOrThrow.mockResolvedValue(reserved)
    jest.mocked(sessionIdFromLog).mockReturnValue('session-1')
    mockedDb.taskEvent.findUnique.mockResolvedValue(null)
    expect(await upsertDeepSeekSession(snapshot)).toBe(reserved)
    expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
    expect(sessionIdFromLog).toHaveBeenCalledWith(
      '/repo/docs/tasks/logs/run.log',
      'codex'
    )
  })

  it('moves usage from an existing automatic mirror before removing only that mirror', async () => {
    const snapshot = snapshotFor({ sessionId: 'session-1:1' })
    const managed = {
      ...taskRunFor(snapshot),
      id: 'managed-run',
      taskId: 'task-1',
    }
    const mirror = { ...taskRunFor(snapshot), id: 'mirror-run', taskId: null }
    mockedDb.taskRun.findFirst
      .mockResolvedValueOnce(managed)
      .mockResolvedValueOnce(mirror)
    mockedDb.taskRun.findUniqueOrThrow.mockResolvedValue(managed)
    mockedDb.taskEvent.findUnique
      .mockResolvedValueOnce({ taskRun: mirror })
      .mockResolvedValueOnce({
        ...usageEventFor(snapshot),
        taskRunId: 'mirror-run',
      })
    mockedDb.taskEvent.findFirst.mockResolvedValue({ sequence: 3 })
    await upsertDeepSeekSession(snapshot)
    expect(mockedDb.taskEvent.update).toHaveBeenCalledWith({
      where: { id: 'usage-1' },
      data: expect.objectContaining({ taskRunId: 'managed-run', sequence: 4 }),
    })
    expect(mockedDb.taskRun.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'mirror-run',
        taskId: null,
        events: { none: {} },
        deliveredArtifacts: { none: {} },
      },
    })
    expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
  })

  it('preserves a mirror that acquired real task data or non-sync events', async () => {
    const snapshot = snapshotFor()
    const managed = { ...taskRunFor(snapshot), id: 'managed-run' }
    const mirror = { ...taskRunFor(snapshot), id: 'mirror-run' }
    mockedDb.taskRun.findFirst
      .mockResolvedValueOnce(managed)
      .mockResolvedValueOnce(null)
    mockedDb.taskRun.findUniqueOrThrow.mockResolvedValue(managed)
    mockedDb.taskEvent.findUnique.mockResolvedValueOnce({ taskRun: mirror })
    await upsertDeepSeekSession(snapshot)
    expect(mockedDb.taskRun.deleteMany).not.toHaveBeenCalled()
    expect(mockedDb.taskEvent.deleteMany).not.toHaveBeenCalled()
    expect(mockedDb.taskEvent.update).not.toHaveBeenCalled()
  })

  it('matches the prefixed DeepSeek CLI session ID before capture completes', async () => {
    const sessionId = '26e1582f-67b1-4bbc-9f0a-a672d4b5fc74'
    const snapshot = snapshotFor({ sessionId: `${sessionId}:1` })
    const reserved = {
      ...taskRunFor(snapshot),
      taskId: 'task-1',
      externalReference: 'task:task-1',
      logPath: 'docs/tasks/logs/run.log',
    }
    mockedDb.taskRun.findMany.mockResolvedValue([reserved])
    mockedDb.taskRun.findUniqueOrThrow.mockResolvedValue(reserved)
    jest.mocked(sessionIdFromLog).mockReturnValue(`session-${sessionId}`)
    expect(await upsertDeepSeekSession(snapshot)).toBe(reserved)
    expect(mockedDb.taskRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            {
              externalReference: {
                startsWith: 'task:',
                endsWith: `:${sessionId}`,
              },
            },
            {
              externalReference: {
                startsWith: 'task:',
                endsWith: `:session-${sessionId}`,
              },
            },
          ],
        }),
      })
    )
    expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
  })

  it.each(['codex', 'deepseek-harness'] as const)(
    'preserves a separate second turn in a dispatched %s session',
    async (platform) => {
      const snapshot = snapshotFor({ platform, sessionId: 'session-1:2' })
      const secondTurn = {
        ...taskRunFor(snapshot),
        summary:
          platform === 'codex'
            ? 'Codex · ai-digital-team'
            : 'DeepSeek Harness · ai-digital-team',
      }
      mockedDb.taskEvent.findUnique
        .mockResolvedValueOnce({ taskRun: secondTurn })
        .mockResolvedValueOnce(usageEventFor(snapshot))
      expect(await upsertDeepSeekSession(snapshot)).toBe(secondTurn)
      expect(mockedDb.taskRun.findFirst).not.toHaveBeenCalled()
      expect(mockedDb.taskRun.findMany).not.toHaveBeenCalled()
      expect(mockedDb.taskRun.deleteMany).not.toHaveBeenCalled()
    }
  )

  it('defers token events until the reserved run has its initial dispatch event', async () => {
    const snapshot = snapshotFor()
    const reserved = { ...taskRunFor(snapshot), status: 'QUEUED' }
    mockedDb.taskRun.findFirst.mockResolvedValueOnce(reserved)
    mockedDb.taskRun.findUniqueOrThrow.mockResolvedValue(reserved)
    expect(await upsertDeepSeekSession(snapshot)).toBe(reserved)
    expect(mockedDb.taskEvent.create).not.toHaveBeenCalled()
    expect(mockedDb.taskRun.create).not.toHaveBeenCalled()
  })

  it('retains known tokens when a later snapshot temporarily lacks usage', async () => {
    const previous = snapshotFor()
    const snapshot = snapshotFor({
      modelId: undefined,
      inputTokens: undefined,
      outputTokens: undefined,
      cachedTokens: undefined,
    })
    const managed = {
      ...taskRunFor(snapshot),
      primaryAgent: snapshot.primaryAgent,
    }
    mockedDb.taskRun.findFirst.mockResolvedValueOnce(managed)
    mockedDb.taskRun.findUniqueOrThrow.mockResolvedValue(managed)
    mockedDb.taskEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(usageEventFor(previous))
    await upsertDeepSeekSession(snapshot)
    expect(mockedDb.taskEvent.update).not.toHaveBeenCalled()
    expect(mockedDb.taskEvent.create).not.toHaveBeenCalled()
  })

  it('creates a task run and its usage event on first sync', async () => {
    const snapshot = snapshotFor()
    mockedDb.taskEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    mockedDb.taskRun.create.mockResolvedValue({ id: 'run-1' })
    const pubSub = pubSubFor()

    const taskRun = await upsertDeepSeekSession(snapshot, pubSub as never)

    expect(taskRun).toEqual({ id: 'run-1' })
    expect(mockedDb.taskRun.create).toHaveBeenCalledTimes(1)
    expect(mockedDb.taskRun.update).not.toHaveBeenCalled()
    // task.created 事件随 taskRun.create 一并写入，usage.synced 单独 create。
    expect(mockedDb.taskEvent.create).toHaveBeenCalledTimes(1)
    expect(pubSub.publish).toHaveBeenCalledTimes(2)
  })

  it('does not update or publish when the snapshot is unchanged', async () => {
    const snapshot = snapshotFor()
    const existingTaskRun = taskRunFor(snapshot)
    mockedDb.taskEvent.findUnique
      .mockResolvedValueOnce({ id: 'created-1', taskRun: existingTaskRun })
      .mockResolvedValueOnce(usageEventFor(snapshot))
    const pubSub = pubSubFor()

    const taskRun = await upsertDeepSeekSession(snapshot, pubSub as never)

    expect(taskRun).toBe(existingTaskRun)
    expect(mockedDb.taskRun.update).not.toHaveBeenCalled()
    expect(mockedDb.taskEvent.update).not.toHaveBeenCalled()
    expect(mockedDb.taskEvent.create).not.toHaveBeenCalled()
    expect(pubSub.publish).not.toHaveBeenCalled()
  })

  it('updates the snapshot and publishes when task run fields change', async () => {
    const snapshot = snapshotFor()
    const staleTaskRun = {
      ...taskRunFor(snapshot),
      status: 'RUNNING',
      currentStage: 'EXECUTION',
      completedAt: null,
    }
    const updatedTaskRun = taskRunFor(snapshot)
    mockedDb.taskEvent.findUnique
      .mockResolvedValueOnce({ id: 'created-1', taskRun: staleTaskRun })
      .mockResolvedValueOnce(usageEventFor(snapshot))
    mockedDb.taskRun.update.mockResolvedValue(updatedTaskRun)
    const pubSub = pubSubFor()

    const taskRun = await upsertDeepSeekSession(snapshot, pubSub as never)

    expect(taskRun).toBe(updatedTaskRun)
    expect(mockedDb.taskRun.update).toHaveBeenCalledTimes(1)
    expect(mockedDb.taskRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: {
        title: snapshot.title,
        status: 'COMPLETED',
        currentStage: 'DELIVERY',
        summary: 'DeepSeek Harness · ai-digital-team',
        completedAt: snapshot.updatedAt,
      },
    })
    expect(pubSub.publish).toHaveBeenCalledTimes(2)
  })

  it('refreshes only the usage event when tokens change', async () => {
    const snapshot = snapshotFor()
    const existingTaskRun = taskRunFor(snapshot)
    const staleUsage = {
      ...usageEventFor(snapshot),
      inputTokens: 5,
      modelId: 'deepseek-pro',
    }
    mockedDb.taskEvent.findUnique
      .mockResolvedValueOnce({ id: 'created-1', taskRun: existingTaskRun })
      .mockResolvedValueOnce(staleUsage)
    const pubSub = pubSubFor()

    await upsertDeepSeekSession(snapshot, pubSub as never)

    expect(mockedDb.taskRun.update).not.toHaveBeenCalled()
    expect(mockedDb.taskEvent.update).toHaveBeenCalledTimes(1)
    expect(mockedDb.taskEvent.update).toHaveBeenCalledWith({
      where: { id: 'usage-1' },
      data: {
        status: 'COMPLETED',
        stage: 'DELIVERY',
        agent: 'software-engineer-agent',
        summary: '已同步模型与 Token',
        modelId: 'deepseek-flash',
        inputTokens: 10,
        outputTokens: 20,
        cachedTokens: 0,
      },
    })
    expect(pubSub.publish).toHaveBeenCalledTimes(2)
  })

  it('treats a missing usage event as a change when tokens exist', async () => {
    const snapshot = snapshotFor()
    const existingTaskRun = taskRunFor(snapshot)
    mockedDb.taskEvent.findUnique
      .mockResolvedValueOnce({ id: 'created-1', taskRun: existingTaskRun })
      .mockResolvedValueOnce(null)
    const pubSub = pubSubFor()

    await upsertDeepSeekSession(snapshot, pubSub as never)

    expect(mockedDb.taskRun.update).not.toHaveBeenCalled()
    expect(mockedDb.taskEvent.create).toHaveBeenCalledTimes(1)
    expect(pubSub.publish).toHaveBeenCalledTimes(2)
  })
})
