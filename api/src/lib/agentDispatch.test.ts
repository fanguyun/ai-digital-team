import { buildTaskCommand, buildTaskPrompt } from './agentDispatch'

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

  it('keeps dsh argv without image flags', () => {
    const { args } = buildTaskCommand({
      tool: 'deepseek-harness',
      bin: '/opt/dsh',
      projectRoot: '/repo',
      prompt: 'do it',
      readOnly: true,
      images: ['/repo/a.png'],
    })

    expect(args).toEqual(['--profile', 'headless', '--json', 'do it'])
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

  it('keeps artifact convention line', () => {
    expect(buildTaskPrompt(base)).toContain(
      'artifact: <相对仓库根的路径或链接>'
    )
  })
})
