import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const IDENTIFIER = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i
export const PLAN_MAX_BYTES = 200_000

export const saveTaskPlan = ({
  repoRoot,
  taskId,
  runId,
  content,
}: {
  repoRoot: string
  taskId: string
  runId: string
  content: string
}) => {
  if (!IDENTIFIER.test(taskId) || !IDENTIFIER.test(runId)) {
    throw new Error('方案任务标识无效')
  }
  const body = content.trim()
  if (!body) throw new Error('计划执行未返回方案正文，请重新生成方案')
  if (Buffer.byteLength(body, 'utf8') > PLAN_MAX_BYTES) {
    throw new Error('方案正文超过 200 KB，请缩小任务范围后重试')
  }

  let directory = realpathSync(repoRoot)
  for (const segment of ['docs', 'plans', taskId]) {
    directory = path.join(directory, segment)
    if (!existsSync(directory)) {
      try {
        mkdirSync(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      }
    }
    const entry = lstatSync(directory)
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error('方案目录必须是仓库内的真实目录')
    }
  }

  const relative = `docs/plans/${taskId}/${runId}.md`
  const target = path.join(directory, `${runId}.md`)
  try {
    writeFileSync(target, body, { flag: 'wx', encoding: 'utf8' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if (
      lstatSync(target).isSymbolicLink() ||
      readFileSync(target, 'utf8') !== body
    ) {
      throw new Error('该轮方案已存在且内容不同，不能覆盖')
    }
  }
  return relative
}
