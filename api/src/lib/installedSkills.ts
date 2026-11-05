import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
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
  /** 是否已部署到 Codex（~/.codex/skills 下存在同名条目） */
  codexEnabled: boolean
  /** 是否已部署到 DeepSeek Harness（~/.dsh/skills 下存在同名条目） */
  dshEnabled: boolean
}

export type SkillScanConfig = {
  libraryRoot: string
  codexRoot: string
  dshRoot: string
}

/** 技能库来源的统一标记 */
export const LIBRARY_SOURCE = '技能库'

/** 技能库里不是技能的历史/元数据目录 */
const IGNORED_ENTRIES = new Set(['.git', '.skills-manager', 'node_modules'])

export const defaultSkillScanConfig = (
  homeDir = os.homedir()
): SkillScanConfig => ({
  libraryRoot:
    process.env.SKILLS_MANAGER_SKILLS_DIR ||
    path.join(homeDir, '.skills-manager', 'skills'),
  codexRoot:
    process.env.CODEX_SKILLS_DIR || path.join(homeDir, '.codex', 'skills'),
  dshRoot: process.env.DSH_SKILLS_DIR || path.join(homeDir, '.dsh', 'skills'),
})

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
    return {
      name: '',
      description: '',
      tags: [] as string[],
      body: markdown.trim(),
    }
  }
  const frontmatter = match[1]
  return {
    name: readScalar(frontmatter, 'name'),
    description: readScalar(frontmatter, 'description'),
    tags: readTags(frontmatter),
    body: markdown.slice(match[0].length).trim(),
  }
}

const exists = (target: string) => {
  try {
    // 断链会返回 false，等价于「未启用」，不会抛错
    return fs.existsSync(target)
  } catch {
    return false
  }
}

const readDirectory = (dir: string): fs.Dirent[] => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/**
 * 只扫描技能库（skills-manager 的 central 目录），
 * 并探测每个技能在 Codex / DSH 的 skills 目录里是否有部署条目。
 */
export const collectInstalledSkills = (
  config: SkillScanConfig = defaultSkillScanConfig()
): InstalledSkill[] => {
  if (!exists(config.libraryRoot)) return []

  const skills: InstalledSkill[] = []

  for (const entry of readDirectory(config.libraryRoot)) {
    if (IGNORED_ENTRIES.has(entry.name)) continue
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

    const directory = path.join(config.libraryRoot, entry.name)
    const skillFile = path.join(directory, 'SKILL.md')
    if (!exists(skillFile)) continue

    let markdown = ''
    let updatedAt = new Date(0)
    try {
      markdown = fs.readFileSync(skillFile, 'utf8')
      updatedAt = fs.statSync(skillFile).mtime
    } catch {
      continue
    }

    const parsed = parseSkillDocument(markdown)

    skills.push({
      id: `${LIBRARY_SOURCE}:${entry.name}`,
      name: parsed.name || entry.name,
      description: parsed.description || '这个技能没有填写简介。',
      source: LIBRARY_SOURCE,
      tags: parsed.tags.length ? parsed.tags : ['未标记'],
      path: directory,
      updatedAt,
      updatable: exists(path.join(directory, '.git')),
      body: parsed.body.slice(0, 12000),
      codexEnabled: exists(path.join(config.codexRoot, entry.name)),
      dshEnabled: exists(path.join(config.dshRoot, entry.name)),
    })
  }

  return skills.sort((left, right) =>
    left.name.localeCompare(right.name, 'zh-CN')
  )
}

export const updateSkillDirectory = async (skill: InstalledSkill) => {
  if (!skill.updatable) {
    throw new UserInputError(
      '技能库里的技能不支持单独更新，请用 skills-manager 更新技能库。'
    )
  }
  try {
    const result = await execFileAsync(
      'git',
      ['-C', skill.path, 'pull', '--ff-only'],
      {
        timeout: 30000,
      }
    )
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
    return output || '技能已更新。'
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    throw new UserInputError(message)
  }
}
