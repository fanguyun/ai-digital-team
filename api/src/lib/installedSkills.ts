import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { UserInputError } from '@cedarjs/graphql-server'

const execFileAsync = promisify(execFile)

export type InstalledSkill = {
  id: string
  name: string
  description: string
  source: string
  tags: string[]
  path: string
  updatedAt: Date
  updatable: boolean
  body: string
}

export type SkillRoot = {
  source: string
  dir: string
}

const SOURCE_ORDER = ['用户', '插件', '系统']

export const installedSkillRoots = (codexHome: string): SkillRoot[] => [
  { source: '用户', dir: path.join(codexHome, 'skills') },
  { source: '插件', dir: path.join(codexHome, 'plugins', 'cache') },
  { source: '系统', dir: path.join(codexHome, 'skills', '.system') },
]

const readScalar = (frontmatter: string, key: string) => {
  const match = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(frontmatter)
  if (!match) return ''
  const value = match[1].trim()
  if (value === '>' || value === '|') {
    const lines: string[] = []
    const start = frontmatter.indexOf(match[0]) + match[0].length + 1
    for (const line of frontmatter.slice(start).split(/\r?\n/)) {
      if (!/^\s+\S/.test(line)) break
      lines.push(line.trim())
    }
    return lines.join(' ')
  }
  return value.replace(/^['"]|['"]$/g, '')
}

const readTags = (frontmatter: string) => {
  const match = /^tags:[^\S\n]*(.*)$/m.exec(frontmatter)
  if (!match) return []
  const inline = match[1].trim()
  if (inline.startsWith('[')) {
    return inline
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
  if (inline) {
    return inline
      .split(',')
      .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
  const tags: string[] = []
  const start = frontmatter.indexOf(match[0]) + match[0].length + 1
  for (const line of frontmatter.slice(start).split(/\r?\n/)) {
    const item = /^-\s+(.+)$/.exec(line.trim())
    if (!item) break
    tags.push(item[1].replace(/^['"]|['"]$/g, ''))
  }
  return tags.filter(Boolean)
}

export const parseSkillDocument = (markdown: string) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown)
  if (!match) {
    return { name: '', description: '', tags: [] as string[], body: markdown.trim() }
  }
  const frontmatter = match[1]
  return {
    name: readScalar(frontmatter, 'name'),
    description: readScalar(frontmatter, 'description'),
    tags: readTags(frontmatter),
    body: markdown.slice(match[0].length).trim(),
  }
}

const isInside = (root: string, target: string) => {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const walkSkillDirectories = (dir: string, depth: number): string[] => {
  if (depth > 8 || !fs.existsSync(dir)) return []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const found: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') {
      continue
    }
    if (dir.endsWith(`${path.sep}skills`) && entry.name === '.system') continue
    const fullPath = path.join(dir, entry.name)
    if (fs.existsSync(path.join(fullPath, 'SKILL.md'))) {
      found.push(fullPath)
      continue
    }
    found.push(...walkSkillDirectories(fullPath, depth + 1))
  }
  return found
}

export const collectInstalledSkills = (roots: SkillRoot[]): InstalledSkill[] => {
  const seen = new Set<string>()
  const skills: InstalledSkill[] = []
  const ordered = [...roots].sort(
    (left, right) => SOURCE_ORDER.indexOf(left.source) - SOURCE_ORDER.indexOf(right.source)
  )

  for (const root of ordered) {
    const rootReal = fs.existsSync(root.dir) ? fs.realpathSync(root.dir) : root.dir
    for (const directory of walkSkillDirectories(root.dir, 0)) {
      const skillFile = path.join(directory, 'SKILL.md')
      let realDirectory = directory
      try {
        realDirectory = fs.realpathSync(directory)
      } catch {
        continue
      }
      if (!isInside(rootReal, realDirectory) && root.source !== '用户') continue
      if (seen.has(realDirectory)) continue
      seen.add(realDirectory)

      let markdown = ''
      let updatedAt = new Date(0)
      try {
        markdown = fs.readFileSync(skillFile, 'utf8')
        updatedAt = fs.statSync(skillFile).mtime
      } catch {
        continue
      }
      const parsed = parseSkillDocument(markdown)
      const folderName = path.basename(realDirectory)
      const updatable =
        root.source === '用户' && fs.existsSync(path.join(realDirectory, '.git'))
      skills.push({
        id: `${root.source}:${path.relative(root.dir, directory)}`,
        name: parsed.name || folderName,
        description: parsed.description || '这个技能没有填写简介。',
        source: root.source,
        tags: parsed.tags.length ? parsed.tags : ['未标记'],
        path: realDirectory,
        updatedAt,
        updatable,
        body: parsed.body.slice(0, 12000),
      })
    }
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export const updateSkillDirectory = async (skill: InstalledSkill) => {
  if (!skill.updatable) {
    throw new UserInputError(
      skill.source === '系统'
        ? '系统技能由 Codex 维护，不能在这里更新。'
        : skill.source === '插件'
          ? '插件技能跟随插件缓存，请升级对应插件。'
          : '这个技能没有 Git 来源，不能自动更新。'
    )
  }
  try {
    const result = await execFileAsync('git', ['-C', skill.path, 'pull', '--ff-only'], {
      timeout: 30000,
    })
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
    return output || '技能已更新。'
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    throw new UserInputError(message)
  }
}
