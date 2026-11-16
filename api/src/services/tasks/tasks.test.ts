import { appendFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { db } from 'src/lib/db'
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
  taskPulse,
  taskRunLog,
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

  it('reviews approve and reject with rules', async () => {
    const created = await createTask({ input: base })

    await expect(
      reviewTask({ id: created.id, decision: 'APPROVE' })
    ).resolves.toMatchObject({ status: 'DONE' })

    const second = await createTask({ input: { ...base, title: '第二个' } })
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
    await reviewTask({ id: done.id, decision: 'APPROVE' })

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

    // 模拟 agent 把方案写进 docs/plans
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
              text: `方案完成\nartifact: docs/plans/${created.id}.md`,
            },
          ],
        },
      })}\n`
    )

    await new Promise((resolve) => setTimeout(resolve, 200))
    const planned = await task({ id: created.id })

    expect(planned.status).toBe('AWAITING_APPROVAL')
    expect(planned.planPath).toBe(`docs/plans/${created.id}.md`)
  })

  it('requires approval before executing', async () => {
    const created = await createTask({ input: base })
    await expect(executeTaskPlan({ id: created.id })).rejects.toThrow(
      '没有待确认的方案'
    )
  })

  it('executes with the approved plan', async () => {
    const created = await createTask({ input: base })
    await db.task.update({
      where: { id: created.id },
      data: {
        status: 'AWAITING_APPROVAL',
        planPath: 'docs/plans/demo.md',
      },
    })

    const executed = await executeTaskPlan({ id: created.id })
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
