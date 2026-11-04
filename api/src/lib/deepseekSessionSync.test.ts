jest.mock('src/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('src/lib/db', () => ({
  db: {
    taskRun: { create: jest.fn(), update: jest.fn() },
    taskEvent: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}))

import { db } from 'src/lib/db'

import { upsertDeepSeekSession } from './deepseekSessionSync'
import type { DeepSeekSessionSnapshot } from './deepseekSessions'

const mockedDb = db as unknown as {
  taskRun: { create: jest.Mock; update: jest.Mock }
  taskEvent: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }
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
    jest.clearAllMocks()
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
