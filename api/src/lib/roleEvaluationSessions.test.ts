import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { zstdCompressSync } from 'node:zlib'

import {
  discoverCodexSession,
  discoverDshSession,
  dshWorkspaceDir,
  readThreadMessages,
  sessionIdFromLog,
} from './roleEvaluationSessions'
import { readSessionTurnTrace } from './sessionTrace'
import { taskKnowledgeView } from './taskKnowledge'

const projectRoot = '/Users/fan/ai-digital-team'
const sessionId = '11111111-2222-4333-8444-555555555555'

const codexLine = (record: Record<string, unknown>) =>
  `${JSON.stringify(record)}\n`

let workspace: string

beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'role-eval-sessions-'))
  process.env.CODEX_SESSION_ROOT = path.join(workspace, 'codex')
  process.env.DSH_SESSION_ROOT = path.join(workspace, 'dsh')
})

afterEach(() => {
  delete process.env.CODEX_SESSION_ROOT
  delete process.env.DSH_SESSION_ROOT
  rmSync(workspace, { recursive: true, force: true })
})

const writeCodexSession = ({ cwd = projectRoot } = {}) => {
  const dir = path.join(process.env.CODEX_SESSION_ROOT!, '2026', '11', '13')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `rollout-2026-11-13T12-00-00-${sessionId}.jsonl`)
  writeFileSync(
    file,
    [
      codexLine({
        timestamp: '2026-11-13T04:00:00.000Z',
        type: 'session_meta',
        payload: { session_id: sessionId, cwd },
      }),
      codexLine({
        timestamp: '2026-11-13T04:00:01.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: '数字团队 · 岗位评估：数字总经理' },
          ],
        },
      }),
      codexLine({
        timestamp: '2026-11-13T04:01:00.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: '报告已写入 docs/role-evaluations/x.md',
            },
          ],
        },
      }),
    ].join('')
  )
  return file
}

describe('codex session discovery and thread', () => {
  it('preserves bounded long knowledge prompts through the Codex trace reader', async () => {
    const sources = Array.from({ length: 4 }, (_, index) => {
      const content = '知识片段'.repeat(375)
      return {
        blockId: `20261124114528-aaaaaa${index}`,
        documentId: '20261124114528-q4huiws',
        notebookId: '20261120125154-pdkeju4',
        citation: `[KB-${index + 1}]`,
        retrievedAt: '2026-11-24T00:00:00.000Z',
        contentHash: createHash('sha256').update(content).digest('hex'),
        content,
        title: '知识快照',
      }
    })
    const prompt =
      '任务说明'.repeat(1000) +
      '\n## 本轮外部知识参考\n' +
      JSON.stringify(sources)
    const file = writeCodexSession()
    writeFileSync(
      file,
      codexLine({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      })
    )
    const defaults = await readThreadMessages({
      tool: 'codex',
      sessionId,
      projectRoot,
    })
    expect(defaults[0].content.length).toBeLessThan(prompt.length)
    const trace = await readSessionTurnTrace({
      tool: 'codex',
      sessionId,
      projectRoot,
      limits: { messageChars: 60_000 },
    })
    expect(trace.messages[0].content).toBe(prompt)
    const view = taskKnowledgeView({
      evidence: { knowledge: { status: 'hit', sources } },
      prompts: trace.messages.map((message) => message.content),
    })
    expect(view.sources.filter((source) => source.content)).toHaveLength(4)
  })

  it('finds the session by cwd and reads user/assistant messages', async () => {
    writeCodexSession()
    const since = new Date(Date.now() - 60_000)

    const found = await discoverCodexSession({ projectRoot, since })
    expect(found?.sessionId).toBe(sessionId)

    const messages = await readThreadMessages({
      tool: 'codex',
      sessionId,
      projectRoot,
    })
    expect(messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
    ])
    expect(messages[0].content).toContain('岗位评估')
    expect(messages[1].content).toContain('报告已写入')
  })

  it('ignores sessions from another project', async () => {
    writeCodexSession({ cwd: '/Users/fan/other-project' })

    const found = await discoverCodexSession({
      projectRoot,
      since: new Date(Date.now() - 60_000),
    })
    expect(found).toBeNull()
  })

  it('ignores sessions older than the dispatch time', async () => {
    const file = writeCodexSession()
    const old = new Date(Date.now() - 3_600_000)
    utimesSync(file, old, old)

    const found = await discoverCodexSession({
      projectRoot,
      since: new Date(Date.now() - 60_000),
    })
    expect(found).toBeNull()
  })
})

describe('dsh session discovery and thread', () => {
  it('finds the workspace session and reads messages from zstd', async () => {
    const dir = path.join(
      process.env.DSH_SESSION_ROOT!,
      dshWorkspaceDir(projectRoot),
      `session-${sessionId}`
    )
    mkdirSync(dir, { recursive: true })

    const records = [
      {
        type: 'user/message',
        timestamp: '2026-11-13T04:00:01.000Z',
        data: {
          content: [{ type: 'text', text: '数字团队 · 岗位评估：数字总经理' }],
        },
      },
      {
        type: 'assistant/message',
        timestamp: '2026-11-13T04:01:00.000Z',
        data: {
          content: [
            {
              type: 'text',
              text: '评估完成，报告路径 docs/role-evaluations/y.md',
            },
          ],
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n')

    writeFileSync(
      path.join(dir, 'session.v4.jsonl.zstd'),
      zstdCompressSync(Buffer.from(records, 'utf8'))
    )

    const found = await discoverDshSession({
      projectRoot,
      since: new Date(Date.now() - 60_000),
    })
    // dsh 的会话 id 带 session- 前缀，与 CLI 输出、resume 参数一致
    expect(found?.sessionId).toBe(`session-${sessionId}`)

    const messages = await readThreadMessages({
      tool: 'deepseek-harness',
      sessionId: `session-${sessionId}`,
      projectRoot,
    })
    expect(messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
    ])
    expect(messages[1].content).toContain('评估完成')
  })
})

describe('session id from --json log', () => {
  const writeLog = (lines: string[]) => {
    const file = path.join(workspace, 'run.log')
    writeFileSync(file, lines.join('\n'))
    return file
  }

  it('reads codex thread.started', () => {
    const file = writeLog([
      'Reading additional input from stdin...',
      '{"type":"thread.started","thread_id":"01a1d336-11cb-7180-b5ec-3681a687f492"}',
    ])
    expect(sessionIdFromLog(file, 'codex')).toBe(
      '01a1d336-11cb-7180-b5ec-3681a687f492'
    )
  })

  it('reads dsh session event', () => {
    const file = writeLog([
      '{"type":"session","sessionId":"session-ca5a0621-f808-4132-a19f-0cfc83aaaddc","cwd":"/tmp"}',
    ])
    expect(sessionIdFromLog(file, 'deepseek-harness')).toBe(
      'session-ca5a0621-f808-4132-a19f-0cfc83aaaddc'
    )
  })

  it('returns null when no session event exists', () => {
    const file = writeLog(['{"type":"status","phase":"turn_start"}'])
    expect(sessionIdFromLog(file, 'codex')).toBeNull()
  })
})
