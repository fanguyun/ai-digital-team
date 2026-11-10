import {
  ROLE_EVAL_TOOLS,
  agentRulePath,
  binaryCandidates,
  buildDispatchCommand,
  buildEvaluationPrompt,
  dispatchIdFor,
  isRoleEvaluationTool,
  logPathsFor,
  probeBinary,
  readTeamAgent,
  reportPathFor,
  resolveRepoRoot,
  timestampFor,
} from './roleEvaluationDispatch'

const repoRoot = resolveRepoRoot(process.cwd())
const agent = readTeamAgent('main-agent', repoRoot)!
const at = new Date(2026, 10, 6, 14, 32)

describe('roleEvaluationDispatch', () => {
  it('locates the repo root and reads a role from the manifest', () => {
    expect(repoRoot.endsWith('ai-digital-team')).toBe(true)
    expect(agent).toMatchObject({
      slug: 'main-agent',
      name: '数字总经理',
      en: 'Main Agent',
      group: '管理中枢',
    })
    expect(agent.skills.length).toBeGreaterThan(0)
    expect(readTeamAgent('no-such-agent', repoRoot)).toBeUndefined()
  })

  it('builds stable report and log paths per minute', () => {
    expect(timestampFor(at)).toBe('20261106-1432')
    expect(reportPathFor('main-agent', at)).toBe(
      'docs/role-evaluations/main-agent-20261106-1432.md'
    )
    expect(logPathsFor('main-agent', at)).toEqual({
      log: 'docs/role-evaluations/logs/main-agent-20261106-1432.log',
      result: 'docs/role-evaluations/logs/main-agent-20261106-1432.result.txt',
      sidecar: 'docs/role-evaluations/logs/main-agent-20261106-1432.json',
    })
    expect(dispatchIdFor('main-agent', at)).toBe('main-agent-20261106-1432')
  })

  it('writes a prompt that carries the task title, scope and delivery line', () => {
    const prompt = buildEvaluationPrompt({
      agent,
      repoRoot,
      reportPath: reportPathFor(agent.slug, at),
      startedAt: at,
    })

    expect(prompt.split('\n')[0]).toBe('My request: 岗位评估更新：数字总经理')
    expect(prompt).toContain('岗位 slug：main-agent')
    expect(prompt).toContain('岗位规则：agents/main-agent/AGENTS.md')
    expect(prompt).toContain('agents/role-development-agent/AGENTS.md')
    expect(prompt).toContain('docs/role-evaluations/main-agent-20261106-1432.md')
    expect(prompt).toContain('只读评估')
    expect(prompt).toContain('不执行 git 提交')
    expect(prompt).toContain('P0/P1/P2')
    expect(prompt.trim().split('\n').pop()).toContain(
      '本次使用：岗位发展与能力评估（Role Development Agent）'
    )
  })

  it('keeps the codex argv fixed and the prompt last', () => {
    const prompt = 'hello'
    const codex = buildDispatchCommand({
      tool: 'codex',
      bin: '/opt/codex',
      repoRoot,
      prompt,
      resultPath: '/tmp/out.txt',
    })

    expect(codex.command).toBe('/opt/codex')
    expect(codex.args.slice(0, 4)).toEqual(['exec', '-C', repoRoot, '--skip-git-repo-check'])
    expect(codex.args).toContain('workspace-write')
    expect(codex.args[codex.args.length - 1]).toBe(prompt)
  })

  it('keeps the dsh argv fixed and the prompt last', () => {
    const prompt = 'hello'
    const dsh = buildDispatchCommand({
      tool: 'deepseek-harness',
      bin: '/opt/dsh',
      repoRoot,
      prompt,
      resultPath: '/tmp/out.txt',
      profile: 'headless',
    })

    expect(dsh.args).toEqual(['--profile', 'headless', '--json', prompt])
  })

  it('accepts only the allowlisted tools', () => {
    expect(ROLE_EVAL_TOOLS.map((tool) => tool.id)).toEqual([
      'codex',
      'deepseek-harness',
    ])
    expect(isRoleEvaluationTool('codex')).toBe(true)
    expect(isRoleEvaluationTool('sh')).toBe(false)
    expect(isRoleEvaluationTool(undefined)).toBe(false)
  })

  it('orders binary candidates: override, PATH, newest fnm, then system paths', () => {
    const candidates = binaryCandidates('codex', {
      env: { ROLE_EVAL_CODEX_BIN: '/custom/codex' },
      home: '/home/tester',
      versions: ['v22.1.0', 'v24.19.0'],
    })

    expect(candidates[0]).toBe('/custom/codex')
    expect(candidates[1]).toBe('codex')
    expect(candidates[2]).toBe(
      '/home/tester/.local/share/fnm/node-versions/v22.1.0/installation/bin/codex'
    )
    expect(candidates).toContain('/opt/homebrew/bin/codex')
  })

  it('probes candidates in order and reports a reason when none work', () => {
    const calls: string[] = []
    const probe = probeBinary('deepseek-harness', {
      env: {},
      home: '/home/tester',
      versions: ['v24.19.0'],
      runVersion: (bin) => {
        calls.push(bin)
        return bin === 'dsh' ? '0.2.1-rc.5\n' : null
      },
    })

    expect(probe).toEqual({ bin: 'dsh', version: '0.2.1-rc.5' })
    expect(calls[0]).toBe('dsh')
    expect(calls).toHaveLength(1)

    const missing = probeBinary('codex', {
      env: {},
      home: '/home/tester',
      versions: [],
      runVersion: () => null,
    })
    expect('reason' in missing && missing.reason).toContain('ROLE_EVAL_CODEX_BIN')
  })

  it('points the prompt at the role rule file with posix separators', () => {
    expect(agentRulePath('role-development-agent')).toBe(
      'agents/role-development-agent/AGENTS.md'
    )
  })
})
