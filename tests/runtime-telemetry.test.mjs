import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { zstdCompress } from 'node:zlib'

import {
  mergeRuntimeMetadata,
  parseDeepSeekTelemetryLine,
  readCodexTelemetryFile,
  readDeepSeekTelemetryLines,
  readZstdLines,
  resolveCodexSessionId,
  resolveTelemetryMode,
} from '../scripts/runtime-telemetry.mjs'

const compressZstdFrame = promisify(zstdCompress)

test('Codex telemetry reads the latest model and usage after the boundary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'codex-telemetry-'))
  const path = join(directory, 'session.jsonl')
  try {
    await writeFile(
      path,
      [
        JSON.stringify({
          type: 'turn_context',
          payload: { turn_id: 'turn-1', model: 'gpt-before' },
        }),
        JSON.stringify({
          type: 'token_usage_record',
          timestamp: '2026-10-14T10:00:00.000Z',
          payload: {
            turn_id: 'turn-1',
            usage: {
              input_tokens: 100,
              output_tokens: 20,
              cached_input_tokens: 60,
            },
          },
        }),
        JSON.stringify({
          type: 'turn_context',
          payload: { turn_id: 'turn-2', model: 'gpt-after' },
        }),
        JSON.stringify({
          type: 'token_usage_record',
          timestamp: '2026-10-14T10:05:00.000Z',
          payload: {
            turn_id: 'turn-2',
            usage: {
              input_tokens: 300,
              output_tokens: 40,
              cached_input_tokens: 200,
            },
          },
        }),
      ].join('\n'),
      'utf8'
    )

    assert.deepEqual(
      await readCodexTelemetryFile(path, {
        since: '2026-10-14T10:01:00.000Z',
      }),
      {
        modelId: 'gpt-after',
        inputTokens: 300,
        outputTokens: 40,
        cachedTokens: 200,
      }
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('DeepSeek telemetry includes cached reads in input while tracking cache separately', async () => {
  const line = JSON.stringify({
    type: 'assistant/message',
    seq: 12,
    time: Date.parse('2026-10-14T10:05:00.000Z'),
    data: {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'not inspected by the adapter' }],
        source: {
          kind: 'model',
          provider: 'deepseek-official',
          model: 'deepseek-v4-flash',
        },
      },
      usage: {
        inputTokens: 133,
        outputTokens: 96,
        totalTokens: 3173,
        cacheReadTokens: 2944,
        reasoningTokens: 23,
      },
    },
  })

  assert.deepEqual(parseDeepSeekTelemetryLine(line), {
    timestamp: Date.parse('2026-10-14T10:05:00.000Z'),
    modelId: 'deepseek-v4-flash',
    inputTokens: 3077,
    outputTokens: 96,
    cachedTokens: 2944,
  })

  async function* lines() {
    yield line
  }
  assert.deepEqual(await readDeepSeekTelemetryLines(lines()), {
    modelId: 'deepseek-v4-flash',
    inputTokens: 3077,
    outputTokens: 96,
    cachedTokens: 2944,
  })
})

test('DeepSeek session reader handles concatenated Zstd frames without external tools', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deepseek-telemetry-'))
  const path = join(directory, 'session.v4.jsonl.zstd')
  try {
    const first = await compressZstdFrame(Buffer.from('first\nsecond\n'))
    const second = await compressZstdFrame(Buffer.from('third\nfourth'))
    await writeFile(path, Buffer.concat([first, second]))

    const lines = []
    for await (const line of readZstdLines(path)) lines.push(line)
    assert.deepEqual(lines, ['first', 'second', 'third', 'fourth'])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('configured metadata overrides automatic telemetry field by field', () => {
  assert.deepEqual(
    mergeRuntimeMetadata(
      { modelId: 'explicit-model', inputTokens: 12 },
      {
        modelId: 'automatic-model',
        inputTokens: 100,
        outputTokens: 20,
        cachedTokens: 80,
      }
    ),
    {
      modelId: 'explicit-model',
      inputTokens: 12,
      outputTokens: 20,
      cachedTokens: 80,
    }
  )
})

test('telemetry mode defaults to auto and validates overrides', () => {
  assert.equal(resolveTelemetryMode({}, {}), 'auto')
  assert.equal(
    resolveTelemetryMode({}, { TASK_RUNTIME_TELEMETRY: 'off' }),
    'off'
  )
  assert.throws(
    () => resolveTelemetryMode({ telemetry: 'invalid' }, {}),
    /--telemetry must be auto or off/
  )
})

test('Codex telemetry prefers the current thread over the broader session id', () => {
  assert.equal(
    resolveCodexSessionId({
      CODEX_SESSION_ID: 'session-id',
      CODEX_THREAD_ID: 'thread-id',
    }),
    'thread-id'
  )
})
