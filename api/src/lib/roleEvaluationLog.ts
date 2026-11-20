import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'

const LOG_TAIL_MAX = 4000
const REASON_MAX = 500

/**
 * 从评估日志尾部取最后一行人类可读的报错。
 * 日志是 JSONL 事件流，最后一行通常是 CLI 直接打印的错误（如 dsh 的 MISSING_CREDENTIAL）。
 */
export const failureReasonFromLog = (
  logPath: string | null | undefined,
  max = REASON_MAX
) => {
  if (!logPath) return ''
  try {
    const absolute = path.resolve(resolveRepoRoot(), logPath)
    const text = readFileSync(absolute, 'utf8').slice(-LOG_TAIL_MAX)
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const last = lines.at(-1) || ''
    if (!last || last.startsWith('{')) return ''
    return last.length > max ? `${last.slice(0, max - 1)}…` : last
  } catch {
    return ''
  }
}

/** 日志多久没更新就算进程已经不再实际工作（用于识别 pid 被复用） */
export const logAgeMs = (logPath: string | null | undefined) => {
  if (!logPath) return null
  try {
    return (
      Date.now() - statSync(path.resolve(resolveRepoRoot(), logPath)).mtimeMs
    )
  } catch {
    return null
  }
}
