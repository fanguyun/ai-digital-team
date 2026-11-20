import { execFile } from 'node:child_process'
import { readFileSync, lstatSync, statSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** 这些目录是系统自己写的（日志、上传图），不算任务产物 */
const IGNORED_PREFIXES = [
  'docs/tasks/logs/',
  'docs/tasks/uploads/',
  'docs/role-evaluations/logs/',
  '.dsh/',
  'node_modules/',
  'api/db/generated/',
  'web/dist/',
  'api/dist/',
]

const isIgnored = (file: string) =>
  IGNORED_PREFIXES.some((prefix) => file.startsWith(prefix))

export type WorkspaceSnapshot = Record<string, string>

/**
 * 记一次工作区快照：路径 → git 状态码。
 * 派发前记一次，结束时再记一次，差集就是这次任务真正改动的文件。
 */
export const snapshotWorkspace = async (
  repoRoot: string
): Promise<WorkspaceSnapshot> => {
  try {
    const { stdout } = await run('git', ['status', '--porcelain=v1', '-uall'], {
      cwd: repoRoot,
      maxBuffer: 8 * 1024 * 1024,
    })

    const snapshot: WorkspaceSnapshot = {}
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const status = line.slice(0, 2).trim()
      const file = line.slice(3).trim()
      if (!file || isIgnored(file)) continue
      snapshot[file] = status
    }
    return snapshot
  } catch {
    return {}
  }
}

/**
 * 对比两次快照，返回新增或被修改的文件。
 * 只出现状态变化（例如 M → 无变化）不算。
 */
export const changedFiles = (
  before: WorkspaceSnapshot | null | undefined,
  after: WorkspaceSnapshot
) => {
  const baseline = before || {}
  const changed: string[] = []

  for (const [file, status] of Object.entries(after)) {
    if (isIgnored(file)) continue
    const previous = baseline[file]
    if (previous === status) continue
    changed.push(file)
  }

  return changed.sort()
}

/* ------------------------------------------------------------------ *
 * 交付物统计：按运行统计改动文件数与增删行数，并按顶层目录分组
 * ------------------------------------------------------------------ */

/** 这些前缀同样不计入交付统计（系统日志、构建产物、备份包等） */
const DIFF_IGNORED_PREFIXES = [...IGNORED_PREFIXES, 'exports/']

const MAX_UNTRACKED_BYTES = 512 * 1024

export type FileDiff = { added: number; removed: number }
export type DiffSnapshot = Record<string, FileDiff>
export type DirectoryStat = { files: number; added: number; removed: number }

export type RunDiffStat = {
  files: number
  added: number
  removed: number
  byDirectory: Record<string, DirectoryStat>
  uncategorized: DirectoryStat
}

const emptyStat = (): DirectoryStat => ({ files: 0, added: 0, removed: 0 })

const isDiffIgnored = (file: string) =>
  DIFF_IGNORED_PREFIXES.some((prefix) => file.startsWith(prefix))

/** numstat 里重命名会写成 "{old => new}" 或 "old => new" */
const normalizedPath = (raw: string) => {
  const rename = raw.match(/^(.*)\{(.*) => (.*)\}(.*)$/)
  if (rename) return `${rename[1]}${rename[3]}${rename[4]}`.trim()
  const arrow = raw.match(/^.* => (.*)$/)
  return arrow ? arrow[1].trim() : raw.trim()
}

const countLines = (text: string) => {
  if (!text) return 0
  const lines = text.split('\n')
  return text.endsWith('\n') ? lines.length - 1 : lines.length
}

/** 未跟踪文件没法用 numstat，直接按文件行数当作新增 */
const untrackedAdded = (repoRoot: string, file: string): FileDiff | null => {
  try {
    const absolute = path.join(repoRoot, file)
    const stats = lstatSync(absolute)
    if (!stats.isFile() || stats.size > MAX_UNTRACKED_BYTES) return null
    const buffer = readFileSync(absolute)
    if (buffer.includes(0)) return null
    return { added: countLines(buffer.toString('utf8')), removed: 0 }
  } catch {
    return null
  }
}

/**
 * 记录工作区相对 HEAD 的逐文件改动。
 * 传入 files 时只统计这些文件（结束时用，避免扫全仓库）。
 */
export const snapshotDiffStat = async (
  repoRoot: string,
  files?: string[]
): Promise<DiffSnapshot> => {
  const snapshot: DiffSnapshot = {}
  const scoped = files?.length
    ? files.filter((file) => !isDiffIgnored(file))
    : null
  if (scoped && scoped.length === 0) return snapshot

  try {
    const args = ['diff', '--numstat', 'HEAD', '--']
    const { stdout } = await run('git', scoped ? [...args, ...scoped] : args, {
      cwd: repoRoot,
      maxBuffer: 8 * 1024 * 1024,
    })
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const [addedRaw, removedRaw, ...rest] = line.split('\t')
      const file = normalizedPath(rest.join('\t'))
      if (!file || isDiffIgnored(file)) continue
      // 二进制文件 numstat 用 "-" 表示
      if (addedRaw === '-' || removedRaw === '-') continue
      snapshot[file] = {
        added: Number(addedRaw) || 0,
        removed: Number(removedRaw) || 0,
      }
    }
  } catch {
    return snapshot
  }

  // 未跟踪的新文件不在 diff 里，按行数补上
  try {
    const { stdout } = await run('git', ['status', '--porcelain=v1', '-uall'], {
      cwd: repoRoot,
      maxBuffer: 8 * 1024 * 1024,
    })
    for (const line of stdout.split('\n')) {
      if (!line.startsWith('?? ')) continue
      const file = line.slice(3).trim()
      if (!file || isDiffIgnored(file)) continue
      if (scoped && !scoped.includes(file)) continue
      const counted = untrackedAdded(repoRoot, file)
      if (counted) snapshot[file] = counted
    }
  } catch {
    // 读不到就只用已跟踪部分的统计
  }

  return snapshot
}

/** 结束时的数值减去派发时的基线，得到这次运行真正贡献的改动 */
export const diffStatDelta = (
  before: DiffSnapshot | null | undefined,
  after: DiffSnapshot
): DiffSnapshot => {
  const baseline = before || {}
  const delta: DiffSnapshot = {}
  for (const [file, current] of Object.entries(after)) {
    const base = baseline[file] || { added: 0, removed: 0 }
    const added = Math.max(0, current.added - base.added)
    const removed = Math.max(0, current.removed - base.removed)
    if (added === 0 && removed === 0) continue
    delta[file] = { added, removed }
  }
  return delta
}

/**
 * 文件属于哪个项目目录：取第一段路径，且该目录真实存在于仓库里。
 * 根目录文件（README.md 等）返回 null，不参与分类。
 */
export const classifyDirectory = (
  file: string,
  repoRoot: string
): string | null => {
  const normalized = path.normalize(file).replace(/^\.\//, '')
  if (
    !normalized ||
    normalized.startsWith('..') ||
    path.isAbsolute(normalized)
  ) {
    return null
  }
  const segments = normalized.split(path.sep).filter(Boolean)
  if (segments.length < 2) return null
  const [first] = segments
  if (first.startsWith('.')) return null
  try {
    if (!statSync(path.join(repoRoot, first)).isDirectory()) return null
  } catch {
    return null
  }
  return first
}

export const summarizeDiffStat = (
  delta: DiffSnapshot,
  repoRoot: string
): RunDiffStat => {
  const byDirectory: Record<string, DirectoryStat> = {}
  const uncategorized = emptyStat()
  let files = 0
  let added = 0
  let removed = 0

  for (const [file, diff] of Object.entries(delta)) {
    files += 1
    added += diff.added
    removed += diff.removed

    const directory = classifyDirectory(file, repoRoot)
    const bucket = directory
      ? (byDirectory[directory] ??= emptyStat())
      : uncategorized
    bucket.files += 1
    bucket.added += diff.added
    bucket.removed += diff.removed
  }

  return { files, added, removed, byDirectory, uncategorized }
}

/** 汇总一次运行的交付统计；没有改动时返回 null */
export const computeRunDiffStat = async ({
  repoRoot,
  baseline,
  files,
}: {
  repoRoot: string
  baseline: DiffSnapshot | null | undefined
  files?: string[]
}): Promise<RunDiffStat | null> => {
  const after = await snapshotDiffStat(repoRoot, files)
  const delta = diffStatDelta(baseline, after)
  if (Object.keys(delta).length === 0) return null
  return summarizeDiffStat(delta, repoRoot)
}

export type MergedDiffStat = {
  files: number
  added: number
  removed: number
  /** 有交付统计的运行数 */
  covered: number
  byDirectory: Record<string, DirectoryStat>
  uncategorized: DirectoryStat
}

/** 把多个运行的统计合并成一份汇总（周报用） */
export const mergeRunDiffStats = (
  stats: Array<RunDiffStat | null | undefined>
): MergedDiffStat => {
  const byDirectory: Record<string, DirectoryStat> = {}
  const uncategorized = emptyStat()
  let files = 0
  let added = 0
  let removed = 0
  let covered = 0

  for (const stat of stats) {
    if (!stat) continue
    covered += 1
    files += stat.files
    added += stat.added
    removed += stat.removed

    for (const [directory, bucket] of Object.entries(stat.byDirectory || {})) {
      const target = (byDirectory[directory] ??= emptyStat())
      target.files += bucket.files
      target.added += bucket.added
      target.removed += bucket.removed
    }

    const rest = stat.uncategorized
    if (rest) {
      uncategorized.files += rest.files
      uncategorized.added += rest.added
      uncategorized.removed += rest.removed
    }
  }

  return { files, added, removed, covered, byDirectory, uncategorized }
}
