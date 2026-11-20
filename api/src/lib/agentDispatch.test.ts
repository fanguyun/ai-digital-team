import {
  buildTaskCommand,
  buildTaskPrompt,
  taskAgentEnv,
} from './agentDispatch'

describe('buildTaskCommand', () => {
  it('passes each image with -i for codex', () => {
    const { args } = buildTaskCommand({
      tool: 'codex',
      bin: '/opt/codex',
      projectRoot: '/repo',
      prompt: 'do it',
      readOnly: false,
      images: ['/repo/a.png', '/repo/b.png'],
    })

    expect(args.filter((arg) => arg === '-i')).toHaveLength(2)
    expect(args).toContain('/repo/a.png')
    expect(args[args.length - 1]).toBe('do it')
  })

  it('pins dsh read-only tasks to the task-specific sandbox overlay', () => {
    const { args } = buildTaskCommand({
      tool: 'deepseek-harness',
      bin: '/opt/dsh',
      projectRoot: '/repo',
      prompt: 'do it',
      readOnly: true,
      images: ['/repo/a.png'],
    })

    expect(args).toEqual([
      '--profile',
      'headless',
      '--patch',
      '/repo/dsh/task-readonly.patch.yml',
      '--json',
      'do it',
    ])
  })

  it('keeps writable dsh tasks on their existing profile', () => {
    expect(
      buildTaskCommand({
        tool: 'deepseek-harness',
        bin: '/opt/dsh',
        projectRoot: '/repo',
        prompt: 'implement',
        readOnly: false,
      }).args
    ).toEqual(['--profile', 'headless', '--json', 'implement'])
  })
})

describe('buildTaskPrompt', () => {
  const base = {
    title: '重构登录页',
    brief: '去掉重复文案',
    acceptance: '空状态可用',
    agentSlug: 'main-agent',
    readOnly: false,
  }

  it('carries previous run context when re-dispatching', () => {
    const prompt = buildTaskPrompt({
      ...base,
      reviewNote: '缺少验证说明',
      previousSummary: '已改完登录页结构',
      previousArtifacts: ['docs/design/login.md'],
    })

    expect(prompt.split('\n')[0]).toBe('My request: 重构登录页')
    expect(prompt).toContain('上一轮的结果')
    expect(prompt).toContain('已改完登录页结构')
    expect(prompt).toContain('docs/design/login.md')
    expect(prompt).toContain('打回原因：缺少验证说明')
  })

  it('omits previous section on first dispatch', () => {
    const prompt = buildTaskPrompt(base)
    expect(prompt).not.toContain('上一轮的结果')
  })

  it('returns the full plan without asking a read-only agent to write it', () => {
    const prompt = buildTaskPrompt({ ...base, mode: 'plan' })
    expect(prompt).toContain('最终回复直接返回完整 Markdown 方案正文')
    expect(prompt).not.toContain('用 3 行以内')
    expect(prompt).not.toContain('可以修改仓库文件')
    expect(prompt).not.toContain('方案写到')
  })

  it('keeps artifact convention line', () => {
    expect(buildTaskPrompt(base)).toContain(
      'artifact: <相对仓库根的路径或链接>'
    )
  })

  it('uses the same knowledge prompt for both tools without changing approval or read-only rules', () => {
    const prompt = buildTaskPrompt({
      ...base,
      mode: 'plan',
      knowledge: '[KB-1] 外部资料',
    })
    expect(prompt).toContain('本次只读：不得修改任何仓库文件')
    expect(prompt).toContain('[KB-1] 外部资料')
    for (const tool of ['codex', 'deepseek-harness'] as const) {
      expect(
        buildTaskCommand({
          tool,
          bin: tool,
          projectRoot: '/repo',
          prompt,
          readOnly: true,
        }).args.at(-1)
      ).toBe(prompt)
    }
    expect(
      buildTaskPrompt({
        ...base,
        mode: 'execute',
        planPath: 'plan.md',
        knowledge: '[KB-1]',
      })
    ).toContain('已确认的方案在：plan.md')
  })
})

it('removes all new retrieval credentials from child process environments', () => {
  expect(
    taskAgentEnv({
      PATH: '/bin',
      SIYUAN_API_TOKEN: 'secret',
      RAG_BRIDGE_TOKEN: 'secret',
      KNOWLEDGE_BRIDGE_TOKEN: 'secret',
      KNOWLEDGE_ENABLED: '1',
    })
  ).toEqual({ PATH: '/bin' })
})
