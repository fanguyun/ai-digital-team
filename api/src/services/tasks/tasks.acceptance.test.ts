import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { parse } from 'yaml'

import { db } from 'src/lib/db'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'

import {
  createTask,
  dispatchTask,
  executeTaskPlan,
  reviseTaskPlan,
  reviewTask,
  task,
  taskPlanContent,
} from './tasks'

jest.mock('src/lib/roleEvaluationDispatch', () => ({
  ...jest.requireActual('src/lib/roleEvaluationDispatch'),
  resolveRepoRoot: jest.fn(),
}))

const realAcceptance =
  process.env.P0_REAL_AGENTS === '1' ? describe : describe.skip

realAcceptance('real CLI approval acceptance in an isolated workspace', () => {
  const sourceRoot = path.resolve(__dirname, '../../../..')
  const previousHome = process.env.DSH_HOME
  const previousGatewayKey = process.env.MAGPIE_GATEWAY_KEY
  let workspace: string
  let isolatedHome: string

  beforeAll(() => {
    const databaseUrl = new URL(process.env.DATABASE_URL || '')
    if (
      databaseUrl.port !== '55439' ||
      databaseUrl.pathname !== '/pdt_p0_test'
    ) {
      throw new Error(
        'Real acceptance requires the isolated P0 database on port 55439'
      )
    }
  })

  beforeEach(() => {
    workspace = mkdtempSync(path.join(tmpdir(), 'pdt-p0-real-'))
    jest.mocked(resolveRepoRoot).mockReturnValue(workspace)
    mkdirSync(path.join(workspace, 'agents/main-agent'), { recursive: true })
    mkdirSync(path.join(workspace, 'dsh'), { recursive: true })
    writeFileSync(
      path.join(workspace, 'agents/manifest.json'),
      JSON.stringify({
        agents: [{ slug: 'main-agent', name: '验收岗位' }],
      })
    )
    writeFileSync(
      path.join(workspace, 'agents/main-agent/AGENTS.md'),
      '# 验收岗位\n## Role\n完成隔离验收任务。\n## Context\n本目录是一次性测试工作区。\n## Capabilities\n读写验收文本。\n## Instructions\n只按任务需求操作本目录，不调用团队运行接口，不安装工具，不操作本目录外文件。'
    )
    writeFileSync(path.join(workspace, 'fixture.txt'), 'before\n')
    copyFileSync(
      path.join(sourceRoot, 'dsh/task-readonly.patch.yml'),
      path.join(workspace, 'dsh/task-readonly.patch.yml')
    )
    isolatedHome = mkdtempSync(path.join(tmpdir(), 'pdt-p0-dsh-home-'))
    const sourceHome = previousHome || path.join(process.env.HOME!, '.dsh')
    if (existsSync(path.join(sourceHome, '.credentials.yaml'))) {
      const credentials = parse(
        readFileSync(path.join(sourceHome, '.credentials.yaml'), 'utf8')
      )
      process.env.MAGPIE_GATEWAY_KEY =
        previousGatewayKey || credentials.refs?.MAGPIE_GATEWAY_KEY
    }
    mkdirSync(path.join(isolatedHome, 'profiles/headless'), { recursive: true })
    for (const file of ['cordis.yml', 'cordis.patch.yml', 'package.json']) {
      copyFileSync(
        path.join(sourceHome, 'profiles/headless', file),
        path.join(isolatedHome, 'profiles/headless', file)
      )
    }
    process.env.DSH_HOME = isolatedHome
  })

  afterEach(() => {
    if (previousGatewayKey === undefined) delete process.env.MAGPIE_GATEWAY_KEY
    else process.env.MAGPIE_GATEWAY_KEY = previousGatewayKey
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (existsSync(path.join(workspace, 'docs/tasks/logs'))) {
      cpSync(
        path.join(workspace, 'docs/tasks/logs'),
        path.join(tmpdir(), 'pdt-p0-cli-evidence', path.basename(workspace)),
        { recursive: true }
      )
    }
    rmSync(workspace, { recursive: true, force: true })
    rmSync(isolatedHome, { recursive: true, force: true })
  })

  const waitForResult = async (id: string) => {
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      const current = await task({ id })
      if (current.status === 'FAILED')
        throw new Error(`Real CLI failed: ${current.reviewNote}`)
      if (!['DISPATCHED', 'RUNNING'].includes(current.status)) return current
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
    throw new Error('Real CLI run exceeded the three-minute acceptance limit')
  }

  it.each(['codex', 'deepseek-harness'])(
    '%s plans, revises, approves, executes and reviews without early writes',
    async (platform) => {
      const created = await createTask({
        input: {
          title: `P0 ${platform} 隔离验收`,
          brief:
            '仅将工作区 fixture.txt 的 before 一行改成 after 一行。只操作此文件，不改其他文件。方案阶段只读取该文件并返回六部分简短方案。已获得本测试的计划、修订、批准和执行授权，执行阶段直接完成，无需再次确认。',
          acceptance:
            'fixture.txt 最终内容为 after 加换行；计划阶段不改变 fixture.txt；执行阶段最后一行返回 artifact: fixture.txt。',
          agentSlug: 'main-agent',
          mode: 'plan',
          readOnly: false,
        },
      })
      const started = Date.now()
      await dispatchTask({ id: created.id, tool: platform })
      const planned = await waitForResult(created.id)
      expect(planned.status).toBe('AWAITING_APPROVAL')
      expect(readFileSync(path.join(workspace, 'fixture.txt'), 'utf8')).toBe(
        'before\n'
      )
      const firstPlan = planned.planPath!
      expect(
        (await taskPlanContent({ taskId: created.id, planPath: firstPlan }))
          .length
      ).toBeGreaterThan(50)
      await reviseTaskPlan({
        id: created.id,
        note: '在方案中补充：用逐字读取 fixture.txt 确认 after 和末尾换行。仍然只输出方案。',
      })
      const revised = await waitForResult(created.id)
      expect(revised.status).toBe('AWAITING_APPROVAL')
      expect(revised.planPath).not.toBe(firstPlan)
      expect(readFileSync(path.join(workspace, 'fixture.txt'), 'utf8')).toBe(
        'before\n'
      )
      await expect(
        executeTaskPlan({ id: created.id, planPath: firstPlan })
      ).rejects.toThrow('方案版本已变化')
      await executeTaskPlan({ id: created.id, planPath: revised.planPath! })
      const executed = await waitForResult(created.id)
      expect(executed.status).toBe('AWAITING_REVIEW')
      expect(readFileSync(path.join(workspace, 'fixture.txt'), 'utf8')).toBe(
        'after\n'
      )
      const reviewed = await reviewTask({
        id: created.id,
        decision: 'APPROVE',
        note: '已逐字确认隔离工作区产物及方案阶段无写入。',
      })
      expect(reviewed.status).toBe('DONE')
      const runs = await db.taskRun.findMany({
        where: { taskId: created.id },
        orderBy: { startedAt: 'asc' },
      })
      expect(runs.map((run) => run.mode)).toEqual(['plan', 'plan', 'execute'])
      expect(
        runs.every(
          (run) => run.platform === platform && run.status === 'COMPLETED'
        )
      ).toBe(true)
      writeFileSync(
        path.join(tmpdir(), `pdt-p0-real-${platform}.json`),
        JSON.stringify(
          {
            platform,
            taskId: created.id,
            status: reviewed.status,
            elapsedMs: Date.now() - started,
            runs: runs.map(
              ({ id, mode, status, inputTokens, outputTokens }) => ({
                id,
                mode,
                status,
                inputTokens,
                outputTokens,
              })
            ),
            firstPlan,
            revisedPlan: revised.planPath,
            fixture: 'after\n',
          },
          null,
          2
        )
      )
    },
    600_000
  )
})
