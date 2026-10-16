import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createStableIdempotencyKey,
  formatEventTokenUsage,
  graphqlRequest,
  parseArguments,
  resolveRuntimeMetadata,
} from '../scripts/task-runtime.mjs'

test('parseArguments supports positional, valued and boolean options', () => {
  assert.deepEqual(
    parseArguments([
      'complete',
      'task-id',
      '--summary',
      'Delivered',
      '--json',
      '--stage=DELIVERY',
    ]),
    {
      command: 'complete',
      positionals: ['task-id'],
      options: {
        summary: 'Delivered',
        json: true,
        stage: 'DELIVERY',
      },
    }
  )
})

test('stable idempotency keys ignore object key order', () => {
  const first = createStableIdempotencyKey('event', {
    taskRunId: 'task-id',
    input: { status: 'RUNNING', stage: 'EXECUTION' },
  })
  const second = createStableIdempotencyKey('event', {
    input: { stage: 'EXECUTION', status: 'RUNNING' },
    taskRunId: 'task-id',
  })

  assert.equal(first, second)
  assert.match(first, /^task-runtime:event:[a-f0-9]{32}$/)
})

test('runtime metadata uses explicit options before environment fallbacks', () => {
  assert.deepEqual(
    resolveRuntimeMetadata(
      {
        'model-id': 'gpt-explicit',
        'input-tokens': '120',
      },
      {
        TASK_RUNTIME_MODEL_ID: 'gpt-environment',
        TASK_RUNTIME_INPUT_TOKENS: '999',
        TASK_RUNTIME_OUTPUT_TOKENS: '30',
        TASK_RUNTIME_CACHED_TOKENS: '50',
      }
    ),
    {
      modelId: 'gpt-explicit',
      inputTokens: 120,
      outputTokens: 30,
      cachedTokens: 50,
    }
  )
})

test('runtime metadata rejects invalid environment token counts', () => {
  assert.throws(
    () => resolveRuntimeMetadata({}, { TASK_RUNTIME_INPUT_TOKENS: '-1' }),
    /TASK_RUNTIME_INPUT_TOKENS must be a non-negative 32-bit integer/
  )
})

test('event token formatting distinguishes missing, partial, and complete usage', () => {
  assert.equal(
    formatEventTokenUsage({ inputTokens: null, outputTokens: null }),
    '-'
  )
  assert.equal(
    formatEventTokenUsage({ inputTokens: 120, outputTokens: null }),
    '120（部分）'
  )
  assert.equal(formatEventTokenUsage({ inputTokens: 0, outputTokens: 0 }), '0')
})

test('graphqlRequest sends bearer auth and returns data', async () => {
  const calls = []
  const data = await graphqlRequest({
    apiUrl: 'http://runtime.test/graphql',
    token: 'writer-token',
    query: 'query Health { runtimeHealth { serverTime } }',
    variables: { value: 1 },
    fetchImpl: async (...args) => {
      calls.push(args)
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  assert.deepEqual(data, { ok: true })
  assert.equal(calls[0][0], 'http://runtime.test/graphql')
  assert.equal(calls[0][1].headers.authorization, 'Bearer writer-token')
})

test('graphqlRequest exposes GraphQL errors', async () => {
  await assert.rejects(
    graphqlRequest({
      query: 'mutation Broken { broken }',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            errors: [{ message: 'Invalid runtime writer token' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    }),
    /Invalid runtime writer token/
  )
})
