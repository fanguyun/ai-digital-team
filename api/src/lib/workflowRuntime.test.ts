import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { spawnTaskAgent } from './agentDispatch'
import { db } from './db'
import { retrieveKnowledge } from './knowledgeRetrieval'
import { parseTaskRunOutput } from './taskOutput'
import { RESEARCH_WORKFLOW, workflowHash } from './workflowDefinition'
import {
  advanceWorkflow,
  assertWorkflowPublication,
  beginWorkflowPublication,
  cancelWorkflow,
  createResearchWorkflow,
  retryWorkflowStep,
  startWorkflow,
  syncWorkflowPublication,
} from './workflowRuntime'

jest.mock('./db', () => ({ db: {} }))
jest.mock('./agentDispatch', () => ({
  spawnTaskAgent: jest.fn(),
  taskLogPath: () => 'docs/tasks/logs/mock.log',
}))
jest.mock('./knowledgeRetrieval', () => ({ retrieveKnowledge: jest.fn() }))
jest.mock('./roleEvaluationDispatch', () => ({
  resolveRepoRoot: () => mockRoot,
  readTeamAgent: () => ({}),
  probeBinary: () => ({ bin: 'codex' }),
}))
jest.mock('./roleEvaluationSessions', () => ({
  sessionIdFromLog: () => 'exact-session',
}))
jest.mock('./taskOutput', () => ({ parseTaskRunOutput: jest.fn() }))
let mockRoot: string
let w
let publication
let artifact
const database = db as unknown as Record<string, any>
const outputFor = (key) =>
  key === 'verify'
    ? { status: 'OK', markdown: '核验通过', verdict: 'PASS' }
    : { status: 'OK', markdown: `${key}正文` }
const setup = (index = 0, active = false) => {
  w = {
    id: 'wf',
    taskId: 'task',
    runId: 'run',
    status: 'RUNNING',
    currentStep: index,
    version: 1,
    reworkCount: 0,
    tool: 'codex',
    publicationId: null,
    note: null,
    input: {
      title: '主题',
      questions: '问题',
      audience: '团队',
      scope: '近三月',
      materials: '',
      sourceMode: 'knowledge-web',
    },
    task: { id: 'task', title: '主题' },
    steps: RESEARCH_WORKFLOW.steps.map((s, ordinal) => ({
      ...s,
      id: `step-${ordinal}`,
      workflowId: 'wf',
      ordinal,
      status: ordinal < index ? 'COMPLETED' : 'PENDING',
      attemptCount: ordinal < index ? 1 : 0,
      attempts:
        ordinal < index
          ? [
              {
                id: `a-${ordinal}`,
                stepId: `step-${ordinal}`,
                number: 1,
                status: 'COMPLETED',
                output: outputFor(s.key),
                contentHash: workflowHash(`${s.key}正文`),
                artifactId: `artifact-${ordinal}`,
              },
            ]
          : [],
    })),
  }
  if (active) {
    w.steps[index].status = 'RUNNING'
    w.steps[index].attemptCount = 1
    w.steps[index].attempts = [
      {
        id: `a-${index}`,
        stepId: `step-${index}`,
        number: 1,
        status: 'RUNNING',
        logPath: 'docs/log',
        pid: null,
        input: {},
        startedAt: new Date(),
        sessionId: null,
      },
    ]
  }
}
const stepFor = (where) => w.steps.find((s) => s.id === where.id)
beforeEach(() => {
  jest.clearAllMocks()
  mockRoot = mkdtempSync(path.join(tmpdir(), 'workflow-runtime-'))
  setup()
  publication = null
  artifact = null
  for (const name of [
    'taskWorkflow',
    'workflowStep',
    'workflowAttempt',
    'task',
    'taskRun',
    'taskEvent',
    'taskArtifact',
    'knowledgePublication',
  ])
    database[name] = Object.fromEntries(
      [
        'findUnique',
        'findUniqueOrThrow',
        'findFirst',
        'findMany',
        'count',
        'create',
        'update',
        'updateMany',
      ].map((key) => [key, jest.fn()])
    )
  database.$transaction = jest.fn(async (fn) => fn(database))
  database.$queryRaw = jest.fn()
  database.taskWorkflow.findUnique.mockImplementation(async () =>
    structuredClone(w)
  )
  database.taskWorkflow.updateMany.mockImplementation(
    async ({ where, data }) => {
      if (where.version !== w.version || where.status !== w.status)
        return { count: 0 }
      Object.assign(w, { ...data, version: w.version + 1 })
      return { count: 1 }
    }
  )
  database.taskWorkflow.update.mockImplementation(async ({ data }) => {
    Object.assign(w, {
      ...data,
      ...(data.reworkCount
        ? { reworkCount: w.reworkCount + data.reworkCount.increment }
        : {}),
    })
    return w
  })
  database.workflowStep.update.mockImplementation(async ({ where, data }) => {
    const s = stepFor(where)
    Object.assign(s, {
      ...data,
      ...(data.attemptCount ? { attemptCount: s.attemptCount + 1 } : {}),
    })
    return s
  })
  database.workflowStep.updateMany.mockImplementation(
    async ({ where, data }) => {
      for (const s of w.steps)
        if (
          (!where.id || s.id === where.id) &&
          (!where.status ||
            (typeof where.status === 'string'
              ? s.status === where.status
              : where.status.in.includes(s.status))) &&
          (typeof where.ordinal === 'number'
            ? s.ordinal === where.ordinal
            : s.ordinal >= (where.ordinal?.gte ?? 0))
        )
          Object.assign(s, data)
      return { count: 1 }
    }
  )
  database.workflowAttempt.count.mockResolvedValue(0)
  database.workflowAttempt.create.mockImplementation(async ({ data }) => {
    const a = {
      id: 'tool-attempt',
      status: 'QUEUED',
      ...data,
      startedAt: new Date(),
      pid: null,
    }
    w.steps.find((s) => s.id === data.stepId).attempts.unshift(a)
    return a
  })
  database.workflowAttempt.update.mockImplementation(
    async ({ where, data }) => {
      const a = w.steps
        .flatMap((s) => s.attempts)
        .find((a) => a.id === where.id)
      Object.assign(a, data)
      return a
    }
  )
  database.workflowAttempt.updateMany.mockImplementation(
    async ({ where, data }) => {
      const matches = w.steps
        .flatMap((s) => s.attempts)
        .filter(
          (a) =>
            (!where.id || where.id === a.id) &&
            (!where.stepId || where.stepId === a.stepId) &&
            (!where.number || where.number === a.number) &&
            (!where.status ||
              (typeof where.status === 'string'
                ? a.status === where.status
                : where.status.in.includes(a.status)))
        )
      matches.forEach((a) => Object.assign(a, data))
      return { count: matches.length }
    }
  )
  database.workflowAttempt.findMany.mockImplementation(async () =>
    w.steps.flatMap((s) => s.attempts).filter((a) => a.finishedAt)
  )
  database.taskRun.findMany.mockResolvedValue([])
  database.taskRun.create.mockResolvedValue({ id: 'run' })
  database.task.findUniqueOrThrow.mockImplementation(async () => w.task)
  database.taskEvent.findUnique.mockResolvedValue(null)
  database.taskEvent.findFirst.mockResolvedValue(null)
  database.taskArtifact.create.mockImplementation(async ({ data }) => ({
    ...data,
    id: 'saved-artifact',
  }))
  database.taskArtifact.findUnique.mockImplementation(async () => artifact)
  database.knowledgePublication.findUnique.mockImplementation(
    async () => publication
  )
  jest.mocked(spawnTaskAgent).mockReturnValue({
    pid: 99999999,
    command: 'codex',
    args: [],
    logAbsolute: '',
  })
  jest.mocked(retrieveKnowledge).mockResolvedValue({
    status: 'empty',
    mode: 'optional',
    items: [],
    elapsedMs: 2,
  })
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    summary: '',
    artifacts: [],
    completed: true,
    finalText: JSON.stringify(outputFor('brief')),
    usage: { inputTokens: 10, outputTokens: 3 },
  })
})
afterEach(() => rmSync(mockRoot, { recursive: true, force: true }))

it('关闭入口后不可新建，旧实例仍可查询和取消', async () => {
  process.env.WORKFLOWS_ENABLED = 'false'
  try {
    await expect(createResearchWorkflow({})).rejects.toThrow('停用')
    await cancelWorkflow('task')
    expect(w.status).toBe('CANCELLED')
  } finally {
    delete process.env.WORKFLOWS_ENABLED
  }
})
it('启动校验版本，重复启动不创建顶层运行', async () => {
  w.status = 'DRAFT'
  await startWorkflow({ taskId: 'task', version: 1 })
  await expect(startWorkflow({ taskId: 'task', version: 1 })).rejects.toThrow(
    '当前版本'
  )
  expect(database.taskRun.create).toHaveBeenCalledTimes(1)
  expect(spawnTaskAgent).toHaveBeenCalledWith(
    expect.objectContaining({ readOnly: true, managedWorkflow: true })
  )
})
it('岗位忙碌时排队，不启动模型', async () => {
  database.workflowAttempt.count.mockResolvedValue(1)
  await advanceWorkflow('task')
  expect(w.status).toBe('QUEUED')
  expect(spawnTaskAgent).not.toHaveBeenCalled()
})
it('版本争用失败不派发', async () => {
  database.taskWorkflow.updateMany.mockResolvedValue({ count: 0 })
  await expect(advanceWorkflow('task')).rejects.toThrow('状态已变化')
  expect(spawnTaskAgent).not.toHaveBeenCalled()
})
it('知识库不可达明确阻塞，不默默当作无命中', async () => {
  setup(1)
  jest.mocked(retrieveKnowledge).mockResolvedValue({
    status: 'timeout',
    mode: 'optional',
    items: [],
    elapsedMs: 2,
  })
  await advanceWorkflow('task')
  expect(w.status).toBe('BLOCKED')
  expect(spawnTaskAgent).not.toHaveBeenCalled()
})
it('启动后崩溃窗口不会自动重复派发', async () => {
  setup(0, true)
  w.steps[0].attempts[0].status = 'QUEUED'
  await advanceWorkflow('task')
  expect(spawnTaskAgent).not.toHaveBeenCalled()
  expect(w.currentStep).toBe(0)
})
it('执行无正常结束事件时失败，不推进', async () => {
  setup(0, true)
  jest
    .mocked(parseTaskRunOutput)
    .mockReturnValue({ summary: '完成', artifacts: [], completed: false })
  await advanceWorkflow('task')
  expect(w.status).toBe('FAILED')
  expect(w.currentStep).toBe(0)
})
it('超过15分钟失败，保留当前步骤', async () => {
  setup(0, true)
  w.steps[0].attempts[0].startedAt = new Date(Date.now() - 16 * 60_000)
  await advanceWorkflow('task')
  expect(w.status).toBe('FAILED')
  expect(w.note).toContain('15分钟')
})
it('结构错误不会生成成功产物', async () => {
  setup(0, true)
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    summary: '完成',
    artifacts: [],
    completed: true,
    finalText: '已完成',
  })
  await advanceWorkflow('task')
  expect(w.status).toBe('FAILED')
  expect(database.taskArtifact.create).not.toHaveBeenCalled()
})
it('正常结果持久化且只传指定上游，后台能继续下一步', async () => {
  setup(0, true)
  await advanceWorkflow('task')
  expect(w.currentStep).toBe(1)
  expect(database.taskArtifact.create).toHaveBeenCalledTimes(1)
  const file = database.taskArtifact.create.mock.calls[0][0].data.path
  expect(readFileSync(path.join(mockRoot, file), 'utf8')).toBe('brief正文')
  expect(spawnTaskAgent).toHaveBeenCalledTimes(1)
})
it('核验通过后进入人工确认，不自动写知识库', async () => {
  setup(3, true)
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    summary: '',
    artifacts: [],
    completed: true,
    finalText: JSON.stringify(outputFor('verify')),
  })
  await advanceWorkflow('task')
  expect(w.currentStep).toBe(4)
  expect(w.status).toBe('WAITING_CONFIRMATION')
  expect(database.knowledgePublication.update).not.toHaveBeenCalled()
})
it.each(['research', 'draft'])('核验退回 %s，最多自动一轮', async (target) => {
  setup(3, true)
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    summary: '',
    artifacts: [],
    completed: true,
    finalText: JSON.stringify({
      status: 'OK',
      markdown: '证据不足',
      verdict: 'REWORK',
      retryFrom: target,
    }),
  })
  await advanceWorkflow('task')
  expect(w.currentStep).toBe(target === 'research' ? 1 : 2)
  // update mock models increment as Prisma syntax; explicitly set next round.
  setup(3, true)
  w.reworkCount = 1
  await advanceWorkflow('task')
  expect(w.status).toBe('REVIEW_FAILED')
  expect(w.currentStep).toBe(3)
})
it('手动调整来源需说明理由，不允许跳到未到达的步骤', async () => {
  w.status = 'BLOCKED'
  await expect(
    retryWorkflowStep({ taskId: 'task', version: 1, sourceMode: 'knowledge' })
  ).rejects.toThrow('请填写')
  await expect(
    retryWorkflowStep({
      taskId: 'task',
      version: 1,
      target: 'draft',
      note: '跳过',
    })
  ).rejects.toThrow('只能重试')
  expect(spawnTaskAgent).not.toHaveBeenCalled()
})
it('人工退回后旧的报告和核验失效', async () => {
  setup(4)
  w.status = 'WAITING_CONFIRMATION'
  await retryWorkflowStep({
    taskId: 'task',
    version: 1,
    target: 'draft',
    note: '补充限制',
  })
  expect(w.steps[3].status).toBe('PENDING')
  await expect(assertWorkflowPublication('task', 'artifact-2')).rejects.toThrow(
    '当前已通过核验'
  )
})
it('已尝试写入的文档不得通过返工更换正文', async () => {
  setup(4)
  w.status = 'WAITING_CONFIRMATION'
  w.publicationId = 'p'
  publication = { status: 'UNCERTAIN' }
  await expect(
    retryWorkflowStep({
      taskId: 'task',
      version: 1,
      target: 'draft',
      note: '更换',
    })
  ).rejects.toThrow('先核对')
})
it('未核验报告、粘贴正文和旧产物均不能入库', async () => {
  await expect(assertWorkflowPublication('task', null)).rejects.toThrow(
    '当前已通过核验'
  )
  setup(4)
  w.status = 'WAITING_CONFIRMATION'
  await expect(assertWorkflowPublication('task', 'old')).rejects.toThrow(
    '当前已通过核验'
  )
})
it('检测报告文件被修改，拒绝入库', async () => {
  setup(4)
  w.status = 'WAITING_CONFIRMATION'
  artifact = { path: 'docs/report.md' }
  mkdirSync(path.join(mockRoot, 'docs'))
  writeFileSync(path.join(mockRoot, artifact.path), '被改的正文')
  await expect(assertWorkflowPublication('task', 'artifact-2')).rejects.toThrow(
    '文件已变化'
  )
})
it('只有回读验证成功才完成；不确定结果保留待核对', async () => {
  setup(5)
  w.status = 'PUBLISHING'
  w.publicationId = 'p'
  publication = { status: 'UNCERTAIN', error: '超时' }
  await syncWorkflowPublication('task')
  expect(w.status).toBe('PUBLICATION_FAILED')
  const version = w.version
  const events = database.taskEvent.create.mock.calls.length
  await syncWorkflowPublication('task')
  expect(w.version).toBe(version)
  expect(database.taskEvent.create).toHaveBeenCalledTimes(events)
  publication = { status: 'VERIFIED', documentId: 'doc' }
  await syncWorkflowPublication('task')
  expect(w.status).toBe('COMPLETED')
})

it('并发巡检只领取并派发一个步骤', async () => {
  const results = await Promise.allSettled([
    advanceWorkflow('task'),
    advanceWorkflow('task'),
  ])
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  expect(spawnTaskAgent).toHaveBeenCalledTimes(1)
  expect(database.workflowAttempt.create).toHaveBeenCalledTimes(1)
})
it('取消旧版本被拒绝，失败用量如实保存', async () => {
  await expect(cancelWorkflow('task', 0)).rejects.toThrow('版本已变化')
  setup(0, true)
  jest.mocked(parseTaskRunOutput).mockReturnValue({
    completed: false,
    summary: '',
    artifacts: [],
    error: '执行异常',
    usage: { inputTokens: 23, outputTokens: 4 },
  })
  await advanceWorkflow('task')
  expect(w.steps[0].attempts[0].inputTokens).toBe(23)
  expect(database.taskRun.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        inputTokens: 23,
        outputTokens: 4,
        cachedTokens: null,
      }),
    })
  )
})
it('四个岗位会话串行交接，仅人工确认后进入工具节点并完成', async () => {
  w.status = 'DRAFT'
  await startWorkflow({ taskId: 'task', version: 1 })
  for (const key of ['brief', 'research', 'draft', 'verify']) {
    const output =
      key === 'research'
        ? {
            ...outputFor(key),
            webStatus: 'empty',
            sources: [
              {
                id: 'KB1',
                url: 'siyuan://blocks/doc',
                title: '知识',
                date: '未知',
                accessedAt: '2026-11-24',
                excerpt: '摘录',
                supports: '研究论点',
                type: 'fact',
              },
            ],
          }
        : outputFor(key)
    jest.mocked(parseTaskRunOutput).mockReturnValue({
      completed: true,
      finalText: JSON.stringify(output),
      summary: '',
      artifacts: [],
      usage: { inputTokens: 10, outputTokens: 2 },
    })
    await advanceWorkflow('task')
  }
  expect(w.status).toBe('WAITING_CONFIRMATION')
  expect(database.taskRun.create).toHaveBeenCalledTimes(1)
  expect(spawnTaskAgent).toHaveBeenCalledTimes(4)
  const draft = w.steps[2].attempts[0]
  artifact = { path: database.taskArtifact.create.mock.calls[2][0].data.path }
  publication = {
    id: 'p',
    artifactId: draft.artifactId,
    contentHash: workflowHash('draft正文'),
    status: 'PREPARED',
  }
  await assertWorkflowPublication('task', draft.artifactId, 'p')
  await beginWorkflowPublication('task', 'p')
  expect(w.status).toBe('PUBLISHING')
  publication.status = 'VERIFIED'
  publication.documentId = 'doc'
  await syncWorkflowPublication('task')
  expect(w.status).toBe('COMPLETED')
  expect(w.steps.every((s) => s.status === 'COMPLETED')).toBe(true)
})

it('活跃进程的无关 MCP 启动错误不提前结束步骤', async () => {
  setup(0, true)
  w.steps[0].attempts[0].pid = 12345
  const kill = jest.spyOn(process, 'kill').mockImplementation(() => true)
  try {
    jest.mocked(parseTaskRunOutput).mockReturnValue({
      summary: '',
      artifacts: [],
      completed: false,
      error: 'ERROR rmcp::transport::worker AuthRequired',
    })
    await advanceWorkflow('task')
    expect(w.status).toBe('RUNNING')
    expect(w.steps[0].status).toBe('RUNNING')
  } finally {
    kill.mockRestore()
  }
})
it('重启后中断的入库保留原快照并进入待核对', async () => {
  setup(5)
  w.status = 'PUBLISHING'
  w.publicationId = 'p'
  publication = {
    id: 'p',
    status: 'PUBLISHING',
    updatedAt: new Date(Date.now() - 180_000),
  }
  database.knowledgePublication.updateMany.mockImplementation(
    async ({ data }) => {
      Object.assign(publication, data)
      return { count: 1 }
    }
  )
  await syncWorkflowPublication('task')
  expect(w.status).toBe('PUBLICATION_FAILED')
  expect(w.publicationId).toBe('p')
  expect(publication.status).toBe('UNCERTAIN')
})
