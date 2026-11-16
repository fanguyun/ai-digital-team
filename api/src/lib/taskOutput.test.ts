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
})

describe('failure detection', () => {
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
