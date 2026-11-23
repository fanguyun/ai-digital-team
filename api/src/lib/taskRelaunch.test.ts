// 数据库连接受限时验证派发契约；真实 PostgreSQL 并发仍由 services/tasks/tasks.test.ts 覆盖。
import { teamWeeklyReport } from 'src/services/taskRuns/taskRuns'
import {
  dispatchTask,
  reviewTask,
  updateTask,
  cancelTask,
  confirmTaskContinuation,
  retryTaskEnvironment,
  Task,
  task as loadTask,
} from 'src/services/tasks/tasks'

import { spawnTaskAgent } from './agentDispatch'
import { db } from './db'
import { checkTaskEnvironment } from './taskEnvironment'
import { parseTaskRunOutput } from './taskOutput'

jest.mock('./taskEnvironment', () => ({ checkTaskEnvironment: jest.fn() }))

jest.mock('./db', () => ({
  db: {
    task: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    taskRun: {
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    taskEvent: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    taskArtifact: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}))
jest.mock('./agentDispatch', () => ({
  ...jest.requireActual('./agentDispatch'),
  spawnTaskAgent: jest.fn(),
}))
jest.mock('./roleEvaluationDispatch', () => ({
  ...jest.requireActual('./roleEvaluationDispatch'),
  resolveRepoRoot: () => process.cwd(),
  readTeamAgent: () => ({ slug: 'main-agent' }),
}))
jest.mock('./deepseekSessionSync', () => ({ syncDeepSeekSessions: jest.fn() }))
jest.mock('./taskOutput', () => ({
  ...jest.requireActual('./taskOutput'),
  parseTaskRunOutput: jest.fn().mockReturnValue({
    summary: '修改完成',
    artifacts: [{ path: './README.md', kind: 'report', label: '成果' }],
  }),
}))
jest.mock('./taskWorkspace', () => ({
  ...jest.requireActual('./taskWorkspace'),
  computeRunDiffStat: jest.fn().mockResolvedValue(null),
  snapshotWorkspace: jest.fn().mockResolvedValue({}),
  snapshotDiffStat: jest.fn().mockResolvedValue({}),
}))
jest.mock('./sessionTrace', () => ({
  ...jest.requireActual('./sessionTrace'),
  readSessionTurnTrace: jest
    .fn()
    .mockResolvedValue({ messages: [], tools: [], truncated: false }),
}))
jest.mock('src/services/taskImages/taskImages', () => ({
  resolveTaskImages: jest.fn().mockResolvedValue([]),
}))

const database = db as unknown as Record<string, any>
const now = new Date('2026-11-20T10:00:00Z')
const original = {
  id: 'task-id',
  title: '继续任务',
  brief: '保存的新需求',
  acceptance: '可验收',
  agentSlug: 'main-agent',
  status: 'DONE',
  updatedAt: now,
  completedAt: now,
  reviewedAt: now,
  reviewNote: '原验收通过',
  mode: 'auto',
  readOnly: true,
  useKnowledge: false,
  planPath: null,
  planNote: null,
  pendingDispatch: null,
  artifacts: [{ path: 'README.md', label: '已有成果', kind: 'report' }],
  runs: [],
}
let row
let active
beforeEach(() => {
  jest.clearAllMocks()
  jest
    .mocked(checkTaskEnvironment)
    .mockResolvedValue({ ready: true, checks: [] })
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    summary: '修改完成',
    artifacts: [{ path: './README.md', kind: 'report', label: '成果' }],
  })
  row = { ...original }
  active = []
  database.task.findUnique.mockImplementation(async () => row)
  database.task.findUniqueOrThrow.mockImplementation(async () => row)
  database.task.findFirst.mockResolvedValue({ id: row.id })
  database.task.updateMany.mockResolvedValue({ count: 1 })
  database.taskRun.findMany.mockImplementation(async ({ where }) =>
    where.primaryAgent ? active : []
  )
  database.taskRun.count.mockResolvedValue(0)
  database.taskRun.updateMany.mockResolvedValue({ count: 1 })
  database.taskRun.findUnique.mockImplementation(async () => ({
    ...row.runs[0],
    taskId: row.id,
  }))
  database.taskRun.create.mockResolvedValue({ id: 'new-run', status: 'QUEUED' })
  database.$transaction.mockImplementation(async (action) => action(database))
  jest.mocked(spawnTaskAgent).mockReturnValue({
    pid: process.pid,
    command: 'mock',
    args: [],
    logAbsolute: '',
  })
})

it('creates a new run with current requirements, separate change note, project and read-only permission', async () => {
  await dispatchTask({ id: row.id, note: '补充统计', tool: 'deepseek-harness' })
  expect(database.taskRun.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      taskId: row.id,
      platform: 'deepseek-harness',
      projectName: '个人数字团队',
      dispatchContext: expect.objectContaining({
        note: '补充统计',
        previousReviewNote: '原验收通过',
      }),
    }),
  })
  expect(spawnTaskAgent).toHaveBeenCalledWith(
    expect.objectContaining({
      readOnly: true,
      prompt: expect.stringMatching(
        /保存的新需求[\s\S]*本轮修改要求\n补充统计/
      ),
    })
  )
  expect(database.task.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'DISPATCHED',
        completedAt: null,
        reviewedAt: null,
        reviewNote: null,
      }),
    })
  )
})

it('queues the entire plan request without spawning when the role is occupied', async () => {
  active = [{ status: 'RUNNING', pid: process.pid }]
  row.mode = 'plan'
  await dispatchTask({
    id: row.id,
    note: '再次出方案',
    tool: 'deepseek-harness',
  })
  expect(spawnTaskAgent).not.toHaveBeenCalled()
  expect(database.taskRun.create).not.toHaveBeenCalled()
  expect(database.task.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'QUEUED',
        pendingDispatch: expect.objectContaining({
          mode: 'plan',
          tool: 'deepseek-harness',
          note: '再次出方案',
        }),
      }),
    })
  )
})

it('restores the saved queued request and retains plan approval restrictions', async () => {
  row.status = 'QUEUED'
  row.pendingDispatch = {
    tool: 'deepseek-harness',
    mode: 'plan',
    note: '排队修改要求',
    sourceRunIds: [],
    previousReviewNote: '原验收通过',
  }
  await dispatchTask({ id: row.id, resumeQueued: true })
  expect(database.taskRun.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      mode: 'plan',
      platform: 'deepseek-harness',
    }),
  })
  expect(spawnTaskAgent).toHaveBeenCalledWith(
    expect.objectContaining({
      readOnly: true,
      prompt: expect.stringContaining('排队修改要求'),
    })
  )
  expect(jest.mocked(spawnTaskAgent).mock.calls[0][0].prompt).toContain(
    '交给用户确认后再实施'
  )
})

it('restores completion and review data when process startup fails', async () => {
  jest.mocked(spawnTaskAgent).mockImplementationOnce(() => {
    throw new Error('启动失败')
  })
  await expect(dispatchTask({ id: row.id })).rejects.toThrow('派发失败')
  expect(database.task.updateMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'DONE',
        completedAt: now,
        reviewedAt: now,
        reviewNote: '原验收通过',
      }),
    })
  )
})

it('rejects editing and resubmission of a queued task, and clears its request on cancellation', async () => {
  row.status = 'QUEUED'
  await expect(
    updateTask({ id: row.id, input: { brief: '不能改' } })
  ).rejects.toThrow('不能修改')
  await expect(dispatchTask({ id: row.id })).rejects.toThrow('已在排队')
  await cancelTask({ id: row.id })
  expect(database.task.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'CANCELLED',
        pendingDispatch: expect.anything(),
      }),
    })
  )
})

it('requires an explanation when only historical artifacts exist', async () => {
  row.status = 'AWAITING_REVIEW'
  row.runs = [{ id: 'current-run' }]
  database.taskArtifact.count.mockResolvedValue(0)
  await expect(reviewTask({ id: row.id, decision: 'APPROVE' })).rejects.toThrow(
    '没有本轮交付'
  )
  await reviewTask({
    id: row.id,
    decision: 'APPROVE',
    note: '确认本轮沿用已有报告，已核对新需求',
  })
  expect(database.taskArtifact.count).toHaveBeenCalledWith({
    where: { taskId: row.id, lastRunId: 'current-run' },
  })
})

it('updates the existing normalized artifact instead of registering it twice', async () => {
  row.status = 'DISPATCHED'
  row.runs = [
    {
      id: 'new-run',
      status: 'RUNNING',
      pid: null,
      platform: 'codex',
      mode: 'auto',
      startedAt: now,
      logPath: 'docs/tasks/logs/nonexistent.log',
      baselineFiles: {},
    },
  ]
  database.taskArtifact.findMany.mockResolvedValue([{ path: 'README.md' }])
  database.task.findFirst.mockResolvedValue(null)
  await loadTask({ id: row.id })
  expect(database.taskArtifact.create).not.toHaveBeenCalled()
  expect(database.taskArtifact.updateMany).toHaveBeenCalledWith({
    where: { taskId: row.id, path: { in: ['README.md'] } },
    data: { lastRunId: 'new-run' },
  })
})

it.each(['确认目标笔记本', '确认目标'.repeat(500)])(
  'keeps an exited task waiting and bounds the event summary (%#)',
  async (request) => {
    row.status = 'DISPATCHED'
    row.runs = [
      {
        id: 'waiting-run',
        status: 'RUNNING',
        pid: null,
        platform: 'codex',
        mode: 'auto',
        logPath: 'docs/tasks/logs/test.log',
        startedAt: now,
      },
    ]
    jest.mocked(parseTaskRunOutput).mockReturnValue({
      summary: '尚未写入',
      confirmationRequest: request,
      artifacts: [],
    })
    database.task.findFirst.mockResolvedValue(null)
    await loadTask({ id: row.id })
    expect(database.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'WAITING_CONFIRMATION',
          reviewNote: request,
        }),
      })
    )
    expect(database.taskRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'WAITING_CONFIRMATION',
          completedAt: null,
        }),
      })
    )
    expect(database.taskEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'task.waiting_confirmation',
          status: 'WAITING_CONFIRMATION',
          summary: request.slice(0, 1000),
        }),
      })
    )
  }
)

it('exposes an older completed run with a pending request without rewriting its history', async () => {
  row.status = 'AWAITING_REVIEW'
  row.runs = [
    {
      id: 'old-run',
      status: 'COMPLETED',
      platform: 'codex',
      mode: 'auto',
      summary: '待确认：确认目标笔记本',
    },
  ]
  expect(await Task.confirmation({}, { root: row })).toEqual({
    runId: 'old-run',
    prompt: '确认目标笔记本',
  })
  expect(database.taskRun.update).not.toHaveBeenCalled()
  await expect(reviewTask({ id: row.id, decision: 'APPROVE' })).rejects.toThrow(
    '待确认事项'
  )
  await expect(dispatchTask({ id: row.id })).rejects.toThrow('确认后继续')
})

it('confirms only the latest pending run and preserves the execution platform and permissions', async () => {
  row.status = 'WAITING_CONFIRMATION'
  row.reviewNote = '确认目标笔记本'
  row.runs = [
    {
      id: 'waiting-run',
      status: 'WAITING_CONFIRMATION',
      platform: 'deepseek-harness',
      mode: 'auto',
    },
  ]
  await expect(
    confirmTaskContinuation({ id: row.id, runId: 'older-run' })
  ).rejects.toThrow('已变化')
  expect(spawnTaskAgent).not.toHaveBeenCalled()
  await confirmTaskContinuation({
    id: row.id,
    runId: 'waiting-run',
    note: '只写入笔记本A',
  })
  expect(spawnTaskAgent).toHaveBeenCalledWith(
    expect.objectContaining({
      tool: 'deepseek-harness',
      readOnly: true,
      prompt: expect.stringMatching(
        /人工确认[\s\S]*只写入笔记本A[\s\S]*不扩大原只读、沙箱/
      ),
    })
  )
  expect(database.taskRun.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        dispatchContext: expect.objectContaining({
          confirmationRunId: 'waiting-run',
          note: '只写入笔记本A',
        }),
      }),
    })
  )
  expect(database.taskRun.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: 'waiting-run',
        taskId: row.id,
        status: 'WAITING_CONFIRMATION',
      },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  )
})

it('rejects execution-boundary changes while waiting for confirmation, including historical requests', async () => {
  for (const status of ['WAITING_CONFIRMATION', 'AWAITING_REVIEW']) {
    row.status = status
    row.runs = [
      {
        id: 'old-run',
        status: 'COMPLETED',
        platform: 'codex',
        summary: '待确认：确认目标',
      },
    ]
    for (const input of [
      { readOnly: false },
      { brief: '替换目标' },
      { agentSlug: 'software-engineer-agent' },
      { mode: 'plan' },
    ]) {
      await expect(updateTask({ id: row.id, input })).rejects.toThrow(
        '待确认事项'
      )
    }
  }
  expect(database.task.updateMany).not.toHaveBeenCalled()
})

it('passes the full historical confirmation scope into continuation and bounds approval event summaries', async () => {
  row.status = 'AWAITING_REVIEW'
  row.reviewNote = null
  row.runs = [
    {
      id: 'old-run',
      status: 'COMPLETED',
      platform: 'codex',
      mode: 'auto',
      summary: '摘要未含确认范围',
      logPath: 'docs/tasks/logs/test.log',
    },
  ]
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    summary: '摘要未含确认范围',
    confirmationRequest: '仅写入笔记本A',
    artifacts: [],
  })
  await confirmTaskContinuation({
    id: row.id,
    runId: 'old-run',
    note: '同意'.repeat(750),
  })
  expect(jest.mocked(spawnTaskAgent).mock.calls[0][0].prompt).toContain(
    '待确认范围：仅写入笔记本A'
  )
  const event = database.taskEvent.create.mock.calls[0][0].data
  expect(event.eventType).toBe('task.confirmed')
  expect(event.summary).toHaveLength(1000)
})

it.each(['FAILED', 'CANCELLED'])(
  'rejects confirmation when the run changes to %s before the lock',
  async (status) => {
    row.status = 'WAITING_CONFIRMATION'
    row.reviewNote = '确认目标'
    row.runs = [
      {
        id: 'waiting-run',
        status: 'WAITING_CONFIRMATION',
        platform: 'codex',
        mode: 'auto',
      },
    ]
    database.taskRun.findUnique.mockResolvedValue({
      id: 'waiting-run',
      taskId: row.id,
      status,
    })
    await expect(
      confirmTaskContinuation({ id: row.id, runId: 'waiting-run' })
    ).rejects.toThrow('状态已变化')
    expect(database.taskRun.create).not.toHaveBeenCalled()
    expect(spawnTaskAgent).not.toHaveBeenCalled()
  }
)

it('retains confirmation scope while queued and rejects a second confirmation submission', async () => {
  row.status = 'WAITING_CONFIRMATION'
  row.reviewNote = '确认目标'
  row.runs = [
    {
      id: 'waiting-run',
      status: 'WAITING_CONFIRMATION',
      platform: 'codex',
      mode: 'auto',
    },
  ]
  active = [{ status: 'RUNNING', pid: process.pid }]
  await confirmTaskContinuation({
    id: row.id,
    runId: 'waiting-run',
    note: '同意写入A',
  })
  const saved = database.task.updateMany.mock.calls[0][0].data.pendingDispatch
  expect(saved).toMatchObject({
    confirmationRunId: 'waiting-run',
    note: '同意写入A',
  })
  row = { ...row, status: 'QUEUED', pendingDispatch: saved }
  await expect(
    confirmTaskContinuation({ id: row.id, runId: 'waiting-run' })
  ).rejects.toThrow('已变化')
  active = []
  await dispatchTask({ id: row.id, resumeQueued: true })
  expect(spawnTaskAgent).toHaveBeenCalledTimes(1)
  expect(jest.mocked(spawnTaskAgent).mock.calls[0][0].prompt).toContain(
    '同意写入A'
  )
})

it('stops before creating a run when environment checks fail and preserves confirmation for retry', async () => {
  row.status = 'WAITING_CONFIRMATION'
  row.reviewNote = '仅写入笔记本A'
  row.runs = [
    {
      id: 'waiting-run',
      status: 'WAITING_CONFIRMATION',
      platform: 'deepseek-harness',
      mode: 'auto',
    },
  ]
  jest.mocked(checkTaskEnvironment).mockResolvedValue({
    ready: false,
    checks: [
      {
        key: 'runtime',
        label: '团队 API',
        status: 'BLOCKED',
        detail: '连接失败',
        remedy: '启动服务',
      },
    ],
  })
  await confirmTaskContinuation({
    id: row.id,
    runId: 'waiting-run',
    note: '只写入A',
  })
  const stopped = database.task.updateMany.mock.calls[0][0].data
  expect(stopped).toMatchObject({
    status: 'ENVIRONMENT_BLOCKED',
    pendingDispatch: {
      confirmationRunId: 'waiting-run',
      note: '只写入A',
      previousReviewNote: '仅写入笔记本A',
    },
  })
  expect(database.taskRun.create).not.toHaveBeenCalled()
  expect(spawnTaskAgent).not.toHaveBeenCalled()
  row = { ...row, ...stopped }
  await expect(dispatchTask({ id: row.id })).rejects.toThrow('环境重试入口')
  jest
    .mocked(checkTaskEnvironment)
    .mockResolvedValue({ ready: true, checks: [] })
  await retryTaskEnvironment({ id: row.id })
  expect(spawnTaskAgent).toHaveBeenCalledTimes(1)
  expect(jest.mocked(spawnTaskAgent).mock.calls[0][0]).toMatchObject({
    tool: 'deepseek-harness',
    readOnly: true,
  })
  expect(jest.mocked(spawnTaskAgent).mock.calls[0][0].prompt).toContain(
    '仅写入笔记本A'
  )
  expect(
    database.taskEvent.create.mock.calls.filter(
      ([input]) => input.data.eventType === 'task.confirmed'
    )
  ).toHaveLength(1)
})

it('exposes historical environment blockers separately and prevents acceptance approval', async () => {
  row.status = 'AWAITING_REVIEW'
  row.runs = [
    {
      id: 'old-run',
      status: 'COMPLETED',
      platform: 'codex',
      summary: '待确认：请在宿主机环境重跑，才能连接思源。',
    },
  ]
  expect(await Task.blocker({}, { root: row })).toMatchObject({
    prompt: expect.stringContaining('宿主机'),
  })
  expect(await Task.confirmation({}, { root: row })).toBeNull()
  await expect(
    confirmTaskContinuation({ id: row.id, runId: 'old-run' })
  ).rejects.toThrow('已变化')
  await expect(reviewTask({ id: row.id, decision: 'APPROVE' })).rejects.toThrow(
    '待确认事项'
  )
})

it('restores historical environment retry scope and closes the obsolete waiting run', async () => {
  row.status = 'WAITING_CONFIRMATION'
  row.runs = [
    {
      id: 'legacy-wait',
      status: 'WAITING_CONFIRMATION',
      platform: 'codex',
      mode: 'auto',
      summary: '待确认：宿主机环境无法连接思源',
      dispatchContext: {
        note: '仅写入笔记本A',
        revisionNote: '保留原格式',
        previousReviewNote: '已同意范围A',
        confirmationRunId: 'approved-run',
      },
    },
  ]
  await retryTaskEnvironment({ id: row.id })
  expect(database.taskRun.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      dispatchContext: expect.objectContaining({
        note: '仅写入笔记本A',
        revisionNote: '保留原格式',
        previousReviewNote: '已同意范围A',
        confirmationRunId: 'approved-run',
        sourceRunIds: ['legacy-wait'],
      }),
    }),
  })
  expect(jest.mocked(spawnTaskAgent).mock.calls[0][0].prompt).toContain(
    '仅写入笔记本A'
  )
  expect(database.taskRun.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: 'legacy-wait',
        taskId: row.id,
        status: 'WAITING_CONFIRMATION',
      },
      data: expect.objectContaining({ status: 'FAILED' }),
    })
  )
  expect(database.taskEvent.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ eventType: 'task.environment_retry' }),
    })
  )
})

it('rejects a retry if requirements changed between the two task reads', async () => {
  const blocked = {
    ...row,
    status: 'ENVIRONMENT_BLOCKED',
    reviewNote: '服务未启动',
  }
  database.task.findUnique
    .mockResolvedValueOnce(blocked)
    .mockResolvedValueOnce({ ...row, status: 'DRAFT' })
  await expect(retryTaskEnvironment({ id: row.id })).rejects.toThrow(
    '环境阻塞状态已变化'
  )
  expect(spawnTaskAgent).not.toHaveBeenCalled()
})

it('queues an environment retry when busy and resumes the saved request once free', async () => {
  row.status = 'ENVIRONMENT_BLOCKED'
  row.pendingDispatch = {
    tool: 'codex',
    mode: 'auto',
    note: '仅写入A',
    sourceRunIds: [],
    previousReviewNote: '已同意A',
  }
  active = [{ status: 'RUNNING', pid: process.pid }]
  await retryTaskEnvironment({ id: row.id })
  const queued = database.task.updateMany.mock.calls[0][0].data
  expect(queued).toMatchObject({
    status: 'QUEUED',
    pendingDispatch: { note: '仅写入A' },
  })
  expect(spawnTaskAgent).not.toHaveBeenCalled()
  row = { ...row, ...queued }
  active = []
  await dispatchTask({ id: row.id, resumeQueued: true })
  expect(spawnTaskAgent).toHaveBeenCalledTimes(1)
  expect(jest.mocked(spawnTaskAgent).mock.calls[0][0].prompt).toContain(
    '仅写入A'
  )
})

it('clears the retry authorization snapshot when blocked requirements are edited', async () => {
  row.status = 'ENVIRONMENT_BLOCKED'
  row.pendingDispatch = { note: '旧范围' }
  await updateTask({ id: row.id, input: { brief: '新范围' } })
  expect(database.task.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'DRAFT',
        planPath: null,
        reviewNote: null,
      }),
    })
  )
})

it('records an environment-blocked exit and retains the original approved dispatch context', async () => {
  row.status = 'DISPATCHED'
  row.runs = [
    {
      id: 'blocked-run',
      status: 'RUNNING',
      platform: 'codex',
      mode: 'auto',
      pid: null,
      logPath: 'docs/tasks/logs/test.log',
      startedAt: now,
      dispatchContext: {
        confirmationRunId: 'approved-run',
        note: '只写入A',
        previousReviewNote: '写入笔记本A',
      },
    },
  ]
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    summary: '未执行写入',
    environmentBlock: '沙箱无法连接思源',
    artifacts: [],
  })
  database.task.findFirst.mockResolvedValue(null)
  await loadTask({ id: row.id })
  expect(database.task.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'ENVIRONMENT_BLOCKED',
        reviewNote: '沙箱无法连接思源',
        pendingDispatch: expect.objectContaining({
          note: '只写入A',
          confirmationRunId: 'approved-run',
          sourceRunIds: ['blocked-run'],
        }),
      }),
    })
  )
  expect(database.taskEvent.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'task.environment_blocked',
        status: 'FAILED',
      }),
    })
  )
})

it('aggregates project statistics while retaining unknown historical ownership and zero coverage', async () => {
  const zero = {
    files: 0,
    added: 0,
    removed: 0,
    byDirectory: {},
    uncategorized: { files: 0, added: 0, removed: 0 },
  }
  const period = [
    {
      ...original,
      projectKey: 'digital-team',
      projectName: '个人数字团队',
      status: 'COMPLETED',
      diffStat: {
        ...zero,
        files: 1,
        added: 4,
        byDirectory: { api: { files: 1, added: 4, removed: 0 } },
      },
    },
    {
      ...original,
      projectKey: 'digital-team',
      projectName: '个人数字团队',
      status: 'COMPLETED',
      diffStat: zero,
    },
    { ...original, status: 'COMPLETED', diffStat: null },
  ]
  database.taskRun.groupBy.mockResolvedValue([])
  database.taskEvent.findMany.mockResolvedValue([])
  database.taskRun.findMany.mockImplementation(async ({ where }) =>
    where.OR ? period : []
  )
  const report = await teamWeeklyReport({
    range: { from: '2026-11-20T00:00:00Z', to: '2026-11-21T00:00:00Z' },
  })
  expect(report.delivery).toMatchObject({
    files: 1,
    added: 4,
    coveredRuns: 2,
    totalRuns: 3,
  })
  expect(report.delivery.byProject).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        projectKey: 'digital-team',
        files: 1,
        coveredRuns: 2,
        totalRuns: 2,
        byDirectory: [{ directory: 'api', files: 1, added: 4, removed: 0 }],
      }),
      expect.objectContaining({
        projectKey: null,
        projectName: '未归属项目',
        coveredRuns: 0,
        totalRuns: 1,
      }),
    ])
  )
})
