import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { UserInputError } from '@cedarjs/graphql-server'

import { dispatchRoleEvaluation, roleEvaluationTools } from './roleEvaluations'

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
    expect(dispatch.prompt).toContain('My request: 岗位评估更新：数字总经理')

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
          input: { agentSlug: 'personal-executive-assistant-agent', tool: 'codex' },
        })
      ).rejects.toThrow('仍在运行')
      await expect(
        dispatchRoleEvaluation({
          input: { agentSlug: 'personal-executive-assistant-agent', tool: 'codex' },
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
