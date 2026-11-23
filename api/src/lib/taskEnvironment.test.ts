import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { loadKnowledgeSource, probeKnowledgeBridge } from './knowledgeSource'
import { probeSiYuan } from './siyuanKnowledge'
import { checkTaskEnvironment } from './taskEnvironment'

jest.mock('./knowledgeSource', () => ({
  loadKnowledgeSource: jest.fn(),
  probeKnowledgeBridge: jest.fn(),
}))
jest.mock('./siyuanKnowledge', () => ({ probeSiYuan: jest.fn() }))

let repo: string
const env = {
  TASK_RUNTIME_API_URL: 'http://localhost:8901/graphql',
  TASK_RUNTIME_WRITE_TOKEN: 'private-token',
}
const task = {
  title: '报告任务',
  acceptance: 'docs/report.md',
  agentSlug: 'main-agent',
  useKnowledge: false,
}
const success = () => new Response(JSON.stringify({ data: { taskRun: null } }))
beforeEach(() => {
  jest.clearAllMocks()
  repo = mkdtempSync(path.join(tmpdir(), 'task-environment-'))
  jest
    .mocked(loadKnowledgeSource)
    .mockResolvedValue({ status: 'disabled', source: 'none' })
})
afterEach(() => rmSync(repo, { recursive: true, force: true }))

it('checks runtime auth without reading real tasks and keeps sandbox capability unverified', async () => {
  const fetchImpl = jest.fn().mockImplementation(async () => success())
  const result = await checkTaskEnvironment(task, repo, { env, fetchImpl })
  expect(result.ready).toBe(true)
  expect(result.checks.find((check) => check.key === 'execution')?.status).toBe(
    'WARNING'
  )
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({
    redirect: 'error',
    method: 'POST',
  })
  expect(fetchImpl.mock.calls[0][1].body).toContain(
    '00000000-0000-0000-0000-000000000000'
  )
  expect(JSON.stringify(result)).not.toContain('private-token')
})

it.each([
  'missing-token',
  'auth',
  'unreachable',
  'invalid-json',
  'oversized',
  'redirect-url',
])('blocks unusable runtime configuration (%s)', async (failure) => {
  const fetchImpl = jest.fn().mockImplementation(async () => {
    if (failure === 'unreachable')
      throw new Error('private-token network failure')
    if (failure === 'auth')
      return new Response(
        JSON.stringify({ errors: [{ message: 'private-token rejected' }] }),
        { status: 401 }
      )
    if (failure === 'invalid-json') return new Response('invalid')
    if (failure === 'oversized') return new Response('x'.repeat(9000))
    return success()
  })
  const result = await checkTaskEnvironment(task, repo, {
    env: {
      ...env,
      ...(failure === 'missing-token' ? { TASK_RUNTIME_WRITE_TOKEN: '' } : {}),
      ...(failure === 'redirect-url'
        ? { TASK_RUNTIME_API_URL: 'http://user:secret@localhost/graphql' }
        : {}),
    },
    fetchImpl,
  })
  expect(result.ready).toBe(false)
  expect(JSON.stringify(result)).not.toMatch(/private-token|user:secret/)
})

it('does not contact task-provided URLs and blocks missing SiYuan configuration when the task needs it', async () => {
  const fetchImpl = jest.fn().mockImplementation(async () => success())
  const result = await checkTaskEnvironment(
    { ...task, brief: '写入思源 http://unknown.invalid/api' },
    repo,
    { env, fetchImpl }
  )
  expect(result.ready).toBe(false)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(result.checks.find((check) => check.key === 'knowledge')?.status).toBe(
    'BLOCKED'
  )
})

it('warns for optional knowledge but blocks required knowledge and uses the configured read-only probe', async () => {
  const source = {
    status: 'ok',
    source: 'database',
    provider: 'siyuan',
    origin: 'http://localhost:6806',
    token: 'knowledge-secret',
    timeoutMs: 2000,
    notebooks: [],
    pathPrefixes: [],
  } as const
  jest.mocked(probeSiYuan).mockResolvedValue({ ok: false, checks: [] })
  for (const mode of ['optional', 'required'] as const) {
    jest
      .mocked(loadKnowledgeSource)
      .mockResolvedValue({ ...source, notebooks: [], pathPrefixes: [], mode })
    const result = await checkTaskEnvironment(
      { ...task, useKnowledge: true },
      repo,
      { env, fetchImpl: jest.fn(async () => success()) }
    )
    expect(result.ready).toBe(mode === 'optional')
    expect(JSON.stringify(result)).not.toContain('knowledge-secret')
  }
  expect(probeSiYuan).toHaveBeenCalledTimes(2)
  expect(probeKnowledgeBridge).not.toHaveBeenCalled()
})

it('blocks a target symlink escaping the repository and allows a creatable missing directory', async () => {
  mkdirSync(path.join(repo, 'docs'))
  symlinkSync(tmpdir(), path.join(repo, 'docs/external'))
  const result = await checkTaskEnvironment(
    {
      ...task,
      acceptance: '交付 docs/external/report.md 和 docs/new/report.md',
    },
    repo,
    { env, fetchImpl: jest.fn(async () => success()) }
  )
  expect(
    result.checks.find((check) => check.key === 'path:docs/external/report.md')
      ?.status
  ).toBe('BLOCKED')
  expect(
    result.checks.find((check) => check.key === 'path:docs/new/report.md')
      ?.status
  ).toBe('PASS')
})

it.each([{ readOnly: true }, { mode: 'plan' }])(
  'allows readable reference files and warns for global skill links (%j)',
  async (mode) => {
    mkdirSync(path.join(repo, 'api'))
    writeFileSync(path.join(repo, 'api/readonly.ts'), 'export {}')
    chmodSync(path.join(repo, 'api/readonly.ts'), 0o444)
    mkdirSync(path.join(repo, '.agents/skills'), { recursive: true })
    symlinkSync(tmpdir(), path.join(repo, '.agents/skills/global'))
    const result = await checkTaskEnvironment(
      {
        ...task,
        ...mode,
        brief: '审查 api/readonly.ts 与 .agents/skills/global/SKILL.md',
      },
      repo,
      { env, fetchImpl: jest.fn(async () => success()) }
    )
    expect(result.ready).toBe(true)
    expect(
      result.checks.find((check) => check.key === 'path:api/readonly.ts')
        ?.status
    ).toBe('PASS')
    expect(
      result.checks.find(
        (check) => check.key === 'path:.agents/skills/global/SKILL.md'
      )?.status
    ).toBe('WARNING')
  }
)

it('does not require a live SiYuan service merely to review its adapter code', async () => {
  const result = await checkTaskEnvironment(
    { ...task, title: '审查思源API适配代码' },
    repo,
    { env, fetchImpl: jest.fn(async () => success()) }
  )
  expect(result.ready).toBe(true)
  expect(loadKnowledgeSource).not.toHaveBeenCalled()
})
