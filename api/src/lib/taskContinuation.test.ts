import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { readSessionTurnTrace } from './sessionTrace'
import {
  artifactAvailability,
  buildTaskContinuation,
  normalizeArtifactPath,
} from './taskContinuation'

jest.mock('./sessionTrace', () => ({
  ...jest.requireActual('./sessionTrace'),
  readSessionTurnTrace: jest.fn(),
}))

const historicalRun = (index = 0) => ({
  id: `run-${index}`,
  status: 'COMPLETED',
  mode: 'auto',
  platform: 'codex',
  summary: `历史摘要 ${index}`,
  externalReference: `task:run-${index}:session-${index}`,
})
const message = (role, content) => ({ role, content, createdAt: new Date() })
const trace = readSessionTurnTrace as jest.Mock
beforeEach(() => {
  trace.mockResolvedValue({
    messages: [],
    tools: [],
    source: 'none',
    truncated: false,
  })
})

it('uses five latest summaries, prioritizes cited artifacts, and explains omissions and missing sessions', async () => {
  const result = await buildTaskContinuation({
    taskId: 'task-1',
    runs: Array.from({ length: 7 }, (_, i) => historicalRun(i)),
    artifacts: Array.from({ length: 25 }, (_, i) => ({
      path: `docs/${i}.md`,
      kind: 'report',
      label: `${i}`,
    })),
    note: '继续修改 docs/0.md',
    reviewNote: '历史验收通过',
    repoRoot: process.cwd(),
  })
  expect(result.metadata.sourceRunIds).toHaveLength(5)
  expect(result.metadata.omittedRuns).toBe(2)
  expect(result.metadata.omittedArtifacts).toBe(5)
  expect(result.text).toContain('docs/0.md')
  expect(result.text).not.toContain('docs/1.md /')
  expect(result.text).toContain('task(id: "task-1")')
  expect(result.text).toContain('历史会话不可用，已使用摘要续接')
  expect(result.text).toContain('历史验收意见')
})

it('excludes injected instructions, dispatch prompts, commentary and credential lines', async () => {
  trace.mockResolvedValue({
    messages: [
      message('user', '# AGENTS.md instructions\nsecret rules'),
      message('user', 'My request: old injected dispatch'),
      message('user', '请继续修改标题\napi_key=private-value'),
      message('assistant', '正在检查文件'),
      message('assistant', '已完成标题修改'),
    ],
    tools: [{ result: 'raw tool log' }],
    truncated: false,
  })
  const result = await buildTaskContinuation({
    taskId: 'task',
    runs: [historicalRun()],
    artifacts: [],
    repoRoot: process.cwd(),
  })
  expect(result.text).toContain('请继续修改标题')
  expect(result.text).toContain('已完成标题修改')
  expect(result.text).not.toMatch(
    /secret rules|old injected dispatch|private-value|正在检查文件|raw tool log/
  )
  expect(result.metadata.messageCount).toBe(2)
})

it('caps historical text and messages without clipping current requirements', async () => {
  trace.mockResolvedValue({
    messages: Array.from({ length: 30 }, () =>
      message('user', '历史'.repeat(3000))
    ),
    tools: [],
    truncated: true,
  })
  const result = await buildTaskContinuation({
    taskId: 'task',
    runs: [historicalRun()],
    artifacts: [],
    repoRoot: process.cwd(),
  })
  expect(result.text.length).toBeLessThanOrEqual(20_000)
  expect(result.metadata.messageCount).toBeLessThanOrEqual(20)
  expect(result.metadata.truncated).toBe(true)
  expect(result.text).toContain('已裁剪')
})

it('normalizes duplicate paths and checks local boundaries without fetching URLs', () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'task-artifacts-'))
  try {
    fs.writeFileSync(path.join(root, 'a.md'), 'artifact')
    fs.symlinkSync('/etc/hosts', path.join(root, 'outside'))
    expect(normalizeArtifactPath('./docs/../a.md')).toBe('a.md')
    expect(artifactAvailability('a.md', root)).toBe('available')
    expect(artifactAvailability('missing.md', root)).toBe('missing')
    expect(artifactAvailability('../escape', root)).toBe('unavailable')
    expect(artifactAvailability('outside', root)).toBe('unavailable')
    expect(artifactAvailability('https://example.com/result', root)).toBe(
      'reference'
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
