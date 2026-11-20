import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

/** 验收标准/需求里可能出现的仓库内路径，例如 docs/role-evaluations/x.md */
const PATH_PATTERN =
  /(?:^|[\s（(,，:：])((?:docs|agents|api|web|scripts|\.agents)\/[A-Za-z0-9._*/-]+)/g

const MAX_PATHS = 10

const normalizePath = (value: string) =>
  value.replace(/[.。,，;；)）]+$/, '').replace(/^\/+/, '')

/** 从一段需求/验收标准文字里取出提到过的交付物路径 */
export const extractDeliverablePaths = (texts: string[]): string[] => {
  const found: string[] = []
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(PATH_PATTERN)) {
      const candidate = normalizePath(match[1])
      if (!candidate || candidate.includes('..')) continue
      if (!found.includes(candidate)) found.push(candidate)
      if (found.length >= MAX_PATHS) return found
    }
  }
  return found
}

/** docs/ 下是汇报产物，写文件不等于改代码，不算与只读冲突 */
const isCodePath = (relative: string) => !/^docs\//i.test(relative)

const isWriteTarget = (relative: string) =>
  /\.(md|txt|json|ya?ml|csv|png|jpe?g|svg|tsx?|jsx?|css|scss|prisma|sql|sh|py)$/i.test(
    relative
  )

export type TaskPrecheckInput = {
  title: string
  brief?: string | null
  acceptance?: string | null
  readOnly?: boolean
  agentSlug?: string | null
}

export type TaskPrecheck = {
  /** 需要人工注意的问题；空数组表示可以放心派发 */
  warnings: string[]
  /** 验收标准里明确提到、跑完应当存在的交付物 */
  expectedPaths: string[]
}

/**
 * 派发前预检：只做确定性判断，不调用模型。
 * 目的是把"跑完才发现没法验收"的情况提前到派发前。
 */
export const precheckTask = (
  task: TaskPrecheckInput,
  repoRoot: string
): TaskPrecheck => {
  const warnings: string[] = []
  const acceptance = (task.acceptance || '').trim()
  const expectedPaths = extractDeliverablePaths([task.brief || '', acceptance])

  if (!acceptance) {
    warnings.push('验收标准为空：执行结束后没有可核对的依据。')
  }

  if (!task.agentSlug) {
    warnings.push('没有指定执行岗位。')
  }

  const writeTargets = expectedPaths.filter(isWriteTarget)
  const codeTargets = writeTargets.filter(isCodePath)
  if (task.readOnly && codeTargets.length > 0) {
    warnings.push(
      `任务是只读的，但验收标准要求改到代码目录（${codeTargets.join('、')}），二者冲突。`
    )
  }

  for (const relative of writeTargets) {
    const parent = path.dirname(path.join(repoRoot, relative))
    if (!existsSync(parent)) {
      warnings.push(
        `交付物目录不存在：${path.dirname(relative)}，执行时需要先创建。`
      )
    } else if (existsSync(path.join(repoRoot, relative))) {
      const stats = statSync(path.join(repoRoot, relative))
      if (stats.size > 0) {
        warnings.push(`交付物已存在且非空：${relative}，会被覆盖。`)
      }
    }
  }

  return { warnings, expectedPaths }
}

/** 跑完之后核对：验收标准里点名的交付物是否真的存在 */
export const missingDeliverables = (
  task: TaskPrecheckInput,
  repoRoot: string
): string[] =>
  extractDeliverablePaths([task.brief || '', task.acceptance || '']).filter(
    (relative) => {
      if (!isWriteTarget(relative)) return false
      if (relative.includes('*')) return false
      return !existsSync(path.join(repoRoot, relative))
    }
  )
