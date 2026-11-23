import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  changedFiles,
  classifyDirectory,
  computeRunDiffStat,
  diffStatDelta,
  snapshotDiffStat,
  snapshotWorkspace,
  summarizeDiffStat,
} from './taskWorkspace'

describe('changedFiles', () => {
  it('returns new and modified files only', () => {
    const before = { 'a.ts': 'M', 'b.ts': '??' }
    const after = { 'a.ts': 'M', 'b.ts': 'M', 'c.ts': '??' }

    expect(changedFiles(before, after)).toEqual(['b.ts', 'c.ts'])
  })

  it('ignores system directories', () => {
    const after = {
      'docs/tasks/logs/x.log': '??',
      'docs/tasks/uploads/20261113/a.png': '??',
      'src/real.ts': 'M',
    }

    expect(changedFiles({}, after)).toEqual(['src/real.ts'])
  })

  it('treats a missing baseline as empty', () => {
    expect(changedFiles(null, { 'x.ts': '??' })).toEqual(['x.ts'])
  })
})

describe('diff stat helpers', () => {
  it('subtracts the dispatch baseline and floors at zero', () => {
    const delta = diffStatDelta(
      { 'api/a.ts': { added: 10, removed: 2 } },
      {
        'api/a.ts': { added: 13, removed: 1 }, // 只算增量：+3 / -0
        'web/b.tsx': { added: 5, removed: 0 }, // 全新文件
      }
    )

    expect(delta).toEqual({
      'api/a.ts': { added: 3, removed: 0 },
      'web/b.tsx': { added: 5, removed: 0 },
    })
  })

  it('drops files that did not change during the run', () => {
    expect(
      diffStatDelta(
        { 'api/a.ts': { added: 4, removed: 4 } },
        {
          'api/a.ts': { added: 4, removed: 4 },
        }
      )
    ).toEqual({})
  })

  it('classifies top-level directories and leaves root files uncategorized', () => {
    const repoRoot = path.join(tmpdir(), `pd-diff-${Date.now()}`)
    fs.mkdirSync(path.join(repoRoot, 'api', 'src'), { recursive: true })
    fs.mkdirSync(path.join(repoRoot, 'web', 'src'), { recursive: true })

    expect(classifyDirectory('api/src/tasks.ts', repoRoot)).toBe('api')
    expect(classifyDirectory('web/src/App.tsx', repoRoot)).toBe('web')
    expect(classifyDirectory('README.md', repoRoot)).toBeNull()
    expect(classifyDirectory('./README.md', repoRoot)).toBeNull()
    expect(classifyDirectory('../escape/api/x.ts', repoRoot)).toBeNull()
    expect(classifyDirectory('docs/plans/x.md', repoRoot)).toBeNull() // 目录不存在

    fs.rmSync(repoRoot, { recursive: true, force: true })
  })

  it('summarizes files and lines per directory plus uncategorized', () => {
    const repoRoot = path.join(tmpdir(), `pd-diff-${Date.now()}-2`)
    fs.mkdirSync(path.join(repoRoot, 'api'), { recursive: true })
    fs.mkdirSync(path.join(repoRoot, 'web'), { recursive: true })

    const summary = summarizeDiffStat(
      {
        'api/src/a.ts': { added: 10, removed: 2 },
        'api/src/b.ts': { added: 4, removed: 0 },
        'web/src/c.tsx': { added: 6, removed: 1 },
        'README.md': { added: 3, removed: 0 },
      },
      repoRoot
    )

    expect(summary.files).toBe(4)
    expect(summary.added).toBe(23)
    expect(summary.removed).toBe(3)
    expect(summary.byDirectory).toEqual({
      api: { files: 2, added: 14, removed: 2 },
      web: { files: 1, added: 6, removed: 1 },
    })
    expect(summary.uncategorized).toEqual({ files: 1, added: 3, removed: 0 })

    fs.rmSync(repoRoot, { recursive: true, force: true })
  })
})

describe('snapshotDiffStat', () => {
  let repoRoot: string

  beforeAll(() => {
    repoRoot = fs.mkdtempSync(path.join(tmpdir(), 'pd-git-'))
    execFileSync('git', ['init', '-q'], { cwd: repoRoot })
    execFileSync('git', ['config', 'user.email', 'test@example.com'], {
      cwd: repoRoot,
    })
    execFileSync('git', ['config', 'user.name', 'test'], { cwd: repoRoot })
    fs.mkdirSync(path.join(repoRoot, 'api'), { recursive: true })
    fs.writeFileSync(path.join(repoRoot, 'api/keep.ts'), 'export const a = 1\n')
    execFileSync('git', ['add', '.'], { cwd: repoRoot })
    execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoRoot })
  })

  afterAll(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true })
  })

  it('counts modified, new and ignored files correctly', async () => {
    fs.writeFileSync(
      path.join(repoRoot, 'api/keep.ts'),
      'export const a = 2\nexport const b = 3\n'
    )
    fs.mkdirSync(path.join(repoRoot, 'docs', 'tasks', 'logs'), {
      recursive: true,
    })
    fs.writeFileSync(path.join(repoRoot, 'docs/tasks/logs/run.log'), 'x\n')

    const snapshot = await snapshotDiffStat(repoRoot)

    // 相对 HEAD：+2 / -1
    expect(snapshot['api/keep.ts']).toEqual({ added: 2, removed: 1 })
    // 系统日志不计入
    expect(snapshot['docs/tasks/logs/run.log']).toBeUndefined()
  })

  it('counts untracked files as added lines', async () => {
    fs.mkdirSync(path.join(repoRoot, 'web'), { recursive: true })
    fs.writeFileSync(path.join(repoRoot, 'web/new.tsx'), 'a\nb\nc\n')

    const scoped = await snapshotDiffStat(repoRoot, ['web/new.tsx'])
    expect(scoped['web/new.tsx']).toEqual({ added: 3, removed: 0 })
  })

  it('returns the run delta when a baseline is supplied', async () => {
    const baseline = await snapshotDiffStat(repoRoot)
    fs.appendFileSync(path.join(repoRoot, 'web/new.tsx'), 'd\n')

    const stat = await computeRunDiffStat({
      repoRoot,
      baseline,
      files: ['web/new.tsx'],
    })

    expect(stat).not.toBeNull()
    expect(stat?.files).toBe(1)
    expect(stat?.added).toBe(1)
    expect(stat?.byDirectory.web).toEqual({ files: 1, added: 1, removed: 0 })
  })
})

it('detects content changes while a tracked file remains M across consecutive runs', async () => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'task-fingerprint-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: root })
    fs.writeFileSync(path.join(root, '中文 文件.ts'), 'original')
    execFileSync('git', ['add', '.'], { cwd: root })
    fs.writeFileSync(path.join(root, '中文 文件.ts'), 'first round')
    const first = await snapshotWorkspace(root)
    expect(changedFiles(first, await snapshotWorkspace(root))).toEqual([])
    fs.writeFileSync(path.join(root, '中文 文件.ts'), 'second round')
    const second = await snapshotWorkspace(root)
    expect(changedFiles(first, second)).toEqual(['中文 文件.ts'])
    expect(changedFiles({ '中文 文件.ts': 'AM' }, second)).toEqual([])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

it('distinguishes unavailable statistics from a successful zero delta', async () => {
  expect(
    await computeRunDiffStat({ repoRoot: '/missing-task-repo', baseline: {} })
  ).toBeNull()
  expect(summarizeDiffStat({}, process.cwd())).toMatchObject({
    files: 0,
    added: 0,
    removed: 0,
  })
})
