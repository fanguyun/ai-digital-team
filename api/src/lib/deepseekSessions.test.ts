import { summarizeDeepSeekLines } from './deepseekSessions'

const sessionLine = {
  type: 'session',
  version: 4,
  id: '11111111-1111-1111-1111-111111111111',
  createdAt: Date.parse('2026-10-15T01:00:00.000Z'),
  cwd: '/Users/fan/game-mini-app',
  agentPreset: 'main-agent',
}

const turn = (number, time) => ({
  type: 'turn/start',
  time: Date.parse(time),
  data: { turn: number },
})

const user = (text, time) => ({
  type: 'user/message',
  time: Date.parse(time),
  data: { content: [{ type: 'text', text }], role: 'user' },
})

const assistantLine = {
  type: 'assistant/message',
  time: Date.parse('2026-10-15T01:03:00.000Z'),
  data: {
    message: { source: { model: 'deepseek-v4-flash' } },
    usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 6 },
  },
}

const skillLine = {
  type: 'tool/call',
  time: Date.parse('2026-10-15T01:01:30.000Z'),
  data: {
    name: 'skill',
    turn: 1,
    arguments: JSON.stringify({ name: 'main-agent' }),
  },
}

const teamSlugs = new Set(['main-agent'])

describe('DeepSeek task summary', () => {
  it('records each turn instead of the whole session', () => {
    const tasks = summarizeDeepSeekLines(
      [
        { ...sessionLine, cwd: '/Users/fan/ai-digital-team' },
        turn(1, '2026-10-15T01:01:00.000Z'),
        user('这是不该入库的长对话'.repeat(40), '2026-10-15T01:01:01.000Z'),
        user('整理登录页', '2026-10-15T01:01:02.000Z'),
        skillLine,
        assistantLine,
        turn(2, '2026-10-15T01:10:00.000Z'),
        user('改按钮文案', '2026-10-15T01:10:05.000Z'),
      ].map((line) => JSON.stringify(line)),
      sessionLine.id,
      Date.parse('2026-10-15T02:00:00.000Z'),
      teamSlugs
    )

    expect(tasks.map((task) => task.title)).toEqual([
      '整理登录页',
      '改按钮文案',
    ])
    expect(tasks[0]).toMatchObject({
      sessionId: `${sessionLine.id}:1`,
      primaryAgent: 'main-agent',
      inputTokens: 16,
      outputTokens: 4,
    })
    expect(JSON.stringify(tasks)).not.toContain('不该入库')
  })

  it('marks only the latest turn as running', () => {
    const tasks = summarizeDeepSeekLines(
      [
        sessionLine,
        turn(1, '2026-10-15T01:01:00.000Z'),
        user('第一项', '2026-10-15T01:01:00.000Z'),
        skillLine,
        turn(2, '2026-10-15T01:19:00.000Z'),
        user('第二项', '2026-10-15T01:19:00.000Z'),
        { ...skillLine, time: Date.parse('2026-10-15T01:19:10.000Z') },
      ].map((line) => JSON.stringify(line)),
      sessionLine.id,
      Date.parse('2026-10-15T01:20:00.000Z'),
      teamSlugs
    )

    expect(tasks.map((task) => task.status)).toEqual(['COMPLETED', 'RUNNING'])
  })

  it('ignores turns that never call a digital-team skill outside the team project', () => {
    const tasks = summarizeDeepSeekLines(
      [
        { ...sessionLine, agentPreset: undefined },
        turn(1, '2026-10-15T01:01:00.000Z'),
        user('普通改动', '2026-10-15T01:01:00.000Z'),
      ].map((line) => JSON.stringify(line)),
      sessionLine.id,
      Date.parse('2026-10-15T02:00:00.000Z'),
      teamSlugs
    )

    expect(tasks).toEqual([])
  })

  it('records turns when a digital-team agent is selected as the session preset', () => {
    const tasks = summarizeDeepSeekLines(
      [
        sessionLine,
        turn(1, '2026-10-15T01:01:00.000Z'),
        user('单独调用团队 Agent', '2026-10-15T01:01:01.000Z'),
      ].map((line) => JSON.stringify(line)),
      sessionLine.id,
      Date.parse('2026-10-15T02:00:00.000Z'),
      teamSlugs
    )

    expect(tasks).toHaveLength(1)
    expect(tasks[0].primaryAgent).toBe('main-agent')
  })

  it('extracts a real request from a structured user message', () => {
    const tasks = summarizeDeepSeekLines(
      [
        { ...sessionLine, cwd: '/Users/fan/ai-digital-team' },
        turn(1, '2026-10-15T01:01:00.000Z'),
        user(
          '# AGENTS.md instructions\n规则内容\n\nMy request:\n修复运行记录标题',
          '2026-10-15T01:01:01.000Z'
        ),
      ].map((line) => JSON.stringify(line)),
      sessionLine.id,
      Date.parse('2026-10-15T02:00:00.000Z'),
      teamSlugs
    )

    expect(tasks.map((task) => task.title)).toEqual(['修复运行记录标题'])
  })
})
