import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

/** 已安装 Skill 可能出现的目录（两个平台都算，顺序即优先级） */
export const skillSearchRoots = (repoRoot: string, home = homedir()) => {
  const dshHome = process.env.DSH_HOME || path.join(home, '.dsh')
  const agentsHome = process.env.DSH_AGENTS_HOME || path.join(home, '.agents')
  const roots = [
    path.join(repoRoot, '.agents', 'skills'),
    path.join(repoRoot, '.dsh', 'skills'),
    path.join(dshHome, 'skills'),
    path.join(home, '.codex', 'skills'),
    path.join(agentsHome, 'skills'),
    path.join(home, '.skills-manager', 'skills'),
  ]
  return [...new Set(roots)]
}

export const agentSkillDir = (repoRoot: string, agentSlug: string) =>
  path.join(repoRoot, 'agents', agentSlug, '.agents', 'skills')

const isReadableSkill = (dir: string) => existsSync(path.join(dir, 'SKILL.md'))

export type InstalledSkill = {
  /** 已安装且可用的目录 */
  dir: string
}

/** 在候选目录里找一个可用（能读到 SKILL.md）的 Skill 安装 */
export const findInstalledSkill = (
  skill: string,
  roots: string[]
): InstalledSkill | null => {
  for (const root of roots) {
    const candidate = path.join(root, skill)
    if (isReadableSkill(candidate)) return { dir: candidate }
  }
  return null
}

export type SkillBindingState =
  | { state: 'bound'; linkPath: string; target: string }
  | { state: 'missing'; linkPath: string }
  | { state: 'broken'; linkPath: string; target: string }
  | { state: 'blocked'; linkPath: string; reason: string }

/** 岗位侧这个 Skill 的绑定状态（含断链） */
export const skillBindingState = (
  repoRoot: string,
  agentSlug: string,
  skill: string
): SkillBindingState => {
  const linkPath = path.join(agentSkillDir(repoRoot, agentSlug), skill)
  if (!existsSync(linkPath) && !isSymlink(linkPath)) {
    return { state: 'missing', linkPath }
  }
  if (!isSymlink(linkPath)) {
    return isReadableSkill(linkPath)
      ? { state: 'bound', linkPath, target: linkPath }
      : {
          state: 'blocked',
          linkPath,
          reason: '该位置存在真实目录但没有 SKILL.md',
        }
  }
  const target = readTarget(linkPath)
  return isReadableSkill(target)
    ? { state: 'bound', linkPath, target }
    : { state: 'broken', linkPath, target }
}

const isSymlink = (target: string) => {
  try {
    return lstatSync(target).isSymbolicLink()
  } catch {
    return false
  }
}

const readTarget = (linkPath: string) => {
  const raw = readlinkSync(linkPath)
  return path.isAbsolute(raw) ? raw : path.resolve(path.dirname(linkPath), raw)
}

export type SkillBindingResult = {
  ok: boolean
  skill: string
  linkPath: string
  source?: string
  /** 这次是否真的改了文件系统 */
  changed: boolean
  message: string
}

/** 建立/修复岗位软链接（只做软链接，不复制文件） */
export const bindSkill = ({
  repoRoot,
  agentSlug,
  skill,
  roots,
}: {
  repoRoot: string
  agentSlug: string
  skill: string
  roots: string[]
}): SkillBindingResult => {
  const linkPath = path.join(agentSkillDir(repoRoot, agentSlug), skill)
  const installed = findInstalledSkill(skill, roots)

  if (!installed) {
    return {
      ok: false,
      skill,
      linkPath,
      changed: false,
      message: `没有找到可用的 ${skill} 安装，需要先安装 Skill。`,
    }
  }

  const current = skillBindingState(repoRoot, agentSlug, skill)
  if (current.state === 'bound') {
    return {
      ok: true,
      skill,
      linkPath,
      source: installed.dir,
      changed: false,
      message: `${skill} 已经绑定，无需修复。`,
    }
  }
  if (current.state === 'blocked') {
    return {
      ok: false,
      skill,
      linkPath,
      changed: false,
      message: current.reason,
    }
  }

  try {
    mkdirSync(path.dirname(linkPath), { recursive: true })
    if (current.state === 'broken') {
      unlinkSync(linkPath)
    }
    symlinkSync(installed.dir, linkPath, 'dir')
    return {
      ok: true,
      skill,
      linkPath,
      source: installed.dir,
      changed: true,
      message: `已建立软链接：${skill} → ${installed.dir}`,
    }
  } catch (error) {
    return {
      ok: false,
      skill,
      linkPath,
      changed: false,
      message: `建立软链接失败：${(error as Error).message}`,
    }
  }
}

export type FixStep = { title: string; detail?: string }

export type AgentFixItem = {
  kind: 'skill-binding' | 'skill-missing' | 'tool-missing'
  name: string
  severity: 'required' | 'optional'
  title: string
  steps: FixStep[]
  canApply: boolean
  blockedReason?: string
  source?: string
  linkPath?: string
}

/**
 * 给一个岗位生成修复方案：能自动做的（建软链接）标 canApply，
 * 需要人先装东西的只给步骤。
 */
export const planAgentFixes = ({
  repoRoot,
  agentSlug,
  requiredSkills,
  optionalSkills,
  requiredTools,
  roots,
  toolAvailable = () => true,
}: {
  repoRoot: string
  agentSlug: string
  requiredSkills: string[]
  optionalSkills: string[]
  requiredTools: string[]
  roots: string[]
  toolAvailable?: (tool: string) => boolean
}): AgentFixItem[] => {
  const items: AgentFixItem[] = []

  const skills: Array<{ name: string; severity: 'required' | 'optional' }> = [
    ...requiredSkills.map((name) => ({ name, severity: 'required' as const })),
    ...optionalSkills.map((name) => ({ name, severity: 'optional' as const })),
  ]

  for (const { name, severity } of skills) {
    const installed = findInstalledSkill(name, roots)
    const binding = skillBindingState(repoRoot, agentSlug, name)

    if (!installed) {
      items.push({
        kind: 'skill-missing',
        name,
        severity,
        title: `缺少 Skill：${name}`,
        steps: [
          {
            title: '安装 Skill 到全局目录',
            detail:
              '用插件市场或 dsh plugin 安装到 ~/.dsh/skills 或 ~/.agents/skills；项目内只保留软链接。',
          },
          {
            title: '回来点「修复」',
            detail:
              '安装完成后重新检查，这里会变成「已安装但未绑定」，可一键建立软链接。',
          },
        ],
        canApply: false,
        blockedReason: '尚未安装到任何 Skill 目录',
      })
      continue
    }

    if (binding.state === 'bound') continue

    items.push({
      kind: 'skill-binding',
      name,
      severity,
      title: `绑定 Skill：${name}`,
      steps: [
        { title: '确认安装位置', detail: installed.dir },
        binding.state === 'broken'
          ? {
              title: '替换失效的软链接',
              detail: `当前指向 ${binding.target}，该目录里没有 SKILL.md。`,
            }
          : { title: '建立岗位软链接', detail: binding.linkPath },
        {
          title: '校验绑定',
          detail: `${binding.linkPath} → ${installed.dir}（读到 SKILL.md 即生效）`,
        },
      ],
      canApply: binding.state !== 'blocked',
      blockedReason: binding.state === 'blocked' ? binding.reason : undefined,
      source: installed.dir,
      linkPath: binding.linkPath,
    })
  }

  for (const tool of requiredTools) {
    if (toolAvailable(tool)) continue
    items.push({
      kind: 'tool-missing',
      name: tool,
      severity: 'required',
      title: `缺少 CLI：${tool}`,
      steps: [
        {
          title: '安装命令行工具',
          detail: `把 ${tool} 装到 PATH 上（brew / npm / 官方安装脚本）`,
        },
        { title: '回来点「重新检查」', detail: '装好后这里会自动变成可用。' },
      ],
      canApply: false,
      blockedReason: '需要先安装命令行工具',
    })
  }

  return items
}
