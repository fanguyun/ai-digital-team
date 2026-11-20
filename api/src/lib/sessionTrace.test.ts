import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { zstdCompressSync } from 'node:zlib'

import {
  describeToolCall,
  isInjectedUserMessage,
  parseDshTrace,
  parseSessionReference,
  stripSystemReminders,
} from './sessionTrace'
import { readZstdLines } from './zstdLines'

const record = (value: Record<string, unknown>) => `${JSON.stringify(value)}\n`

const userMessage = (text: string, turn = 1, time = 1) =>
  record({
    type: 'user/message',
    time,
    data: { turn, content: [{ type: 'text', text }] },
  })

const assistantMessage = (
  blocks: Array<{ type: string; text: string }>,
  turn = 1,
  time = 2
) =>
  record({
    type: 'assistant/message',
    time,
    data: { turn, step: 1, message: { role: 'assistant', content: blocks } },
  })

describe('session reference parsing', () => {
  it('parses team task runs', () => {
    expect(parseSessionReference('task:run-1:session-abc')).toEqual({
      sessionId: 'session-abc',
      turn: undefined,
    })
  })

  it('parses synced harness runs with a turn suffix', () => {
    expect(
      parseSessionReference('dsh-task:c32bf4fe-152d-4877-be44-662415559e9f:2')
    ).toEqual({
      sessionId: 'c32bf4fe-152d-4877-be44-662415559e9f',
      turn: 2,
      platform: 'dsh',
    })
  })

  it('parses synced codex runs', () => {
    expect(parseSessionReference('codex-task:abc:task-key-1')).toEqual({
      sessionId: 'abc',
      turn: undefined,
      platform: 'codex',
    })
  })

  it('returns an empty session id for unknown references', () => {
    expect(parseSessionReference('task:only-run-id').sessionId).toBe('')
    expect(parseSessionReference(null).sessionId).toBe('')
    expect(parseSessionReference('something:else').sessionId).toBe('')
  })
})

describe('injected user message detection', () => {
  it('skips the AGENTS.md block Codex injects as the first user message', () => {
    expect(
      isInjectedUserMessage(
        'user',
        '# AGENTS.md instructions for /Users/fan/ai-digital-team\n<INSTRUCTIONS>'
      )
    ).toBe(true)
    expect(isInjectedUserMessage('user', '真实需求')).toBe(false)
    expect(isInjectedUserMessage('assistant', '# AGENTS.md instructions')).toBe(
      false
    )
  })
})

describe('system reminder stripping', () => {
  it('removes injected reminder blocks and keeps the real request', () => {
    const raw =
      '看一下运行记录\n<system-reminder>\nThe following instructions are relevant\n</system-reminder>'
    expect(stripSystemReminders(raw)).toBe('看一下运行记录')
  })
})

describe('dsh trace parsing', () => {
  it('keeps user text, drops reasoning blocks and slices by turn', () => {
    const lines = [
      userMessage('第一轮需求', 1, 10),
      assistantMessage([{ type: 'reasoning', text: '内心活动' }], 1, 11),
      assistantMessage([{ type: 'text', text: '第一轮结论' }], 1, 12),
      userMessage('第二轮需求', 2, 20),
      assistantMessage([{ type: 'text', text: '第二轮结论' }], 2, 21),
    ]

    const trace = parseDshTrace(lines, 2)
    expect(trace.messages.map((message) => message.content)).toEqual([
      '第二轮需求',
      '第二轮结论',
    ])
    expect(trace).toMatchObject({ turn: 2, source: 'dsh', truncated: false })
  })

  it('skips runtime meta messages recorded as user turns', () => {
    const lines = [
      userMessage('真实需求', 1, 1),
      userMessage(
        'Time sampled while preparing turn 1, step 1: 2026-11-18',
        1,
        2
      ),
    ]
    expect(parseDshTrace(lines, 1).messages.map((m) => m.content)).toEqual([
      '真实需求',
    ])
  })

  it('pairs tool calls with their results and redacts sensitive ones', () => {
    const lines = [
      record({
        type: 'tool/call',
        time: 30,
        data: {
          turn: 1,
          callId: 'call-1',
          name: 'bash',
          arguments: JSON.stringify({ command: 'ls -la\necho extra' }),
        },
      }),
      record({
        type: 'tool/result',
        time: 31,
        data: {
          turn: 1,
          callId: 'call-1',
          message: { content: [{ type: 'text', text: 'file-a\nfile-b' }] },
        },
      }),
      record({
        type: 'tool/call',
        time: 32,
        data: {
          turn: 1,
          callId: 'call-2',
          name: 'read',
          arguments: JSON.stringify({ path: '.env' }),
        },
      }),
    ]

    const trace = parseDshTrace(lines, 1)
    expect(trace.tools).toHaveLength(2)
    expect(trace.tools[0]).toMatchObject({
      name: 'bash',
      detail: 'ls -la',
      result: 'file-a',
      redacted: false,
    })
    expect(trace.tools[0].resultTruncated).toBe(false)
    expect(trace.tools[1]).toMatchObject({
      name: 'read',
      detail: '已隐藏内容',
      redacted: true,
    })

    // 结果里出现 .env 文件名属于正常输出，不隐藏整段结果
    const listing = parseDshTrace([
      record({
        type: 'tool/call',
        time: 40,
        data: {
          turn: 1,
          callId: 'call-3',
          name: 'bash',
          arguments: JSON.stringify({ command: 'ls -la' }),
        },
      }),
      record({
        type: 'tool/result',
        time: 41,
        data: {
          turn: 1,
          callId: 'call-3',
          message: { content: [{ type: 'text', text: '.env\nAGENTS.md' }] },
        },
      }),
    ])
    expect(listing.tools[0]).toMatchObject({
      result: '.env',
      redacted: false,
    })
  })

  it('flags truncation when the message budget is exceeded', () => {
    const lines = [1, 2, 3, 4, 5].map((index) =>
      userMessage(`第 ${index} 条`, 1, index)
    )
    const trace = parseDshTrace(lines, 1, { messages: 2 })
    expect(trace.messages).toHaveLength(2)
    expect(trace.truncated).toBe(true)
  })

  it('describes tool calls without dumping full arguments', () => {
    expect(
      describeToolCall(
        'bash',
        JSON.stringify({ command: 'yarn test', description: 'run' })
      )
    ).toBe('yarn test')
    expect(
      describeToolCall('read', JSON.stringify({ path: 'api/src/lib/db.ts' }))
    ).toBe('api/src/lib/db.ts')
    expect(describeToolCall('grep', 'not-json')).toBe('')
  })
})

describe('multi-frame zstd reading', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'dsh-session-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('reads every frame of an append-written session log', async () => {
    const file = path.join(dir, 'session.v4.jsonl.zstd')
    const first = `${JSON.stringify({ type: 'session' })}\n${JSON.stringify({ type: 'turn/start', data: { turn: 1 } })}\n`
    const second = `${JSON.stringify({ type: 'user/message', data: { turn: 1 } })}\n`
    writeFileSync(
      file,
      Buffer.concat([
        zstdCompressSync(Buffer.from(first, 'utf8')),
        zstdCompressSync(Buffer.from(second, 'utf8')),
      ])
    )

    const lines: string[] = []
    for await (const line of readZstdLines(file)) lines.push(line)
    expect(lines.map((line) => JSON.parse(line).type)).toEqual([
      'session',
      'turn/start',
      'user/message',
    ])
  })
})
