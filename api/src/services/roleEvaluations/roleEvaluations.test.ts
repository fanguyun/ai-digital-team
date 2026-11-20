import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { db } from 'src/lib/db'
import { failureReasonFromLog } from 'src/lib/roleEvaluationLog'
import { syncEvaluationTasks } from 'src/lib/roleEvaluationTasks'

import {
  RoleEvaluation,
  dispatchRoleEvaluation,
  resolveReportFile,
  roleEvaluationMessages,
  roleEvaluationReport,
  roleEvaluationTools,
  roleEvaluations,
} from './roleEvaluations'

const repoRoot = process.cwd()

const waitFor = async (check: () => boolean, timeoutMs = 3000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return check()
}

let tempDir: string
let echoStub: string
let sleepStub: string
const originalCodexBin = process.env.ROLE_EVAL_CODEX_BIN
const createdFiles: string[] = []

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'pdt-role-evaluation-'))

  echoStub = path.join(tempDir, 'codex-echo.sh')
  writeFileSync(echoStub, '#!/bin/sh\nexec /bin/echo "$@"\n')
  chmodSync(echoStub, 0o755)

  sleepStub = path.join(tempDir, 'codex-sleep.sh')
  writeFileSync(
    sleepStub,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "stub-sleep 1.0"; exit 0; fi',
      'echo "stub-sleep invoked"',
      'exec /bin/sleep 30',
      '',
    ].join('\n')
  )
  chmodSync(sleepStub, 0o755)
})

beforeEach(() => {
  process.env.ROLE_EVAL_CODEX_BIN = echoStub
  delete process.env.ROLE_EVAL_ALLOW_DISPATCH
})

afterEach(() => {
  if (originalCodexBin === undefined) delete process.env.ROLE_EVAL_CODEX_BIN
  else process.env.ROLE_EVAL_CODEX_BIN = originalCodexBin
  delete process.env.ROLE_EVAL_ALLOW_DISPATCH
})

afterAll(() => {
  for (const relativePath of createdFiles) {
    rmSync(path.join(repoRoot, relativePath), { force: true })
  }
  rmSync(tempDir, { recursive: true, force: true })
})

describe('roleEvaluations service', () => {
  it('reports both allowlisted tools with availability', () => {
    const tools = roleEvaluationTools()

    expect(tools.map((tool) => tool.id)).toEqual(['codex', 'deepseek-harness'])
    expect(tools[0]).toMatchObject({ available: true })
    expect(tools[0].version).toBeTruthy()
    expect(typeof tools[1].available).toBe('boolean')
    if (!tools[1].available) expect(tools[1].reason).toContain('dsh')
  })

  it('dispatches a role evaluation through the configured binary', async () => {
    const dispatch = await dispatchRoleEvaluation({
      input: { agentSlug: 'main-agent', tool: 'codex' },
    })

    expect(dispatch).toMatchObject({
      agentSlug: 'main-agent',
      agentName: '数字总经理',
      tool: 'codex',
    })
    expect(dispatch.id).toMatch(/^main-agent-\d{8}-\d{4}$/)
    expect(dispatch.reportPath).toMatch(
      /^docs\/role-evaluations\/main-agent-\d{8}-\d{4}\.md$/
    )
    expect(typeof dispatch.pid).toBe('number')
    expect(dispatch.prompt).toContain(
      'My request: 数字团队 · 岗位评估：数字总经理'
    )

    createdFiles.push(dispatch.logPath, dispatch.resultPath)
    const sidecarPath = dispatch.logPath.replace(/\.log$/, '.json')
    createdFiles.push(sidecarPath)

    const logAbsolutePath = path.join(repoRoot, dispatch.logPath)
    await waitFor(
      () =>
        existsSync(logAbsolutePath) &&
        readFileSync(logAbsolutePath, 'utf8').includes('exec')
    )
    const log = readFileSync(logAbsolutePath, 'utf8')
    expect(log).toContain('exec')
    expect(log).toContain('-C')

    const sidecar = JSON.parse(
      readFileSync(path.join(repoRoot, sidecarPath), 'utf8')
    )
    expect(sidecar).toMatchObject({
      agentSlug: 'main-agent',
      tool: 'codex',
      pid: dispatch.pid,
    })
    expect(sidecar.args[sidecar.args.length - 1]).toBe(dispatch.prompt)
  })

  it('refuses a second run while the previous one is alive', async () => {
    process.env.ROLE_EVAL_CODEX_BIN = sleepStub
    const first = await dispatchRoleEvaluation({
      input: { agentSlug: 'personal-executive-assistant-agent', tool: 'codex' },
    })
    createdFiles.push(first.logPath, first.resultPath)
    createdFiles.push(first.logPath.replace(/\.log$/, '.json'))

    const firstLogPath = path.join(repoRoot, first.logPath)
    await waitFor(
      () =>
        existsSync(firstLogPath) &&
        readFileSync(firstLogPath, 'utf8').includes('stub-sleep invoked')
    )
    expect(readFileSync(firstLogPath, 'utf8')).toContain('stub-sleep invoked')

    try {
      await expect(
        dispatchRoleEvaluation({
          input: {
            agentSlug: 'personal-executive-assistant-agent',
            tool: 'codex',
          },
        })
      ).rejects.toThrow('仍在运行')
      await expect(
        dispatchRoleEvaluation({
          input: {
            agentSlug: 'personal-executive-assistant-agent',
            tool: 'codex',
          },
        })
      ).rejects.toThrow(String(first.pid))
    } finally {
      if (first.pid) process.kill(first.pid, 'SIGTERM')
    }
  })

  it('rejects unknown roles and tools before spawning anything', async () => {
    await expect(
      dispatchRoleEvaluation({
        input: { agentSlug: 'not-a-role', tool: 'codex' },
      })
    ).rejects.toThrow('岗位清单里没有 not-a-role')

    await expect(
      dispatchRoleEvaluation({ input: { agentSlug: 'main-agent', tool: 'sh' } })
    ).rejects.toThrow('不支持的执行工具')

    await expect(
      dispatchRoleEvaluation({ input: { agentSlug: '', tool: 'codex' } })
    ).rejects.toThrow('缺少要评估的岗位 slug')
  })

  it('honours the dispatch kill switch', async () => {
    process.env.ROLE_EVAL_ALLOW_DISPATCH = '0'

    await expect(
      dispatchRoleEvaluation({
        input: { agentSlug: 'main-agent', tool: 'codex' },
      })
    ).rejects.toThrow('ROLE_EVAL_ALLOW_DISPATCH=0')
  })
})

describe('role evaluation reading APIs', () => {
  it('only allows reports inside docs/role-evaluations', () => {
    expect(resolveReportFile('/repo', 'docs/role-evaluations/a.md')).toBe(
      '/repo/docs/role-evaluations/a.md'
    )
    expect(() => resolveReportFile('/repo', 'docs/../etc/passwd')).toThrow()
    expect(() =>
      resolveReportFile('/repo', 'agents/main-agent/AGENTS.md')
    ).toThrow()
  })

  it('rejects unknown evaluation ids', async () => {
    const missing = '00000000-0000-0000-0000-000000000000'
    await expect(roleEvaluationReport({ id: missing })).rejects.toThrow(
      '不存在'
    )
    await expect(roleEvaluationMessages({ id: missing })).rejects.toThrow(
      '不存在'
    )
  })
})

describe('role evaluation tasks', () => {
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0)
      return true
    } catch (error) {
      return (error as NodeJS.ErrnoException)?.code === 'EPERM'
    }
  }

  const latestEvaluation = async (agentSlug: string) =>
    db.roleEvaluation.findFirst({
      where: { agentSlug },
      orderBy: { startedAt: 'desc' },
    })

  it('registers the dispatch as a task on the board', async () => {
    const dispatch = await dispatchRoleEvaluation({
      input: { agentSlug: 'main-agent', tool: 'codex' },
    })
    createdFiles.push(dispatch.logPath, dispatch.resultPath)
    createdFiles.push(dispatch.logPath.replace(/\.log$/, '.json'))

    const evaluation = await latestEvaluation('main-agent')
    expect(evaluation?.taskId).toBeTruthy()

    const task = await db.task.findUnique({
      where: { id: evaluation!.taskId! },
    })
    expect(task).toMatchObject({
      agentSlug: 'main-agent',
      status: 'DISPATCHED',
      readOnly: true,
      priority: 'P1',
      title: '岗位评估 · 数字总经理',
    })
    expect(task!.brief).toContain(dispatch.reportPath)
    expect(task!.acceptance).toContain(dispatch.reportPath)
  })

  it('moves the task to review with the report artifact when the evaluation ends', async () => {
    const dispatch = await dispatchRoleEvaluation({
      input: { agentSlug: 'main-agent', tool: 'codex' },
    })
    createdFiles.push(dispatch.logPath, dispatch.resultPath)
    createdFiles.push(dispatch.logPath.replace(/\.log$/, '.json'))

    if (dispatch.pid) {
      await waitFor(() => !alive(dispatch.pid as number), 5000)
    }
    const reportAbsolute = path.join(repoRoot, dispatch.reportPath)
    writeFileSync(reportAbsolute, '# 岗位评估\n\n结论：能力匹配。\n')
    createdFiles.push(dispatch.reportPath)

    const rows = await roleEvaluations({ agentSlug: 'main-agent' })
    const evaluation = rows.find(
      (row) => row.reportPath === dispatch.reportPath
    )
    expect(evaluation?.status).toBe('completed')

    const task = await db.task.findUnique({
      where: { id: evaluation!.taskId! },
      include: { artifacts: true },
    })
    expect(task).toMatchObject({ status: 'AWAITING_REVIEW' })
    expect(task!.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: dispatch.reportPath,
          kind: 'report',
          source: 'evaluation',
        }),
      ])
    )
  })
})

describe('evaluation task self-healing', () => {
  const createTask = (overrides: Record<string, unknown>) =>
    db.task.create({
      data: {
        title: '岗位评估 · 同步测试',
        brief: '测试',
        acceptance: '测试',
        agentSlug: 'sync-test-agent',
        status: 'DISPATCHED',
        readOnly: true,
        ...overrides,
      },
    })

  it('adopts an unlinked evaluation and writes the failure back', async () => {
    const task = await createTask({})
    const evaluation = await db.roleEvaluation.create({
      data: {
        agentSlug: 'sync-test-agent',
        agentName: '同步测试',
        projectKey: 'digital-team',
        projectRoot: repoRoot,
        tool: 'codex',
        status: 'failed',
        reportPath: 'docs/role-evaluations/sync-test.md',
        logPath: 'docs/role-evaluations/logs/sync-test.log',
        startedAt: new Date(task.createdAt.getTime() - 1_000),
        finishedAt: new Date(),
      },
    })

    await syncEvaluationTasks()

    const healed = await db.task.findUnique({ where: { id: task.id } })
    expect(healed?.status).toBe('FAILED')
    expect(healed?.completedAt).toBeTruthy()

    const linked = await db.roleEvaluation.findUnique({
      where: { id: evaluation.id },
    })
    expect(linked?.taskId).toBe(task.id)
  })

  it('does not rewrite a task that already reached the target state', async () => {
    const task = await createTask({ agentSlug: 'idempotent-test-agent' })
    const evaluation = await db.roleEvaluation.create({
      data: {
        agentSlug: 'idempotent-test-agent',
        agentName: '幂等测试',
        projectKey: 'digital-team',
        projectRoot: repoRoot,
        tool: 'codex',
        status: 'failed',
        reportPath: 'docs/role-evaluations/idempotent-test.md',
        logPath: 'docs/role-evaluations/logs/idempotent-test.log',
        startedAt: new Date(task.createdAt.getTime() - 1_000),
        finishedAt: new Date(),
        taskId: task.id,
      },
    })

    await syncEvaluationTasks()
    const first = await db.task.findUnique({ where: { id: task.id } })
    await syncEvaluationTasks()
    const second = await db.task.findUnique({ where: { id: task.id } })

    expect(first?.status).toBe('FAILED')
    expect(second?.updatedAt.getTime()).toBe(first?.updatedAt.getTime())
    expect(evaluation.taskId).toBe(task.id)
  })

  it('closes a stale task that has no evaluation at all', async () => {
    const task = await createTask({
      agentSlug: 'orphan-test-agent',
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
    })

    await syncEvaluationTasks()

    const closed = await db.task.findUnique({ where: { id: task.id } })
    expect(closed?.status).toBe('FAILED')
    expect(closed?.reviewNote).toContain('自动收尾')
  })

  it('closes an evaluation that has been running for too long and syncs its task', async () => {
    const task = await createTask({ agentSlug: 'stale-test-agent' })
    const startedAt = new Date(Date.now() - 7 * 60 * 60 * 1000)
    const evaluation = await db.roleEvaluation.create({
      data: {
        agentSlug: 'stale-test-agent',
        agentName: '僵死测试',
        projectKey: 'digital-team',
        projectRoot: repoRoot,
        tool: 'codex',
        status: 'running',
        // 用当前进程的 pid 模拟"进程还活着但实际已僵死"
        pid: process.pid,
        reportPath: 'docs/role-evaluations/stale-test.md',
        logPath: 'docs/role-evaluations/logs/stale-test.log',
        startedAt,
        taskId: task.id,
      },
    })

    const rows = await roleEvaluations({ agentSlug: 'stale-test-agent' })
    expect(rows[0]).toMatchObject({ status: 'failed' })

    const synced = await db.task.findUnique({ where: { id: task.id } })
    expect(synced?.status).toBe('FAILED')
    const closed = await db.roleEvaluation.findUnique({
      where: { id: evaluation.id },
    })
    expect(closed?.finishedAt).toBeTruthy()
  })

  it('does not overwrite a task that was re-dispatched after the evaluation ended', async () => {
    const finishedAt = new Date(Date.now() - 60 * 60 * 1000)
    const task = await createTask({ agentSlug: 'redispatched-agent' })

    await db.roleEvaluation.create({
      data: {
        agentSlug: 'redispatched-agent',
        agentName: '重派测试',
        projectKey: 'digital-team',
        projectRoot: repoRoot,
        tool: 'codex',
        status: 'failed',
        reportPath: 'docs/role-evaluations/redispatched.md',
        logPath: 'docs/role-evaluations/logs/redispatched.log',
        startedAt: new Date(finishedAt.getTime() - 60_000),
        finishedAt,
        taskId: task.id,
      },
    })
    await db.taskRun.create({
      data: {
        title: task.title,
        platform: 'codex',
        primaryAgent: task.agentSlug,
        status: 'RUNNING',
        currentStage: 'EXECUTION',
        taskId: task.id,
        pid: 999999,
        // 新的尝试开始于评估结束之后
        startedAt: new Date(finishedAt.getTime() + 60_000),
      },
    })

    await syncEvaluationTasks()

    const after = await db.task.findUnique({ where: { id: task.id } })
    expect(after?.status).toBe('DISPATCHED')
  })

  it('keeps a recent task waiting for its evaluation', async () => {
    const task = await createTask({ agentSlug: 'fresh-test-agent' })

    await syncEvaluationTasks()

    const untouched = await db.task.findUnique({ where: { id: task.id } })
    expect(untouched?.status).toBe('DISPATCHED')
  })
})

describe('evaluation failure diagnostics', () => {
  it('reads the last human-readable error line from the log', () => {
    const logPath = 'docs/role-evaluations/logs/failure-reason-test.log'
    const absolute = path.join(repoRoot, logPath)
    writeFileSync(
      absolute,
      [
        JSON.stringify({ type: 'status', phase: 'turn_start' }),
        'dsh: MISSING_CREDENTIAL: no API key',
        '',
      ].join('\n')
    )
    createdFiles.push(logPath)

    expect(failureReasonFromLog(logPath)).toBe(
      'dsh: MISSING_CREDENTIAL: no API key'
    )
    expect(failureReasonFromLog('docs/role-evaluations/logs/missing.log')).toBe(
      ''
    )
  })

  it('only reports a reason for failed records', () => {
    const logPath = 'docs/role-evaluations/logs/failure-reason-test.log'
    const root = { status: 'completed', logPath }

    expect(RoleEvaluation.failureReason(undefined, { root })).toBeNull()
    expect(
      RoleEvaluation.failureReason(undefined, {
        root: { status: 'failed', logPath },
      })
    ).toBe('dsh: MISSING_CREDENTIAL: no API key')
  })
})

describe('dispatch liveness guard', () => {
  it('blocks dispatch when the database still has a live evaluation', async () => {
    const logPath = 'docs/role-evaluations/logs/guard-live.log'
    writeFileSync(path.join(repoRoot, logPath), 'streaming\n')
    createdFiles.push(logPath)

    await db.roleEvaluation.create({
      data: {
        agentSlug: 'design-engineer-agent',
        agentName: '设计实现工程师',
        projectKey: 'digital-team',
        projectRoot: repoRoot,
        tool: 'codex',
        status: 'running',
        pid: process.pid,
        reportPath: 'docs/role-evaluations/guard-live.md',
        logPath,
        startedAt: new Date(),
      },
    })

    await expect(
      dispatchRoleEvaluation({
        input: { agentSlug: 'design-engineer-agent', tool: 'codex' },
      })
    ).rejects.toThrow('仍在运行')
  })

  it('allows dispatch when a stale record only looks alive by pid', async () => {
    const logPath = 'docs/role-evaluations/logs/guard-stale.log'
    const absolute = path.join(repoRoot, logPath)
    writeFileSync(absolute, 'streaming\n')
    createdFiles.push(logPath)
    const stale = new Date(Date.now() - 40 * 60 * 1000)
    utimesSync(absolute, stale, stale)

    await db.roleEvaluation.create({
      data: {
        agentSlug: 'legal-compliance-agent',
        agentName: '法务与合规顾问',
        projectKey: 'digital-team',
        projectRoot: repoRoot,
        tool: 'codex',
        status: 'running',
        // pid 活着但日志 40 分钟没动：应判为僵死，允许重新派发
        pid: process.pid,
        reportPath: 'docs/role-evaluations/guard-stale.md',
        logPath,
        startedAt: stale,
      },
    })

    const dispatched = await dispatchRoleEvaluation({
      input: { agentSlug: 'legal-compliance-agent', tool: 'codex' },
    })
    createdFiles.push(dispatched.logPath, dispatched.resultPath)
    createdFiles.push(dispatched.logPath.replace(/\.log$/, '.json'))
    expect(dispatched.agentSlug).toBe('legal-compliance-agent')
  })
})
