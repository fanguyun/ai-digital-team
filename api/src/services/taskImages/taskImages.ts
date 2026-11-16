import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'

const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([a-z0-9+/=\s]+)$/i
const EXT = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', gif: 'gif' }

const pad = (value: number) => String(value).padStart(2, '0')

const dayStamp = (at: Date) =>
  `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`

/** 从 Markdown 里找出引用的图片 id（编辑器写入的 /images/<id> 形式） */
export const imageIdsFromMarkdown = (markdown: string) => {
  const ids = new Set<string>()
  const pattern =
    /!\[[^\]]*\]\(\s*\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*\)/gi
  for (const match of String(markdown || '').matchAll(pattern)) {
    ids.add(match[1])
  }
  return [...ids]
}

export const uploadTaskImage = async ({
  input,
}: {
  input: { dataUrl: string; name?: string | null }
}) => {
  const dataUrl = String(input?.dataUrl || '').trim()
  const match = ALLOWED.exec(dataUrl)
  if (!match) {
    throw new UserInputError('只支持 png / jpeg / webp / gif 图片')
  }

  const mime = `image/${match[1].toLowerCase()}`
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (!buffer.length) throw new UserInputError('图片内容为空')
  if (buffer.length > MAX_BYTES) {
    throw new UserInputError('图片不能超过 4MB')
  }

  const now = new Date()
  const ext = EXT[match[1].toLowerCase() as keyof typeof EXT] || 'png'
  const relative = path.posix.join(
    'docs/tasks/uploads',
    dayStamp(now),
    `${crypto.randomUUID()}.${ext}`
  )
  const absolute = path.join(resolveRepoRoot(), relative)

  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, buffer)

  const label = String(input?.name || '').trim() || path.basename(relative)
  const row = await db.taskImage.create({
    data: { path: relative, label, mime, bytes: buffer.length },
  })

  return { ...row, url: `/images/${row.id}` }
}

export const taskImages = ({ ids }: { ids: string[] }) =>
  ids.length
    ? db.taskImage.findMany({ where: { id: { in: ids } } })
    : Promise.resolve([])

/** 读取图片内容，返回 data URL（页面预览用，不暴露本地路径） */
export const taskImageDataUrl = async ({ id }: { id: string }) => {
  const row = await db.taskImage.findUnique({ where: { id } })
  if (!row) throw new UserInputError('图片不存在')

  const absolute = path.join(resolveRepoRoot(), row.path)
  try {
    if (statSync(absolute).size > MAX_BYTES) {
      throw new UserInputError('图片过大')
    }
    const buffer = readFileSync(absolute)
    return `data:${row.mime};base64,${buffer.toString('base64')}`
  } catch (error) {
    if (error instanceof UserInputError) throw error
    throw new UserInputError('图片文件缺失')
  }
}

/** 派发时把 Markdown 里的图片解析成绝对路径，交给 codex --image */
export const resolveTaskImages = async (markdown: string) => {
  const ids = imageIdsFromMarkdown(markdown)
  if (!ids.length) return []
  const rows = await taskImages({ ids })
  const repoRoot = resolveRepoRoot()
  return rows
    .map((row) => path.join(repoRoot, row.path))
    .filter((absolute) => {
      try {
        return statSync(absolute).isFile()
      } catch {
        return false
      }
    })
}
