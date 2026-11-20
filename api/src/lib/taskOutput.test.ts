import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { parseTaskRunOutput } from './taskOutput'

let workspace: string

beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'task-output-'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

const writeLog = (lines: string[]) => {
  const file = path.join(workspace, 'run.log')
  writeFileSync(file, lines.join('\n'))
  return file
}

describe('parseTaskRunOutput', () => {
  it('reads codex final message and artifact lines', () => {
    const file = writeLog([
      '{"type":"thread.started","thread_id":"abc"}',
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: '已完成登录页重构。\nartifact: docs/design/login.md\nartifact: https://example.com/preview',
            },
          ],
        },
      }),
    ])

    const output = parseTaskRunOutput({ logPath: file, tool: 'codex' })
    expect(output.summary).toContain('已完成登录页重构')
    expect(output.artifacts).toEqual([
      {
        path: 'docs/design/login.md',
        label: 'login.md',
        kind: 'report',
        source: 'item',
      },
      {
        path: 'https://example.com/preview',
        label: 'example.com/preview',
        kind: 'url',
        source: 'item',
      },
    ])
  })

  it('reads dsh final event and dedupes artifacts', () => {
    const file = writeLog([
      '{"type":"session","sessionId":"session-1"}',
      JSON.stringify({
        type: 'final',
        text: '产物如下\nartifact: docs/a.md\nartifact: docs/a.md',
      }),
    ])

    const output = parseTaskRunOutput({
      logPath: file,
      tool: 'deepseek-harness',
    })
    expect(output.summary).toContain('产物如下')
    expect(output.artifacts).toHaveLength(1)
    expect(output.artifacts[0].path).toBe('docs/a.md')
  })

  it('returns empty output when the log is missing', () => {
    const output = parseTaskRunOutput({
      logPath: path.join(workspace, 'nope.log'),
      tool: 'codex',
    })
    expect(output).toEqual({ summary: '', artifacts: [] })
  })

  it('preserves full codex exec final messages separately from the summary', () => {
    const content = '# 实施方案\n' + '方案正文'.repeat(300)
    const logPath = writeLog([
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: content },
      }),
    ])
    const output = parseTaskRunOutput({ logPath, tool: 'codex' })
    expect(output.finalText).toBe(content)
    expect(output.summary.length).toBeLessThanOrEqual(500)
  })
})

describe('failure detection', () => {
  it('ignores a nonfatal CLI startup diagnostic once the turn finishes successfully', () => {
    const file = writeLog([
      '2026-11-19 ERROR codex_core::skills: failed to load an unrelated skill',
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: '# 方案正文' },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ])
    expect(parseTaskRunOutput({ logPath: file, tool: 'codex' })).toMatchObject({
      completed: true,
      error: undefined,
    })
  })
  it('detects dsh error status', () => {
    const file = writeLog([
      JSON.stringify({
        type: 'status',
        phase: 'turn_end',
        reason: {
          kind: 'error',
          error: { message: 'MISSING_CREDENTIAL: no api key' },
        },
      }),
      JSON.stringify({ type: 'final', text: '执行已结束' }),
    ])

    const output = parseTaskRunOutput({
      logPath: file,
      tool: 'deepseek-harness',
    })
    expect(output.error).toContain('MISSING_CREDENTIAL')
  })

  it('detects codex error events', () => {
    const file = writeLog([
      JSON.stringify({ type: 'turn.failed', message: 'rate limited' }),
    ])
    const output = parseTaskRunOutput({ logPath: file, tool: 'codex' })
    expect(output.error).toContain('rate limited')
  })

  it('ignores error wording echoed inside prompts or model output', () => {
    const lines = [
      JSON.stringify({
        type: 'item.started',
        item: {
          type: 'user_message',
          text: '上一轮失败原因：dsh: MISSING_CREDENTIAL: no API key',
        },
      }),
      JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: '已按规则重新评估。' },
      }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10 } }),
    ]
    const file = writeLog(lines)

    expect(parseTaskRunOutput({ logPath: file, tool: 'codex' })?.error).toBe(
      undefined
    )
  })

  it('reports no error for a normal run', () => {
    const file = writeLog([
      '{"type":"turn.completed","thread_id":"x"}',
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'ok' }],
        },
      }),
    ])

    expect(
      parseTaskRunOutput({ logPath: file, tool: 'codex' }).error
    ).toBeUndefined()
  })
})

describe('token usage', () => {
  it('reads the last turn.completed usage', () => {
    const file = writeLog([
      JSON.stringify({
        type: 'turn.completed',
        usage: {
          input_tokens: 100,
          cached_input_tokens: 40,
          output_tokens: 20,
        },
      }),
      JSON.stringify({
        type: 'turn.completed',
        usage: {
          input_tokens: 200,
          cached_input_tokens: 80,
          output_tokens: 30,
        },
      }),
    ])

    const output = parseTaskRunOutput({ logPath: file, tool: 'codex' })
    expect(output.usage).toEqual({
      inputTokens: 200,
      outputTokens: 30,
      cachedTokens: 80,
    })
  })

  it('returns no usage when the log has none', () => {
    const file = writeLog(['{"type":"thread.started","thread_id":"x"}'])
    expect(
      parseTaskRunOutput({ logPath: file, tool: 'codex' }).usage
    ).toBeUndefined()
  })
})
