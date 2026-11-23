import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { zstdCompressSync } from 'node:zlib'

import * as agentDispatch from 'src/lib/agentDispatch'
import { db } from 'src/lib/db'
import * as knowledgeRetrieval from 'src/lib/knowledgeRetrieval'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'

import {
  addTaskArtifact,
  cancelTask,
  createTask,
  dispatchTask,
  dispatchTasks,
  executeTaskPlan,
  reviseTaskPlan,
  sweepTasks,
  refreshRun,
  refreshTask,
  taskPrecheck,
  taskPulse,
  taskPlanContent,
  taskRunLog,
  taskRunMessages,
  removeTaskArtifact,
  reviewTask,
  task,
  taskArtifactContent,
  tasks,
  updateTask,
} from './tasks'

const base = {
  title: '写一份登录页重构方案',
  brief: '梳理现有登录页问题，给出重构方案与验收标准。',
  acceptance: '方案包含改动点与验证方式',
  agentSlug: 'product-solution-agent',
}

describe('dispatch concurrency with PostgreSQL', () => {
  beforeEach(async () => {
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
    jest.spyOn(agentDispatch, 'spawnTaskAgent').mockReturnValue({
      pid: process.pid,
      command: 'mock',
      args: [],
      logAbsolute: '',
    })
    jest.spyOn(knowledgeRetrieval, 'retrieveKnowledge').mockResolvedValue({
      status: 'disabled',
      mode: 'optional',
      items: [],
      elapsedMs: 0,
    })
  })
  afterEach(() => jest.restoreAllMocks())

  it('relaunches a completed task without losing history and restores completion if startup fails', async () => {
    const created = await createTask({ input: base })
    const completedAt = new Date('2026-11-19T12:00:00Z')
    await db.task.update({
      where: { id: created.id },
      data: {
        status: 'DONE',
        completedAt,
        reviewedAt: completedAt,
        reviewNote: '原验收通过',
      },
    })
    await db.taskRun.create({
      data: {
        taskId: created.id,
        title: base.title,
        platform: 'codex',
        primaryAgent: base.agentSlug,
        status: 'COMPLETED',
        completedAt,
        summary: '已完成的部分',
      },
    })
    await addTaskArtifact({ taskId: created.id, input: { path: 'README.md' } })
    await updateTask({ id: created.id, input: { brief: '修改后的需求' } })
    jest.mocked(agentDispatch.spawnTaskAgent).mockImplementationOnce(() => {
      throw new Error('启动失败')
    })
    await expect(
      dispatchTask({ id: created.id, note: '继续补充' })
    ).rejects.toThrow('派发失败')
    const restored = await task({ id: created.id })
    expect(restored).toMatchObject({
      status: 'DONE',
      completedAt,
      reviewedAt: completedAt,
      reviewNote: '原验收通过',
    })
    const result = await dispatchTask({ id: created.id, note: '继续补充' })
    expect(result).toMatchObject({
      id: created.id,
      status: 'DISPATCHED',
      completedAt: null,
      reviewedAt: null,
    })
    expect(result.artifacts).toHaveLength(1)
    expect(result.runs).toHaveLength(3)
    expect(result.runs[0]).toMatchObject({
      projectKey: 'digital-team',
      projectName: '个人数字团队',
      dispatchContext: expect.objectContaining({
        note: '继续补充',
        previousReviewNote: '原验收通过',
      }),
    })
  })

  it('persists queued plan mode, platform and note and prohibits editing or duplicate submission', async () => {
    const busy = await createTask({ input: base })
    await dispatchTask({ id: busy.id })
    const next = await createTask({ input: { ...base, mode: 'plan' } })
    const queued = await dispatchTask({
      id: next.id,
      tool: 'deepseek-harness',
      note: '更新方案范围',
    })
    expect(queued.pendingDispatch).toMatchObject({
      tool: 'deepseek-harness',
      mode: 'plan',
      note: '更新方案范围',
    })
    await expect(
      updateTask({ id: next.id, input: { brief: '修改' } })
    ).rejects.toThrow('不能修改')
    await expect(dispatchTask({ id: next.id })).rejects.toThrow('已在排队')
    await db.taskRun.updateMany({
      where: { taskId: busy.id },
      data: { status: 'COMPLETED', pid: null },
    })
    await db.task.update({ where: { id: busy.id }, data: { status: 'DONE' } })
    await sweepTasks()
    const started = await db.task.findUniqueOrThrow({
      where: { id: next.id },
      include: { runs: true },
    })
    expect(started.pendingDispatch).toBeNull()
    expect(started.runs).toHaveLength(1)
    expect(started.runs[0]).toMatchObject({
      platform: 'deepseek-harness',
      mode: 'plan',
      dispatchContext: expect.objectContaining({ note: '更新方案范围' }),
    })
    expect(
      jest.mocked(agentDispatch.spawnTaskAgent).mock.calls.at(-1)[0]
    ).toMatchObject({
      readOnly: true,
      prompt: expect.stringContaining('更新方案范围'),
    })
  })

  it('reserves only one run for simultaneous dispatches of the same task', async () => {
    const created = await createTask({ input: base })
    const results = await Promise.allSettled([
      dispatchTask({ id: created.id }),
      dispatchTask({ id: created.id }),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    expect(await db.taskRun.count({ where: { taskId: created.id } })).toBe(1)
    expect(agentDispatch.spawnTaskAgent).toHaveBeenCalledTimes(1)
    expect(knowledgeRetrieval.retrieveKnowledge).toHaveBeenCalledTimes(1)
  })

  it('serializes two different tasks assigned to the same role', async () => {
    const first = await createTask({ input: base })
    const second = await createTask({ input: { ...base, title: '并发第二项' } })
    await Promise.all([
      dispatchTask({ id: first.id }),
      dispatchTask({ id: second.id }),
    ])
    const rows = await db.task.findMany({
      where: { id: { in: [first.id, second.id] } },
    })
    expect(rows.map((row) => row.status).sort()).toEqual([
      'DISPATCHED',
      'QUEUED',
    ])
    expect(agentDispatch.spawnTaskAgent).toHaveBeenCalledTimes(1)
    expect(knowledgeRetrieval.retrieveKnowledge).toHaveBeenCalledTimes(1)
  })

  it('skips knowledge retrieval when the task opts out', async () => {
    const created = await createTask({
      input: { ...base, useKnowledge: false },
    })
    expect(created.useKnowledge).toBe(false)

    await dispatchTask({ id: created.id })

    expect(knowledgeRetrieval.retrieveKnowledge).not.toHaveBeenCalled()
    const event = await db.taskEvent.findFirst({
      where: { taskRun: { taskId: created.id }, eventType: 'task.dispatched' },
      orderBy: { sequence: 'desc' },
    })
    const evidence = event?.evidence as {
      knowledge?: { status?: string }
    } | null
    expect(evidence?.knowledge?.status).toBe('disabled')
  })

  it('persists the knowledge switch when the task is edited', async () => {
    const created = await createTask({ input: base })
    const updated = await updateTask({
      id: created.id,
      input: { useKnowledge: false },
    })
    expect(updated.useKnowledge).toBe(false)

    const reverted = await updateTask({
      id: created.id,
      input: { useKnowledge: true },
    })
    expect(reverted.useKnowledge).toBe(true)
  })

  it('retrieves knowledge by default when a task does not opt out', async () => {
    const created = await createTask({ input: base })
    expect(created.useKnowledge).toBe(true)

    await dispatchTask({ id: created.id })

    expect(knowledgeRetrieval.retrieveKnowledge).toHaveBeenCalledTimes(1)
  })

  it('invalidates an old plan after a requirement change', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: { status: 'AWAITING_APPROVAL', planPath: 'README.md' },
    })
    await updateTask({ id: created.id, input: { brief: '变更后的需求' } })
    await expect(
      executeTaskPlan({ id: created.id, planPath: 'README.md' })
    ).rejects.toThrow('没有待确认')
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: created.id } })).planPath
    ).toBeNull()
    expect(agentDispatch.spawnTaskAgent).not.toHaveBeenCalled()
  })

  it('preserves a completed task and its finished run when cancellation arrives late', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: { status: 'DONE' },
    })
    await expect(cancelTask({ id: created.id })).rejects.toThrow('不能取消')
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: created.id } })).status
    ).toBe('DONE')
  })
})

describe('knowledge retrieval during reserved dispatch', () => {
  const empty = {
    status: 'empty',
    mode: 'required',
    items: [],
    elapsedMs: 1,
  } as const
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
    jest.spyOn(agentDispatch, 'spawnTaskAgent').mockReturnValue({
      pid: process.pid,
      command: 'mock',
      args: [],
      logAbsolute: '',
    })
  })
  afterEach(() => jest.restoreAllMocks())

  it('blocks required mode without evidence, records safe metadata and releases the reservation', async () => {
    jest
      .spyOn(knowledgeRetrieval, 'retrieveKnowledge')
      .mockResolvedValue({ ...empty, items: [] })
    const created = await createTask({ input: base })
    await expect(dispatchTask({ id: created.id })).rejects.toThrow(
      '知识库证据不可用（empty）'
    )
    expect(agentDispatch.spawnTaskAgent).not.toHaveBeenCalled()
    const run = await db.taskRun.findFirstOrThrow({
      where: { taskId: created.id },
      include: { events: true },
    })
    expect(run.status).toBe('FAILED')
    expect(run.events[0].evidence).toMatchObject({
      knowledge: { status: 'empty', mode: 'required', sources: [] },
    })
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: created.id } })).status
    ).toBe('DRAFT')
  })
  it('continues optional mode with a visible unavailable status', async () => {
    jest.spyOn(knowledgeRetrieval, 'retrieveKnowledge').mockResolvedValue({
      ...empty,
      status: 'timeout',
      mode: 'optional',
      items: [],
    })
    const created = await createTask({ input: base })
    await dispatchTask({ id: created.id })
    expect(agentDispatch.spawnTaskAgent).toHaveBeenCalledTimes(1)
    expect(
      jest.mocked(agentDispatch.spawnTaskAgent).mock.calls[0][0].prompt
    ).toContain('本轮无可用知识库证据')
  })
  it('does not spawn if cancellation happens while retrieval is pending', async () => {
    const created = await createTask({ input: base })
    jest
      .spyOn(knowledgeRetrieval, 'retrieveKnowledge')
      .mockImplementation(async () => {
        await cancelTask({ id: created.id })
        return { ...empty, items: [] }
      })
    await expect(dispatchTask({ id: created.id })).rejects.toThrow(
      '任务已取消或状态已变化'
    )
    expect(agentDispatch.spawnTaskAgent).not.toHaveBeenCalled()
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: created.id } })).status
    ).toBe('CANCELLED')
    expect(
      (await db.taskRun.findFirstOrThrow({ where: { taskId: created.id } }))
        .status
    ).toBe('CANCELLED')
  })
  it('uses current revision notes and preserves the approved plan on a retrieval failure', async () => {
    jest
      .spyOn(knowledgeRetrieval, 'retrieveKnowledge')
      .mockResolvedValue({ ...empty, items: [] })
    const created = await createTask({ input: { ...base, mode: 'plan' } })
    await db.task.update({
      where: { id: created.id },
      data: { status: 'AWAITING_APPROVAL', planPath: 'README.md' },
    })
    await expect(
      reviseTaskPlan({ id: created.id, note: '改用思源笔记' })
    ).rejects.toThrow('知识库证据不可用')
    expect(
      jest.mocked(knowledgeRetrieval.retrieveKnowledge).mock.calls[0][0].query
    ).toMatch(/^改用思源笔记/)
    await db.task.update({
      where: { id: created.id },
      data: { status: 'AWAITING_APPROVAL', planPath: 'README.md' },
    })
    await expect(
      executeTaskPlan({ id: created.id, planPath: 'README.md' })
    ).rejects.toThrow('知识库证据不可用')
    expect(
      (await db.task.findUniqueOrThrow({ where: { id: created.id } })).planPath
    ).toBe('README.md')
    expect(agentDispatch.spawnTaskAgent).not.toHaveBeenCalled()
  })
})

describe('tasks service', () => {
  const originalBin = process.env.ROLE_EVAL_CODEX_BIN

  beforeEach(async () => {
    // 用 echo 冒充 codex：能跑通"探测→spawn→退出"，但不产生真实模型调用
    process.env.ROLE_EVAL_CODEX_BIN = '/bin/echo'
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterAll(() => {
    if (originalBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
    else process.env.ROLE_EVAL_CODEX_BIN = originalBin
  })

  it('creates a draft task and validates input', async () => {
    const created = await createTask({ input: base })
    expect(created.status).toBe('DRAFT')
    expect(created.agentSlug).toBe('product-solution-agent')

    await expect(
      createTask({ input: { ...base, title: '  ' } })
    ).rejects.toThrow('标题不能为空')

    await expect(
      createTask({ input: { ...base, agentSlug: 'not-a-real-agent' } })
    ).rejects.toThrow('岗位清单里没有')
  })

  it('dispatches a task and creates a linked run', async () => {
    const created = await createTask({ input: base })
    const dispatched = await dispatchTask({ id: created.id, tool: 'codex' })

    expect(dispatched?.status).toBe('DISPATCHED')
    expect(dispatched?.runs).toHaveLength(1)

    const reloaded = await task({ id: created.id })
    expect(['DISPATCHED', 'AWAITING_REVIEW']).toContain(reloaded.status)
    expect(reloaded.runs).toHaveLength(1)
  })

  it('queues a task while the same agent is busy', async () => {
    // 用当前进程 pid 冒充"该岗位正在跑"，避免真的起进程
    await db.taskRun.create({
      data: {
        title: '占用中',
        platform: 'codex',
        primaryAgent: base.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        pid: process.pid,
      },
    })

    const queued = await createTask({ input: base })
    const result = await dispatchTask({ id: queued.id, tool: 'codex' })

    expect(result?.status).toBe('QUEUED')
    expect(result?.runs ?? []).toHaveLength(0)
  })

  it('dispatches several tasks at once', async () => {
    const first = await createTask({ input: base })
    const second = await createTask({ input: { ...base, title: '批量二' } })

    const result = await dispatchTasks({
      ids: [first.id, second.id],
      tool: 'codex',
    })

    expect(result).toHaveLength(2)
    expect(['DISPATCHED', 'QUEUED']).toContain(result[0].status)
  })

  it('moves a finished run to awaiting review and blocks edits', async () => {
    const created = await createTask({ input: base })
    await dispatchTask({ id: created.id, tool: 'codex' })
    await new Promise((resolve) => setTimeout(resolve, 150))

    const reviewed = await task({ id: created.id })
    expect(reviewed.status).toBe('AWAITING_REVIEW')

    const updated = await updateTask({
      id: created.id,
      input: { title: '改个标题' },
    })
    expect(updated.title).toBe('改个标题')
  })

  it('filters tasks by creation time range', async () => {
    await db.task.create({
      data: {
        title: '旧任务',
        brief: 'b',
        acceptance: 'a',
        agentSlug: 'main-agent',
        status: 'DRAFT',
        createdAt: new Date('2026-10-01T02:00:00.000Z'),
        updatedAt: new Date('2026-10-01T02:00:00.000Z'),
      },
    })
    await db.task.create({
      data: {
        title: '新任务',
        brief: 'b',
        acceptance: 'a',
        agentSlug: 'main-agent',
        status: 'DRAFT',
        createdAt: new Date('2026-11-18T02:00:00.000Z'),
        updatedAt: new Date('2026-11-18T02:00:00.000Z'),
      },
    })

    const recent = await tasks({ from: '2026-11-01T00:00:00.000Z' })
    expect(recent.map((item) => item.title)).toEqual(['新任务'])

    const all = await tasks({})
    expect(all.map((item) => item.title).sort()).toEqual(['新任务', '旧任务'])

    const onlyOld = await tasks({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T00:00:00.000Z',
    })
    expect(onlyOld.map((item) => item.title)).toEqual(['旧任务'])
  })

  it('reviews approve and reject with rules', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: { status: 'AWAITING_REVIEW' },
    })
    await db.taskArtifact.create({
      data: {
        taskId: created.id,
        kind: 'file',
        source: 'run',
        path: 'docs/reports/review-test.md',
        label: 'review-test.md',
      },
    })

    await expect(
      reviewTask({
        id: created.id,
        decision: 'APPROVE',
        note: '确认沿用已登记成果，完成本轮验收',
      })
    ).resolves.toMatchObject({ status: 'DONE' })

    const second = await createTask({ input: { ...base, title: '第二个' } })
    await db.task.update({
      where: { id: second.id },
      data: { status: 'AWAITING_REVIEW' },
    })
    await expect(
      reviewTask({ id: second.id, decision: 'REJECT' })
    ).rejects.toThrow('打回需要填写原因')

    const rejected = await reviewTask({
      id: second.id,
      decision: 'REJECT',
      note: '缺少验证方式',
    })
    expect(rejected.status).toBe('DRAFT')
    expect(rejected.reviewNote).toBe('缺少验证方式')
    expect(rejected.completedAt).toBeNull()
  })

  it('refuses to approve a task that produced no artifacts without a note', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: { status: 'AWAITING_REVIEW' },
    })

    await expect(
      reviewTask({ id: created.id, decision: 'APPROVE' })
    ).rejects.toThrow('没有本轮交付')

    const approved = await reviewTask({
      id: created.id,
      decision: 'APPROVE',
      note: '交付物是 git 改动，没有单独产出文件',
    })
    expect(approved.status).toBe('DONE')
  })

  it('records the rework note when re-dispatching an awaiting-review task', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: { status: 'AWAITING_REVIEW' },
    })

    const dispatched = await dispatchTask({
      id: created.id,
      tool: 'codex',
      note: '把接入范围收窄到任务派发链路',
    })

    expect(dispatched.runs[0]?.mode).toBe('auto')
    expect(dispatched.reviewNote).toBeNull()
    expect(dispatched.runs[0]?.dispatchContext).toMatchObject({
      note: '把接入范围收窄到任务派发链路',
    })
  })

  it('cancels a task', async () => {
    const created = await createTask({ input: base })
    const cancelled = await cancelTask({ id: created.id })
    expect(cancelled.status).toBe('CANCELLED')
  })

  it('guards artifact content reads', async () => {
    const created = await createTask({ input: base })

    const withArtifact = await addTaskArtifact({
      taskId: created.id,
      input: { kind: 'file', path: 'package.json', label: 'package.json' },
    })
    const artifact = withArtifact?.artifacts[0]
    expect(artifact?.path).toBe('package.json')

    const content = await taskArtifactContent({ id: artifact!.id })
    expect(content).toContain('"name"')

    const evil = await addTaskArtifact({
      taskId: created.id,
      input: { kind: 'file', path: '../.env' },
    })
    const evilArtifact = evil!.artifacts.find((item) => item.path === '../.env')
    await expect(taskArtifactContent({ id: evilArtifact!.id })).rejects.toThrow(
      '不在仓库内'
    )

    const denied = await addTaskArtifact({
      taskId: created.id,
      input: { kind: 'file', path: '.git/config' },
    })
    const deniedArtifact = denied!.artifacts.find(
      (item) => item.path === '.git/config'
    )
    await expect(
      taskArtifactContent({ id: deniedArtifact!.id })
    ).rejects.toThrow('不允许读取')
  })

  it('lists tasks with filters', async () => {
    await createTask({ input: base })
    await createTask({ input: { ...base, title: '第二个任务' } })

    expect(await tasks()).toHaveLength(2)
    expect(await tasks({ status: 'DRAFT' })).toHaveLength(2)
    expect(await tasks({ agentSlug: 'main-agent' })).toHaveLength(0)
  })
})

describe('task output registration', () => {
  const originalBin = process.env.ROLE_EVAL_CODEX_BIN

  beforeEach(async () => {
    process.env.ROLE_EVAL_CODEX_BIN = '/bin/echo'
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterAll(() => {
    if (originalBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
    else process.env.ROLE_EVAL_CODEX_BIN = originalBin
  })

  it('registers artifacts from the run log when the process exits', async () => {
    const created = await createTask({ input: base })
    const dispatched = await dispatchTask({ id: created.id, tool: 'codex' })
    const logRelative = dispatched!.runs[0].logPath!

    const repoRoot = resolveRepoRoot()
    const logAbsolute = path.join(repoRoot, logRelative)
    appendFileSync(
      logAbsolute,
      `${JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: '完成\nartifact: docs/reports/demo.md',
            },
          ],
        },
      })}\n`
    )

    await new Promise((resolve) => setTimeout(resolve, 200))
    const reviewed = await task({ id: created.id })

    expect(reviewed.status).toBe('AWAITING_REVIEW')
    expect(reviewed.artifacts.map((item) => item.path)).toContain(
      'docs/reports/demo.md'
    )
    expect(reviewed.runs[0].summary).toContain('完成')
  })
})

describe('git fallback artifacts', () => {
  const originalBin = process.env.ROLE_EVAL_CODEX_BIN

  beforeEach(async () => {
    process.env.ROLE_EVAL_CODEX_BIN = '/bin/echo'
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterAll(() => {
    if (originalBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
    else process.env.ROLE_EVAL_CODEX_BIN = originalBin
  })

  it('registers files changed during the run', async () => {
    const created = await createTask({ input: base })
    await dispatchTask({ id: created.id, tool: 'codex' })

    const repoRoot = resolveRepoRoot()
    const probeFile = path.join(repoRoot, 'docs/tasks/tmp-git-fallback-test.md')
    writeFileSync(probeFile, '# 本次任务产出\n')

    try {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const reviewed = await task({ id: created.id })
      expect(reviewed.artifacts.map((item) => item.path)).toContain(
        'docs/tasks/tmp-git-fallback-test.md'
      )
    } finally {
      rmSync(probeFile, { force: true })
    }
  })
})

describe('background sweep', () => {
  const originalBin = process.env.ROLE_EVAL_CODEX_BIN

  beforeEach(async () => {
    process.env.ROLE_EVAL_CODEX_BIN = '/bin/echo'
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterAll(() => {
    if (originalBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
    else process.env.ROLE_EVAL_CODEX_BIN = originalBin
  })

  it('promotes a queued task once the agent is free', async () => {
    const busy = await db.taskRun.create({
      data: {
        title: '占用中',
        platform: 'codex',
        primaryAgent: base.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        pid: process.pid,
      },
    })

    const taskA = await createTask({
      input: { ...base, title: '排队中的任务' },
    })
    const queued = await dispatchTask({ id: taskA.id, tool: 'codex' })
    expect(queued?.status).toBe('QUEUED')

    // 让占用进程"结束"
    await db.taskRun.update({
      where: { id: busy.id },
      data: { status: 'COMPLETED', pid: null },
    })

    await sweepTasks()

    const after = await task({ id: taskA.id })
    expect(['DISPATCHED', 'AWAITING_REVIEW']).toContain(after.status)
    expect(after.runs.length).toBeGreaterThanOrEqual(1)
  })

  it('reconciles a finished run without any user query', async () => {
    const created = await createTask({ input: base })
    await dispatchTask({ id: created.id, tool: 'codex' })
    await new Promise((resolve) => setTimeout(resolve, 200))

    await sweepTasks()

    const row = await db.task.findUnique({ where: { id: created.id } })
    expect(row?.status).toBe('AWAITING_REVIEW')
  })
})

describe('failure diagnosis', () => {
  const originalBin = process.env.ROLE_EVAL_CODEX_BIN

  beforeEach(async () => {
    process.env.ROLE_EVAL_CODEX_BIN = '/bin/echo'
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterAll(() => {
    if (originalBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
    else process.env.ROLE_EVAL_CODEX_BIN = originalBin
  })

  it('marks the task failed when the log carries an error', async () => {
    const created = await createTask({ input: base })
    const dispatched = await dispatchTask({ id: created.id, tool: 'codex' })
    const run = dispatched!.runs[0]

    const repoRoot = resolveRepoRoot()
    appendFileSync(
      path.join(repoRoot, run.logPath!),
      `${JSON.stringify({ type: 'turn.failed', message: 'rate limited' })}\n`
    )

    await new Promise((resolve) => setTimeout(resolve, 200))
    const reviewed = await task({ id: created.id })

    expect(reviewed.status).toBe('FAILED')
    expect(reviewed.runs[0].status).toBe('FAILED')
    expect(reviewed.runs[0].summary).toContain('rate limited')
  })

  it('returns the log tail for a run', async () => {
    const created = await createTask({ input: base })
    const dispatched = await dispatchTask({ id: created.id, tool: 'codex' })
    const run = dispatched!.runs[0]

    const text = await taskRunLog({ runId: run.id })
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('rejects unknown runs', async () => {
    await expect(
      taskRunLog({ runId: '00000000-0000-0000-0000-000000000000' })
    ).rejects.toThrow('执行记录不存在')
  })
})

describe('artifact cleanup', () => {
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  it('adds and removes an artifact', async () => {
    const created = await createTask({ input: base })

    const withArtifact = await addTaskArtifact({
      taskId: created.id,
      input: { kind: 'file', path: 'docs/notes/a.md', label: 'a.md' },
    })
    const artifact = withArtifact!.artifacts[0]
    expect(artifact.source).toBe('manual')

    const removed = await removeTaskArtifact({ id: artifact.id })
    expect(removed!.artifacts).toHaveLength(0)
  })

  it('rejects unknown artifacts', async () => {
    await expect(
      removeTaskArtifact({ id: '00000000-0000-0000-0000-000000000000' })
    ).rejects.toThrow('产物不存在')
  })
})

describe('task pulse', () => {
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  it('counts by status for the overview card', async () => {
    const draft = await createTask({ input: base })
    const done = await createTask({ input: { ...base, title: '已完成的' } })
    await db.task.update({
      where: { id: done.id },
      data: { status: 'AWAITING_REVIEW' },
    })
    await reviewTask({
      id: done.id,
      decision: 'APPROVE',
      note: '交付物是 git 改动，未登记产物',
    })

    const pulse = await taskPulse()
    expect(pulse.completedToday).toBe(1)
    expect(pulse.failedToday).toBe(0)
    expect(draft.status).toBe('DRAFT')
  })
})

describe('plan mode', () => {
  const originalBin = process.env.ROLE_EVAL_CODEX_BIN

  beforeEach(async () => {
    process.env.ROLE_EVAL_CODEX_BIN = '/bin/echo'
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterAll(() => {
    if (originalBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
    else process.env.ROLE_EVAL_CODEX_BIN = originalBin
  })

  it('keeps plan tasks read-only and waits for approval', async () => {
    const created = await createTask({ input: { ...base, mode: 'plan' } })
    expect(created.mode).toBe('plan')

    const dispatched = await dispatchTask({ id: created.id, tool: 'codex' })
    expect(dispatched!.runs[0].mode).toBe('plan')

    const repoRoot = resolveRepoRoot()
    const run = dispatched!.runs[0]
    appendFileSync(
      path.join(repoRoot, run.logPath!),
      `${JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: '# 执行方案\n只修改登录页，补充空状态测试；异常时回退该次修改。',
            },
          ],
        },
      })}\n${JSON.stringify({ type: 'turn.completed' })}\n`
    )

    await new Promise((resolve) => setTimeout(resolve, 200))
    const planned = await task({ id: created.id })

    expect(planned.status).toBe('AWAITING_APPROVAL')
    expect(planned.planPath).toBe(`docs/plans/${created.id}/${run.id}.md`)
    expect(await taskPlanContent({ taskId: created.id })).toContain(
      '# 执行方案'
    )
  })

  it('requires approval before executing', async () => {
    const created = await createTask({ input: base })
    await expect(
      executeTaskPlan({ id: created.id, planPath: 'README.md' })
    ).rejects.toThrow('没有待确认的方案')
  })

  it('executes with the approved plan', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: {
        status: 'AWAITING_APPROVAL',
        planPath: 'README.md',
      },
    })

    const executed = await executeTaskPlan({
      id: created.id,
      planPath: 'README.md',
    })
    expect(executed!.status).toBe('DISPATCHED')
    expect(executed!.runs[0].mode).toBe('execute')
  })
})

describe('plan revision', () => {
  const originalBin = process.env.ROLE_EVAL_CODEX_BIN

  beforeEach(async () => {
    process.env.ROLE_EVAL_CODEX_BIN = '/bin/echo'
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterAll(() => {
    if (originalBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
    else process.env.ROLE_EVAL_CODEX_BIN = originalBin
  })

  const waitingPlan = async () => {
    const created = await createTask({ input: { ...base, mode: 'plan' } })
    await db.task.update({
      where: { id: created.id },
      data: { status: 'AWAITING_APPROVAL', planPath: 'docs/plans/v1.md' },
    })
    return created
  }

  it('requires a note and an awaiting-plan task', async () => {
    const created = await waitingPlan()

    await expect(
      reviseTaskPlan({ id: created.id, note: '   ' })
    ).rejects.toThrow('请填写修正意见')

    const draft = await createTask({ input: base })
    await expect(
      reviseTaskPlan({ id: draft.id, note: '改一下' })
    ).rejects.toThrow('只有待确认方案的任务才能修订')
  })

  it('re-plans with the revision note and records it', async () => {
    const created = await waitingPlan()

    const revised = await reviseTaskPlan({
      id: created.id,
      note: '范围缩小到登录页',
    })

    expect(revised!.status).toBe('DISPATCHED')
    expect(revised!.runs[0].mode).toBe('plan')
    expect(revised!.planNote).toBe('范围缩小到登录页')
  })
})

describe('task plan content', () => {
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  it('reads the plan file the task points at', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: { planPath: 'README.md' },
    })

    const content = await taskPlanContent({ taskId: created.id })
    expect(content).toContain('个人数字团队')
  })

  it('rejects tasks without a plan file', async () => {
    const created = await createTask({ input: base })
    await expect(taskPlanContent({ taskId: created.id })).rejects.toThrow(
      '还没有方案文件'
    )
  })

  it('guards the plan path like artifact reads', async () => {
    const created = await createTask({ input: base })

    await db.task.update({
      where: { id: created.id },
      data: { planPath: '../.env' },
    })
    await expect(taskPlanContent({ taskId: created.id })).rejects.toThrow(
      '不在仓库内'
    )

    await db.task.update({
      where: { id: created.id },
      data: { planPath: '.git/config' },
    })
    await expect(taskPlanContent({ taskId: created.id })).rejects.toThrow(
      '不允许读取'
    )

    await db.task.update({
      where: { id: created.id },
      data: { planPath: 'docs/plans/not-exists.md' },
    })
    await expect(taskPlanContent({ taskId: created.id })).rejects.toThrow(
      '文件不存在'
    )
  })
})

describe('task run messages', () => {
  const originalRoot = process.env.DSH_SESSION_ROOT
  let sessionRoot: string
  const sessionId = '11111111-2222-3333-4444-555555555555'

  const writeSession = (records: Array<Record<string, unknown>>) => {
    const dir = path.join(sessionRoot, `session-${sessionId}`)
    mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'session.v4.jsonl.zstd')
    const lines = records.map((record) => `${JSON.stringify(record)}\n`)
    // 会话日志是追加写的多帧文件，第一帧单独写入
    writeFileSync(
      file,
      Buffer.concat([
        zstdCompressSync(Buffer.from(lines[0], 'utf8')),
        zstdCompressSync(Buffer.from(lines.slice(1).join(''), 'utf8')),
      ])
    )
  }

  beforeEach(async () => {
    sessionRoot = mkdtempSync(path.join(tmpdir(), 'dsh-session-'))
    process.env.DSH_SESSION_ROOT = sessionRoot
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  afterEach(() => {
    rmSync(sessionRoot, { recursive: true, force: true })
    if (originalRoot === undefined) delete process.env.DSH_SESSION_ROOT
    else process.env.DSH_SESSION_ROOT = originalRoot
  })

  it('only returns the messages of the run turn', async () => {
    writeSession([
      {
        type: 'user/message',
        time: 1,
        data: { turn: 1, content: [{ type: 'text', text: '第一轮需求' }] },
      },
      {
        type: 'assistant/message',
        time: 2,
        data: {
          turn: 1,
          message: { content: [{ type: 'text', text: '第一轮结论' }] },
        },
      },
      {
        type: 'user/message',
        time: 3,
        data: { turn: 2, content: [{ type: 'text', text: '第二轮需求' }] },
      },
      {
        type: 'assistant/message',
        time: 4,
        data: {
          turn: 2,
          message: { content: [{ type: 'text', text: '第二轮结论' }] },
        },
      },
    ])

    const run = await db.taskRun.create({
      data: {
        title: '会话同步运行',
        platform: 'deepseek-harness',
        primaryAgent: 'main-agent',
        externalReference: `dsh-task:${sessionId}:2`,
        status: 'COMPLETED',
      },
    })

    const messages = await taskRunMessages({ runId: run.id })
    expect(messages.map((message) => message.content)).toEqual([
      '第二轮需求',
      '第二轮结论',
    ])
  })

  it('returns an empty list when the reference has no session id', async () => {
    const run = await db.taskRun.create({
      data: {
        title: '没有会话的运行',
        platform: 'deepseek-harness',
        primaryAgent: 'main-agent',
        externalReference: `task:${sessionId}`,
        status: 'QUEUED',
      },
    })

    expect(await taskRunMessages({ runId: run.id })).toEqual([])
  })
})

describe('orphan run sweep', () => {
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  it('closes a run whose process died even when its task is already terminal', async () => {
    const task = await db.task.create({
      data: {
        title: '评估任务收尾测试',
        brief: '测试',
        acceptance: '测试',
        agentSlug: 'product-solution-agent',
        status: 'FAILED',
        readOnly: true,
      },
    })
    const logRelative = `docs/tasks/logs/${task.id}-orphan-sweep.log`
    const logAbsolute = path.join(resolveRepoRoot(), logRelative)
    writeFileSync(
      logAbsolute,
      `${JSON.stringify({ type: 'turn.completed' })}\n`
    )

    const run = await db.taskRun.create({
      data: {
        title: task.title,
        platform: 'codex',
        primaryAgent: task.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        taskId: task.id,
        logPath: logRelative,
        // 不存在的 pid：模拟进程已经退出
        pid: 999999,
      },
    })

    try {
      await sweepTasks()

      const closed = await db.taskRun.findUnique({ where: { id: run.id } })
      expect(closed?.status).toBe('COMPLETED')
      expect(closed?.completedAt).toBeTruthy()
      expect(closed?.summary).toBeTruthy()
    } finally {
      rmSync(logAbsolute, { force: true })
    }
  })

  it('leaves runs alone while their process is still alive', async () => {
    const task = await db.task.create({
      data: {
        title: '存活运行测试',
        brief: '测试',
        acceptance: '测试',
        agentSlug: 'product-solution-agent',
        status: 'DISPATCHED',
        readOnly: true,
      },
    })
    const run = await db.taskRun.create({
      data: {
        title: task.title,
        platform: 'codex',
        primaryAgent: task.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        taskId: task.id,
        pid: process.pid,
        startedAt: new Date(),
      },
    })

    await sweepTasks()

    const alive = await db.taskRun.findUnique({ where: { id: run.id } })
    expect(alive?.status).toBe('RUNNING')
  })
})

describe('manual state refresh', () => {
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  it('closes a task whose process already exited', async () => {
    const task = await db.task.create({
      data: {
        title: '手动刷新测试',
        brief: '测试',
        acceptance: '测试',
        agentSlug: 'product-solution-agent',
        status: 'DISPATCHED',
        readOnly: true,
      },
    })
    const logRelative = `docs/tasks/logs/${task.id}-refresh.log`
    const logAbsolute = path.join(resolveRepoRoot(), logRelative)
    writeFileSync(
      logAbsolute,
      `${JSON.stringify({ type: 'turn.completed' })}\n报告已写好\n`
    )

    const run = await db.taskRun.create({
      data: {
        title: task.title,
        platform: 'codex',
        primaryAgent: task.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        taskId: task.id,
        logPath: logRelative,
        pid: 999999,
      },
    })

    try {
      const refreshed = await refreshTask({ id: task.id })
      expect(refreshed?.status).toBe('AWAITING_REVIEW')
      const closedRun = await db.taskRun.findUnique({ where: { id: run.id } })
      expect(closedRun?.status).toBe('COMPLETED')
    } finally {
      rmSync(logAbsolute, { force: true })
    }
  })

  it('closes a synced run whose session is gone', async () => {
    const sessionRoot = mkdtempSync(path.join(tmpdir(), 'dsh-empty-'))
    const originalRoot = process.env.DSH_SESSION_ROOT
    process.env.DSH_SESSION_ROOT = sessionRoot

    try {
      const run = await db.taskRun.create({
        data: {
          title: '会话同步运行',
          platform: 'deepseek-harness',
          primaryAgent: 'main-agent',
          status: 'RUNNING',
          currentStage: 'EXECUTION',
          externalReference: 'dsh-task:00000000-0000-0000-0000-000000000000:1',
        },
      })

      const refreshed = await refreshRun({ runId: run.id })
      expect(refreshed?.status).toBe('COMPLETED')
      expect(refreshed?.completedAt).toBeTruthy()
    } finally {
      if (originalRoot === undefined) delete process.env.DSH_SESSION_ROOT
      else process.env.DSH_SESSION_ROOT = originalRoot
      rmSync(sessionRoot, { recursive: true, force: true })
    }
  })

  it('leaves a run alone while its process is alive and writing', async () => {
    const task = await db.task.create({
      data: {
        title: '存活任务',
        brief: '测试',
        acceptance: '测试',
        agentSlug: 'product-solution-agent',
        status: 'DISPATCHED',
        readOnly: true,
      },
    })
    const logRelative = `docs/tasks/logs/${task.id}-alive.log`
    const logAbsolute = path.join(resolveRepoRoot(), logRelative)
    writeFileSync(logAbsolute, 'running\n')

    const run = await db.taskRun.create({
      data: {
        title: task.title,
        platform: 'codex',
        primaryAgent: task.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        taskId: task.id,
        logPath: logRelative,
        pid: process.pid,
        startedAt: new Date(),
      },
    })

    try {
      const refreshed = await refreshRun({ runId: run.id })
      expect(refreshed?.status).toBe('RUNNING')
    } finally {
      rmSync(logAbsolute, { force: true })
    }
  })
})

describe('deliverable check on completion', () => {
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.task.deleteMany()
  })

  it('records missing deliverables named in the acceptance criteria', async () => {
    const task = await db.task.create({
      data: {
        title: '缺交付物测试',
        brief: '生成一份报告',
        acceptance: '报告写入 docs/role-evaluations/missing-report-xyz.md',
        agentSlug: 'product-solution-agent',
        status: 'DISPATCHED',
        readOnly: true,
      },
    })
    const logRelative = `docs/tasks/logs/${task.id}-deliverable.log`
    const logAbsolute = path.join(resolveRepoRoot(), logRelative)
    writeFileSync(
      logAbsolute,
      `${JSON.stringify({ type: 'turn.completed' })}\n做完了\n`
    )
    await db.taskRun.create({
      data: {
        title: task.title,
        platform: 'codex',
        primaryAgent: task.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        taskId: task.id,
        logPath: logRelative,
        pid: 999999,
      },
    })

    try {
      await sweepTasks()

      const after = await db.task.findUnique({ where: { id: task.id } })
      expect(after?.status).toBe('AWAITING_REVIEW')
      expect(after?.reviewNote).toContain('缺少验收标准里的交付物')
      expect(after?.reviewNote).toContain(
        'docs/role-evaluations/missing-report-xyz.md'
      )
    } finally {
      rmSync(logAbsolute, { force: true })
    }
  })
})

describe('task precheck service', () => {
  beforeEach(async () => {
    await db.taskArtifact.deleteMany()
    await db.taskEvent.deleteMany()
    await db.taskRun.deleteMany()
    await db.roleEvaluation.deleteMany()
    await db.task.deleteMany()
  })

  it('warns that an evaluation mirror task should run through the evaluation flow', async () => {
    const task = await db.task.create({
      data: {
        title: '岗位评估 · 交互 UI 设计师',
        brief: '评估岗位能力',
        acceptance: '报告写入 docs/role-evaluations/x.md',
        agentSlug: 'role-development-agent',
        status: 'DRAFT',
        readOnly: true,
      },
    })
    await db.roleEvaluation.create({
      data: {
        agentSlug: 'interaction-ui-designer-agent',
        agentName: '交互 UI 设计师',
        projectKey: 'digital-team',
        projectRoot: '/tmp',
        tool: 'codex',
        status: 'failed',
        reportPath: 'docs/role-evaluations/x.md',
        logPath: 'docs/role-evaluations/logs/x.log',
        startedAt: new Date(),
        taskId: task.id,
      },
    })

    const result = await taskPrecheck({ id: task.id })
    expect(result.warnings.join()).toContain('镜像记录')
  })
})
