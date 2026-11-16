import { execFile } from 'node:child_process'
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
