import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export type RoleEvaluationToolId = 'codex' | 'deepseek-harness'

export type TeamAgent = {
  id: string
  slug: string
  name: string
  en: string
  group: string
  role: string
  skills: string[]
}

export type RoleEvaluationToolStatus = {
  id: RoleEvaluationToolId
  name: string
  available: boolean
  version?: string
  reason?: string
}

export type BinaryProbe = { bin: string; version?: string } | { reason: string }

export const ROLE_EVAL_TOOLS: ReadonlyArray<{
  id: RoleEvaluationToolId
  name: string
}> = [
  { id: 'codex', name: 'Codex' },
  { id: 'deepseek-harness', name: 'DeepSeek Harness' },
]

export const isRoleEvaluationTool = (
  value: unknown
): value is RoleEvaluationToolId =>
  ROLE_EVAL_TOOLS.some((tool) => tool.id === value)

const toolName = (tool: RoleEvaluationToolId) =>
  ROLE_EVAL_TOOLS.find((candidate) => candidate.id === tool)?.name || tool

const pad2 = (value: number) => String(value).padStart(2, '0')

/** 与报告/日志命名一致的时间戳：本地时区，精确到分钟。 */
export const timestampFor = (at: Date = new Date()) =>
  `${at.getFullYear()}${pad2(at.getMonth() + 1)}${pad2(at.getDate())}-${pad2(
    at.getHours()
  )}${pad2(at.getMinutes())}`

const minuteText = (at: Date) =>
  `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(
    at.getDate()
  )} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`

/**
 * 仓库根目录：以 agents/manifest.json 为锚点，向上找三层。
 * 开发态 cwd 可能是仓库根或其上一级（与 capabilities.ts 的假设保持一致）。
 */
export const resolveRepoRoot = (start: string = process.cwd()) => {
  const candidates = [
    path.resolve(start),
    path.resolve(start, '..'),
    path.resolve(start, '..', '..'),
  ]
  const found = candidates.find((candidate) =>
    existsSync(path.join(candidate, 'agents', 'manifest.json'))
  )
  if (!found) {
    throw new Error(
      '无法定位个人数字团队仓库根目录（未找到 agents/manifest.json）'
    )
  }
  return found
}

type Manifest = {
  agents?: Array<{
    id?: string
    slug?: string
    name?: string
    en?: string
    group?: string
    role?: string
    skills?: string[]
  }>
}

export const readTeamAgents = (repoRoot: string): TeamAgent[] => {
  const manifestPath = path.join(repoRoot, 'agents', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  return (manifest.agents || [])
    .filter((agent) => typeof agent.slug === 'string' && agent.slug.trim())
    .map((agent) => ({
      id: String(agent.id || agent.slug),
      slug: String(agent.slug),
      name: String(agent.name || agent.slug),
      en: String(agent.en || ''),
      group: String(agent.group || ''),
      role: String(agent.role || ''),
      skills: Array.isArray(agent.skills)
        ? agent.skills.filter((skill) => typeof skill === 'string')
        : [],
    }))
}

export const readTeamAgent = (slug: string, repoRoot: string) => {
  const agent = readTeamAgents(repoRoot).find(
    (candidate) => candidate.slug === slug
  )
  return agent
}

export const agentRulePath = (slug: string) =>
  path.posix.join('agents', slug, 'AGENTS.md')

export const reportPathFor = (slug: string, at: Date = new Date()) =>
  `docs/role-evaluations/${slug}-${timestampFor(at)}.md`

export const logPathsFor = (slug: string, at: Date = new Date()) => {
  const stem = `docs/role-evaluations/logs/${slug}-${timestampFor(at)}`
  return {
    log: `${stem}.log`,
    result: `${stem}.result.txt`,
    sidecar: `${stem}.json`,
  }
}

/**
 * 首行用 `My request:` 是为了命中会话同步的标题解析；
 * 末行用团队「本次使用」格式是为了命中岗位归属解析。
 */
export const buildEvaluationPrompt = ({
  agent,
  repoRoot,
  reportPath,
  startedAt = new Date(),
}: {
  agent: TeamAgent
  repoRoot: string
  reportPath: string
  startedAt?: Date
}) => {
  const skills = agent.skills.length ? agent.skills.join('、') : '无'
  return [
    `My request: 岗位评估更新：${agent.name}`,
    '你是个人数字团队的「岗位发展与能力评估」（Role Development Agent）。',
    '',
    `评估对象：${agent.name}（${agent.en}）`,
    `岗位 slug：${agent.slug}`,
    `所属分组：${agent.group}`,
    `岗位规则：${agentRulePath(agent.slug)}`,
    `当前关联 Skill：${skills}`,
    `工作目录：${repoRoot}`,
    `开始时间：${minuteText(startedAt)}`,
    '',
    '请按 agents/role-development-agent/AGENTS.md 执行本次评估：',
    `1. 先读 ${agentRulePath(
      agent.slug
    )}、agents/manifest.json、agents/ROUTING_MATRIX.md、agents/DELIVERY_PROTOCOL.md，以及该岗位关联 Skill 的 SKILL.md；若 $role-development-agent skill 可用就先调用它，不可用则按上述规则直接执行。`,
    '2. 再检索外部资料：优先官方文档、官方更新日志与标准规范；每条注明标题、URL、发布日期和关联说明；资料不足一律标记「待验证」，不要把推断写成事实。',
    '3. 按该岗位规则要求输出九部分报告：当前状态、Skill 清单、外部资料、能力差距、升级建议（P0/P1/P2）、实施方案、验证方案、风险回滚、待确认事项。',
    '4. 本次只读评估：不得修改 agents/、web/、api/、scripts/ 及任何配置；不安装或同步 Skill；不执行 git 提交、推送与对外发布。',
    `5. 唯一允许写入的是 ${reportPath}（新建文件）。若同名文件已存在，改用带 -2、-3 后缀的新文件，不要覆盖。`,
    '6. 报告末尾附「建议变更清单」，逐条给出影响文件、优先级与人工确认要点；不要直接应用变更。',
    '7. 最终回复以团队格式收尾：本次使用：岗位发展与能力评估（Role Development Agent）；Skill：<实际使用或未使用 Skill>；原因：<一句话>，并附报告路径。总结控制在 3 行内。',
  ].join('\n')
}

export type DispatchCommand = {
  command: string
  args: string[]
}

const dshProfile = (explicit?: string) =>
  (explicit ?? process.env.ROLE_EVAL_DSH_PROFILE ?? 'headless').trim() ||
  'headless'

/** 固定 argv：不接受用户拼接参数，shell 一律为 false。 */
export const buildDispatchCommand = ({
  tool,
  bin,
  repoRoot,
  prompt,
  resultPath,
  profile,
}: {
  tool: RoleEvaluationToolId
  bin: string
  repoRoot: string
  prompt: string
  resultPath: string
  profile?: string
}): DispatchCommand => {
  if (tool === 'codex') {
    return {
      command: bin,
      args: [
        'exec',
        '-C',
        repoRoot,
        '--skip-git-repo-check',
        '-s',
        'workspace-write',
        '--color',
        'never',
        '-o',
        resultPath,
        prompt,
      ],
    }
  }
  return {
    command: bin,
    args: ['--profile', dshProfile(profile), '--json', prompt],
  }
}

const fnmVersions = (home: string): string[] => {
  try {
    return readdirSync(path.join(home, '.local', 'share', 'fnm', 'node-versions'))
      .filter((entry) => /^v?\d/.test(entry))
      .sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true })
      )
  } catch {
    return []
  }
}

export const binaryCandidates = (
  tool: RoleEvaluationToolId,
  {
    env = process.env,
    home = homedir(),
    versions = fnmVersions(home),
  }: { env?: NodeJS.ProcessEnv; home?: string; versions?: string[] } = {}
) => {
  const name = tool === 'codex' ? 'codex' : 'dsh'
  const override = tool === 'codex' ? env.ROLE_EVAL_CODEX_BIN : env.ROLE_EVAL_DSH_BIN
  const candidates: string[] = []
  if (override && override.trim()) candidates.push(override.trim())
  candidates.push(name)
  for (const version of versions) {
    candidates.push(
      path.join(home, '.local', 'share', 'fnm', 'node-versions', version, 'installation', 'bin', name)
    )
  }
  candidates.push(
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    path.join(home, '.local', 'bin', name)
  )
  return candidates
}

const missingReason = (tool: RoleEvaluationToolId) => {
  const name = tool === 'codex' ? 'codex' : 'dsh'
  const install =
    tool === 'codex'
      ? 'npm install -g @openai/codex'
      : 'npm install -g @deepseek-ai/dsh'
  const override = tool === 'codex' ? 'ROLE_EVAL_CODEX_BIN' : 'ROLE_EVAL_DSH_BIN'
  return `未找到可用的 ${name}（${toolName(tool)}）。请先安装（${install}），或用环境变量 ${override} 指向可执行文件。`
}

const firstLine = (value: string) => value.split(/\r?\n/).find(Boolean)?.trim()

const defaultRunVersion = (bin: string): string | null => {
  try {
    const result = spawnSync(bin, ['--version'], {
      encoding: 'utf8',
      timeout: 4000,
    })
    if (result.status !== 0) return null
    const text = `${result.stdout || ''}${result.stderr || ''}`.trim()
    return text || null
  } catch {
    return null
  }
}

export type VersionRunner = (bin: string) => string | null

export const probeBinary = (
  tool: RoleEvaluationToolId,
  {
    env = process.env,
    home = homedir(),
    versions,
    runVersion = defaultRunVersion,
  }: {
    env?: NodeJS.ProcessEnv
    home?: string
    versions?: string[]
    runVersion?: VersionRunner
  } = {}
): BinaryProbe => {
  for (const candidate of binaryCandidates(tool, { env, home, versions })) {
    const output = runVersion(candidate)
    if (output) return { bin: candidate, version: firstLine(output) }
  }
  return { reason: missingReason(tool) }
}

export const dispatchIdFor = (slug: string, at: Date = new Date()) =>
  `${slug}-${timestampFor(at)}`
