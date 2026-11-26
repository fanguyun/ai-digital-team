import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { spawnTaskAgent } from 'src/lib/agentDispatch'
import { db } from 'src/lib/db'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'
import {
  executeTaskPlan,
  cancelTask,
  dispatchTask,
  reviewTask,
  updateTask,
  reviseTaskPlan,
  task,
  taskPlanContent,
  tasks,
} from 'src/services/tasks/tasks'

jest.mock('src/lib/db', () => {
  const db = {
    task: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    taskRun: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    taskArtifact: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    taskEvent: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  }
  db.$transaction.mockImplementation((callback) => callback(db))
  return { db }
})
jest.mock('src/lib/taskEnvironment', () => ({
  checkTaskEnvironment: async () => ({ ready: true, checks: [] }),
}))
jest.mock('src/lib/agentDispatch', () => ({
  ...jest.requireActual('src/lib/agentDispatch'),
  spawnTaskAgent: jest.fn(),
}))
jest.mock('src/lib/roleEvaluationDispatch', () => ({
  resolveRepoRoot: jest.fn(),
  readTeamAgent: () => ({ slug: 'main-agent' }),
}))
jest.mock('src/lib/roleEvaluationTasks', () => ({
  syncEvaluationTasks: jest.fn(),
}))
jest.mock('src/services/roleEvaluations/roleEvaluations', () => ({
  reconcileRunningEvaluations: jest.fn(),
}))
jest.mock('src/services/taskImages/taskImages', () => ({
  resolveTaskImages: async () => [],
}))
jest.mock('src/lib/taskWorkspace', () => ({
  snapshotWorkspace: async () => ({}),
  changedFiles: () => [],
  // 交付统计在收尾时计算；这里不需要真实 git，返回空基线/空统计即可
  snapshotDiffStat: async () => ({}),
  computeRunDiffStat: async () => null,
  mergeRunDiffStats: () => ({
    files: 0,
    added: 0,
    removed: 0,
    covered: 0,
    byDirectory: {},
    uncategorized: { files: 0, added: 0, removed: 0 },
  }),
}))
jest.mock('src/lib/roleEvaluationSessions', () => ({
  discoverSession: jest.fn(),
  sessionIdFromLog: jest.fn(),
}))

const taskId = '11111111-1111-4111-8111-111111111111'
const runId = '22222222-2222-4222-8222-222222222222'
let root: string
const database = jest.mocked(db)

const row = (overrides = {}) => ({
  id: taskId,
  title: '计划任务',
  agentSlug: 'main-agent',
  brief: '分析项目',
  acceptance: '方案可审阅',
  status: 'AWAITING_APPROVAL',
  mode: 'plan',
  readOnly: false,
  updatedAt: new Date(),
  planPath: 'docs/plans/current.md',
  planNote: null,
  reviewNote: null,
  artifacts: [],
  runs: [
    {
      id: runId,
      platform: 'deepseek-harness',
      mode: 'plan',
      status: 'COMPLETED',
      summary: '方案完成',
      pid: null,
      logPath: null,
      baselineFiles: null,
      startedAt: new Date(),
    },
  ],
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  root = mkdtempSync(path.join(tmpdir(), 'task-approval-'))
  jest.mocked(resolveRepoRoot).mockReturnValue(root)
  mkdirSync(path.join(root, 'docs/plans'), { recursive: true })
  writeFileSync(
    path.join(root, 'docs/plans/current.md'),
    '# 已确认方案\n只修改指定文件'
  )
  database.task.findUnique.mockResolvedValue(row() as never)
  database.task.findUniqueOrThrow.mockResolvedValue(row() as never)
  database.task.findFirst.mockImplementation((({ where }) =>
    Promise.resolve(
      where?.status === 'DISPATCHED' ? { id: taskId } : null
    )) as never)
  database.task.updateMany.mockResolvedValue({ count: 1 })
  database.taskRun.findMany.mockResolvedValue([])
  database.taskRun.count.mockResolvedValue(0)
  database.taskRun.create.mockResolvedValue({ id: runId } as never)
  database.taskArtifact.findMany.mockResolvedValue([])
  database.taskEvent.findFirst.mockResolvedValue(null)
  jest.mocked(spawnTaskAgent).mockReturnValue({
    pid: 987654321,
    command: 'fake',
    args: [],
    logAbsolute: '',
  })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('approval boundary', () => {
  it('rejects approval of a plan version that has already been replaced', async () => {
    await expect(
      executeTaskPlan({ id: taskId, planPath: 'docs/plans/old.md' })
    ).rejects.toThrow('方案版本已变化')
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  })

  it('rejects previews of replaced versions and plans symlinked outside the repository', async () => {
    await expect(
      taskPlanContent({ taskId, planPath: 'docs/plans/old.md' })
    ).rejects.toThrow('方案版本已变化')
    const outside = mkdtempSync(path.join(tmpdir(), 'plan-outside-'))
    try {
      writeFileSync(path.join(outside, 'plan.md'), '# 外部方案')
      symlinkSync(
        path.join(outside, 'plan.md'),
        path.join(root, 'docs/plans/link.md')
      )
      database.task.findUnique.mockResolvedValue(
        row({ planPath: 'docs/plans/link.md' }) as never
      )
      await expect(
        executeTaskPlan({ id: taskId, planPath: 'docs/plans/link.md' })
      ).rejects.toThrow('不允许读取')
      expect(spawnTaskAgent).not.toHaveBeenCalled()
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
  it('uses the last platform and the original read-only setting after approval', async () => {
    database.task.findUnique.mockResolvedValue(row({ readOnly: true }) as never)
    await executeTaskPlan({ id: taskId, planPath: row().planPath })
    expect(spawnTaskAgent).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'deepseek-harness', readOnly: true })
    )
    expect(database.taskRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: 'execute' }),
      })
    )
  })

  it('refuses a missing plan without spawning an agent', async () => {
    database.task.findUnique.mockResolvedValue(
      row({ planPath: 'docs/plans/missing.md' }) as never
    )
    await expect(
      executeTaskPlan({ id: taskId, planPath: 'docs/plans/missing.md' })
    ).rejects.toThrow('文件不存在')
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  })

  it('queues approved work and revisions when the role is busy', async () => {
    database.taskRun.findMany.mockResolvedValue([{ pid: process.pid }] as never)
    await executeTaskPlan({ id: taskId, planPath: row().planPath })
    await reviseTaskPlan({ id: taskId, note: '缩小范围' })
    expect(database.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUEUED' }),
      })
    )
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  })

  it('does not spawn when another request has already claimed the task', async () => {
    database.task.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      executeTaskPlan({ id: taskId, planPath: row().planPath })
    ).rejects.toThrow('状态已变化')
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  })

  it('filters statuses before applying the query limit and rejects conflicting filters', async () => {
    database.task.findMany.mockResolvedValue([])
    await tasks({ statuses: ['AWAITING_APPROVAL', 'FAILED'] })
    expect(database.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['AWAITING_APPROVAL', 'FAILED'] } },
        take: 100,
      })
    )
    await expect(
      tasks({ status: 'FAILED', statuses: ['FAILED'] })
    ).rejects.toThrow('不能同时')
  })

  it('blocks dispatch while a role has reserved a run without a process yet', async () => {
    database.taskRun.findMany.mockResolvedValue([
      {
        status: 'QUEUED',
        pid: null,
      },
    ] as never)
    await executeTaskPlan({ id: taskId, planPath: row().planPath })
    expect(database.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUEUED' }),
      })
    )
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  })

  it('preserves the previous plan when revision startup fails before execution', async () => {
    jest.mocked(spawnTaskAgent).mockImplementation(() => {
      throw new Error('sandbox unavailable')
    })
    await expect(
      reviseTaskPlan({ id: taskId, note: '补充回滚步骤' })
    ).rejects.toThrow('sandbox unavailable')
    expect(database.task.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'AWAITING_APPROVAL',
          planPath: 'docs/plans/current.md',
        }),
      })
    )
  })

  it('requires the reviewed version even for direct dispatch', async () => {
    await expect(dispatchTask({ id: taskId, mode: 'execute' })).rejects.toThrow(
      '方案版本已变化'
    )
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  })

  it.each(['brief', 'acceptance', 'agentSlug', 'readOnly', 'mode'])(
    'invalidates the approved plan when %s changes',
    async (field) => {
      await updateTask({
        id: taskId,
        input: { [field]: field === 'readOnly' ? true : 'changed' },
      })
      expect(database.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: taskId,
            status: 'AWAITING_APPROVAL',
            updatedAt: expect.any(Date),
          },
          data: expect.objectContaining({ status: 'DRAFT', planPath: null }),
        })
      )
    }
  )

  it('does not revive a reservation cancelled during process startup', async () => {
    database.task.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    await expect(
      executeTaskPlan({ id: taskId, planPath: row().planPath })
    ).rejects.toThrow('已取消')
    expect(database.taskRun.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING' }),
      })
    )
    expect(database.taskRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: runId, status: { in: ['QUEUED', 'RUNNING'] } },
      })
    )
  })

  it('does not overwrite a completion which won the cancellation race', async () => {
    database.task.updateMany.mockResolvedValue({ count: 0 })
    await expect(cancelTask({ id: taskId })).rejects.toThrow('状态已变化')
    expect(database.taskRun.updateMany).not.toHaveBeenCalled()
  })

  it('prevents review from bypassing plan approval or cancelling active execution', async () => {
    await expect(
      reviewTask({ id: taskId, decision: 'APPROVE', note: 'ok' })
    ).rejects.toThrow('只有待验收')
    expect(database.task.updateMany).not.toHaveBeenCalled()
  })
})

describe('plan completion', () => {
  it('preserves startup reservations and fails abandoned ones without approving a plan', async () => {
    const pending = row({
      status: 'DISPATCHED',
      runs: [{ ...row().runs[0], status: 'QUEUED' }],
    })
    database.task.findUnique.mockResolvedValue(pending as never)
    await task({ id: taskId })
    expect(database.task.updateMany).not.toHaveBeenCalled()
    pending.runs[0].startedAt = new Date(Date.now() - 130_000)
    await task({ id: taskId })
    expect(database.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', planPath: null }),
      })
    )
  })
  it.each(['codex', 'deepseek-harness'])(
    'saves the complete %s plan before entering approval',
    async (platform) => {
      const content = '# 实施方案\n' + '完整正文'.repeat(300)
      const logPath = 'plan.log'
      writeFileSync(
        path.join(root, logPath),
        JSON.stringify(
          platform === 'codex'
            ? {
                type: 'item.completed',
                item: { type: 'agent_message', text: content },
              }
            : { type: 'final', text: content }
        ) +
          '\n' +
          JSON.stringify({ type: 'turn.completed' })
      )
      const running = row({
        status: 'DISPATCHED',
        runs: [{ ...row().runs[0], platform, logPath }],
      })
      database.task.findUnique.mockResolvedValue(running as never)
      await task({ id: taskId })
      expect(
        readFileSync(
          path.join(root, `docs/plans/${taskId}/${runId}.md`),
          'utf8'
        )
      ).toBe(content)
      expect(database.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'AWAITING_APPROVAL' }),
        })
      )
      expect(database.taskArtifact.create).toHaveBeenCalledTimes(1)
    }
  )

  it('marks a plan with no final text as failed and clears the old approval path', async () => {
    database.task.findUnique.mockResolvedValue(
      row({ status: 'DISPATCHED' }) as never
    )
    await task({ id: taskId })
    expect(database.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', planPath: null }),
      })
    )
    expect(database.taskArtifact.createMany).not.toHaveBeenCalled()
  })

  it('never approves a progress message from an interrupted plan stream', async () => {
    writeFileSync(
      path.join(root, 'partial.log'),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: '我先检查项目结构' },
      })
    )
    database.task.findUnique.mockResolvedValue(
      row({
        status: 'DISPATCHED',
        runs: [
          {
            ...row().runs[0],
            platform: 'codex',
            logPath: 'partial.log',
          },
        ],
      }) as never
    )
    await task({ id: taskId })
    expect(database.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          planPath: null,
          reviewNote: expect.stringContaining('未正常结束'),
        }),
      })
    )
    expect(database.taskArtifact.createMany).not.toHaveBeenCalled()
  })

  it('does not finish an older run after the task has been changed by another request', async () => {
    writeFileSync(
      path.join(root, 'plan.log'),
      JSON.stringify({ type: 'final', text: '# 新方案\n步骤、验证与回滚' })
    )
    const running = row({
      status: 'DISPATCHED',
      runs: [{ ...row().runs[0], logPath: 'plan.log' }],
    })
    database.task.findUnique.mockResolvedValue(running as never)
    database.task.updateMany.mockResolvedValue({ count: 0 })
    await task({ id: taskId })
    expect(database.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: taskId,
          status: 'DISPATCHED',
          updatedAt: running.updatedAt,
        },
      })
    )
    expect(database.taskEvent.create).not.toHaveBeenCalled()
    expect(database.taskArtifact.createMany).not.toHaveBeenCalled()
  })
})
