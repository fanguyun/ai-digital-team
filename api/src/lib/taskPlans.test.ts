import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { saveTaskPlan } from './taskPlans'

const taskId = '11111111-1111-4111-8111-111111111111'
const runId = '22222222-2222-4222-8222-222222222222'
let repoRoot: string
beforeEach(() => {
  repoRoot = mkdtempSync(path.join(tmpdir(), 'task-plan-'))
})
afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true })
})

describe('system plan persistence', () => {
  it('saves a full plan once and refuses an overwrite with different content', () => {
    const content = '# 方案\n' + '完整方案正文。'.repeat(300)
    const input = { repoRoot, taskId, runId, content }
    const relative = saveTaskPlan(input)
    expect(readFileSync(path.join(repoRoot, relative), 'utf8')).toBe(content)
    expect(saveTaskPlan(input)).toBe(relative)
    expect(() => saveTaskPlan({ ...input, content: '另一个方案' })).toThrow(
      '不能覆盖'
    )
  })

  it('rejects empty, oversized and untrusted-path plans', () => {
    const input = { repoRoot, taskId, runId, content: '' }
    expect(() => saveTaskPlan(input)).toThrow('未返回方案正文')
    expect(() =>
      saveTaskPlan({ ...input, content: '中'.repeat(70_000) })
    ).toThrow('200 KB')
    expect(() =>
      saveTaskPlan({ ...input, taskId: '../outside', content: '# 方案' })
    ).toThrow('标识无效')
  })

  it('rejects symlinked plan directories without writing through them', () => {
    const outside = mkdtempSync(path.join(tmpdir(), 'task-plan-outside-'))
    try {
      mkdirSync(path.join(repoRoot, 'docs'))
      symlinkSync(outside, path.join(repoRoot, 'docs/plans'), 'junction')
      expect(() =>
        saveTaskPlan({ repoRoot, taskId, runId, content: '# 方案' })
      ).toThrow('真实目录')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
