import { summarizeCodexLines } from './codexSessions'

const teamSlugs = new Set(['main-agent'])
const sessionId = '11111111-1111-4111-8111-111111111111'

const meta = (cwd: string) =>
  JSON.stringify({
    timestamp: '2026-10-15T01:00:00.000Z',
    type: 'session_meta',
    payload: { cwd, session_id: sessionId },
  })

const task = (iso: string) =>
  JSON.stringify({
    timestamp: iso,
    type: 'event_msg',
    payload: { type: 'task_started' },
  })

const request = (text: string, iso: string) =>
  JSON.stringify({
    timestamp: iso,
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: `前文\nMy request:\n${text}` }],
    },
  })

describe('Codex task summary', () => {
  it('splits a digital team thread into individual requests', () => {
    const tasks = summarizeCodexLines(
      [
        meta('/Users/fan/ai-digital-team'),
        task('2026-10-15T01:01:00.000Z'),
        request('增加上边距', '2026-10-15T01:01:01.000Z'),
        task('2026-10-15T01:20:00.000Z'),
        request('登录按钮改名', '2026-10-15T01:20:01.000Z'),
      ],
      sessionId,
      Date.parse('2026-10-15T03:00:00.000Z'),
      '整段线程名',
      teamSlugs
    )

    expect(tasks.map((item) => item.title)).toEqual([
      '增加上边距',
      '登录按钮改名',
    ])
    expect(tasks[0].sessionId).toBe(`${sessionId}:1`)
    expect(JSON.stringify(tasks)).not.toContain('整段线程名')
  })

  it('ignores another project unless that task opens a team role', () => {
    const tasks = summarizeCodexLines(
      [
        meta('/Users/fan/game-mini-app'),
        task('2026-10-15T01:01:00.000Z'),
        request('改首页', '2026-10-15T01:01:01.000Z'),
        task('2026-10-15T01:05:00.000Z'),
        request('交给数字团队', '2026-10-15T01:05:01.000Z'),
        JSON.stringify({
          timestamp: '2026-10-15T01:05:02.000Z',
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'exec_command',
            arguments: '{"name":"main-agent"}',
          },
        }),
      ],
      sessionId,
      Date.parse('2026-10-15T03:00:00.000Z'),
      undefined,
      teamSlugs
    )

    expect(tasks.map((item) => item.title)).toEqual(['交给数字团队'])
    expect(tasks[0].primaryAgent).toBe('main-agent')
  })

  it('keeps one row when later turns repeat the same request', () => {
    const tasks = summarizeCodexLines(
      [
        meta('/Users/fan/ai-digital-team'),
        task('2026-10-15T01:01:00.000Z'),
        request('报错，当前不能安装到deepseek吗', '2026-10-15T01:01:01.000Z'),
        task('2026-10-15T01:02:00.000Z'),
        request('报错，当前不能安装到deepseek吗', '2026-10-15T01:02:01.000Z'),
        task('2026-10-15T01:03:00.000Z'),
        request('报错，当前不能安装到deepseek吗', '2026-10-15T01:03:01.000Z'),
      ],
      sessionId,
      Date.parse('2026-10-15T03:00:00.000Z'),
      undefined,
      teamSlugs
    )

    expect(tasks).toHaveLength(1)
  })

  it('does not use the agent rulebook as a task title', () => {
    const tasks = summarizeCodexLines(
      [
        meta('/Users/fan/ai-digital-team'),
        task('2026-10-15T01:01:00.000Z'),
        JSON.stringify({
          timestamp: '2026-10-15T01:01:01.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '本文件是 Codex 在当前目录中的工作准则，作用是统一行为。',
              },
            ],
          },
        }),
      ],
      sessionId,
      Date.parse('2026-10-15T03:00:00.000Z'),
      undefined,
      teamSlugs
    )

    expect(tasks).toEqual([])
  })

  it('uses the first request block instead of a later context-summary marker', () => {
    const tasks = summarizeCodexLines(
      [
        meta('/Users/fan/ai-digital-team'),
        request(
          [
            '修复标题解析',
            '',
            'Another language model started to solve this problem.',
            'My request:',
            '` 后的内容；同一会话里相同标题只留一条。规则文档开头也丢弃。',
          ].join('\n'),
          '2026-10-15T01:01:01.000Z'
        ),
      ],
      sessionId,
      Date.parse('2026-10-15T03:00:00.000Z'),
      undefined,
      teamSlugs
    )

    expect(tasks.map((item) => item.title)).toEqual(['修复标题解析'])
  })

  it('normalizes punctuation before deduplicating titles in one session', () => {
    const tasks = summarizeCodexLines(
      [
        meta('/Users/fan/ai-digital-team'),
        request('处理重复记录', '2026-10-15T01:01:01.000Z'),
        request('处理重复记录。', '2026-10-15T01:02:01.000Z'),
      ],
      sessionId,
      Date.parse('2026-10-15T03:00:00.000Z'),
      undefined,
      teamSlugs
    )

    expect(tasks).toHaveLength(1)
  })
})
