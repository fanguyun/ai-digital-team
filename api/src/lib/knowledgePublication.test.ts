import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { db } from 'src/lib/db'
import { loadKnowledgeSource } from 'src/lib/knowledgeSource'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'
import { listSiYuanNotebooks } from 'src/lib/siyuanKnowledge'
import {
  publicationHash,
  siyuanPublicationClient,
} from 'src/lib/siyuanPublication'
import {
  syncWorkflowPublication,
  beginWorkflowPublication,
} from 'src/lib/workflowRuntime'
import {
  knowledgePublications,
  prepareKnowledgePublication,
  publishKnowledgePublication,
  KnowledgePublication,
  knowledgePublicationTargets,
} from 'src/services/knowledgePublications/knowledgePublications'

jest.mock('src/lib/workflowRuntime', () => ({
  assertWorkflowPublication: jest.fn(),
  beginWorkflowPublication: jest.fn(),
  syncWorkflowPublication: jest.fn(),
}))

jest.mock('src/lib/db', () => ({
  db: {
    $transaction: jest.fn(),
    task: { findUnique: jest.fn() },
    taskArtifact: { findUnique: jest.fn() },
    knowledgePublication: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))
jest.mock('src/lib/knowledgeSource', () => ({ loadKnowledgeSource: jest.fn() }))
jest.mock('src/lib/siyuanKnowledge', () => ({ listSiYuanNotebooks: jest.fn() }))
jest.mock('src/lib/roleEvaluationDispatch', () => ({
  resolveRepoRoot: jest.fn(() => process.cwd()),
}))
jest.mock('src/lib/siyuanPublication', () => ({
  ...jest.requireActual('src/lib/siyuanPublication'),
  siyuanPublicationClient: jest.fn(),
}))

const database = db as unknown as {
  $transaction: jest.Mock
  knowledgePublication: Record<string, jest.Mock>
  task: Record<string, jest.Mock>
  taskArtifact: Record<string, jest.Mock>
}
const notebookId = '20261123095000-box1234'
const documentId = '20261123095000-doc1234'
const session = { context: { currentUser: { id: 'user-id' } } }
const source = {
  status: 'ok',
  source: 'database',
  provider: 'siyuan',
  mode: 'optional',
  origin: 'http://nas.local',
  token: 'secret-never-expose',
  notebooks: [notebookId],
  pathPrefixes: ['团队/AI'],
  timeoutMs: 2000,
} as const
let row
let client
beforeEach(() => {
  jest.clearAllMocks()
  database.$transaction.mockImplementation((fn) => fn(database))
  jest.mocked(syncWorkflowPublication).mockResolvedValue(undefined)
  jest.mocked(beginWorkflowPublication).mockResolvedValue(undefined)
  jest.mocked(resolveRepoRoot).mockReturnValue(process.cwd())
  row = {
    id: 'publication-id',
    requestKey: 'key',
    taskId: 'task-id',
    artifactId: null,
    createdBy: 'user-id',
    title: '报告',
    markdown: '# 报告\n\n正文',
    contentHash: publicationHash('# 报告\n\n正文'),
    notebookId,
    documentPath: '/团队/AI/报告',
    sourceFingerprint: publicationHash(
      JSON.stringify({
        origin: source.origin,
        provider: source.provider,
        notebooks: [notebookId],
        pathPrefixes: ['团队/AI'],
      })
    ),
    status: 'PREPARED',
    attemptedAt: null,
    confirmedAt: null,
    documentId: null,
    updatedAt: new Date(),
  }
  jest.mocked(loadKnowledgeSource).mockResolvedValue({
    ...source,
    notebooks: [...source.notebooks],
    pathPrefixes: [...source.pathPrefixes],
  })
  jest.mocked(listSiYuanNotebooks).mockResolvedValue({
    ok: true,
    notebooks: [{ id: notebookId, name: '团队', closed: false }],
  })
  database.task.findUnique.mockResolvedValue({ agentSlug: 'main-agent' })
  database.knowledgePublication.findUnique.mockImplementation(
    async ({ where }) => (where.id ? row : null)
  )
  database.knowledgePublication.updateMany.mockImplementation(
    async ({ where, data }) => {
      if ('attemptedAt' in where && row.attemptedAt) return { count: 0 }
      row = { ...row, ...data }
      return { count: 1 }
    }
  )
  database.knowledgePublication.upsert.mockImplementation(
    async ({ create }) => ({ ...create, id: row.id, status: 'PREPARED' })
  )
  database.knowledgePublication.update.mockImplementation(async ({ data }) => {
    row = { ...row, ...data }
    return row
  })
  client = {
    find: jest.fn(async () => (row.documentId ? [row.documentId] : [])),
    create: jest.fn().mockResolvedValue(documentId),
    read: jest.fn().mockResolvedValue({
      documentPath: row.documentPath,
      markdown: row.markdown,
    }),
    render: jest.fn(async (markdown: string) => '<p>' + markdown + '</p>'),
  }
  jest.mocked(siyuanPublicationClient).mockReturnValue(client)
})

it('requires a logged-in user and isolates records and confirmations by creator', async () => {
  expect(() => knowledgePublications({}, {})).toThrow('请先登录')
  await expect(
    publishKnowledgePublication(
      { id: row.id, contentHash: row.contentHash },
      { context: { currentUser: { id: 'other-user' } } }
    )
  ).rejects.toThrow('不存在')
  await expect(
    prepareKnowledgePublication({
      input: {
        title: '报告',
        markdown: '正文',
        notebookId,
        directory: '/团队/AI',
      },
    })
  ).rejects.toThrow('请先登录')
  expect(client.create).not.toHaveBeenCalled()
})

it('prepares an immutable server snapshot without writing externally or exposing credentials', async () => {
  const result = await prepareKnowledgePublication(
    {
      input: {
        taskId: 'task-id',
        title: '报告',
        markdown: '# 报告\n\n正文',
        notebookId,
        directory: '/团队/AI',
      },
    },
    session
  )
  expect(result).toMatchObject({
    markdown: row.markdown,
    contentHash: row.contentHash,
    documentPath: row.documentPath,
  })
  expect(JSON.stringify(result)).not.toContain('secret-never-expose')
  expect(client.create).not.toHaveBeenCalled()
})

it('checks notebook, directory, artifact ownership and unsupported bridge providers', async () => {
  const input = {
    taskId: 'task-id',
    title: '报告',
    markdown: '正文',
    notebookId,
    directory: '/团队/AI2',
  }
  await expect(prepareKnowledgePublication({ input }, session)).rejects.toThrow(
    '白名单'
  )
  await expect(
    prepareKnowledgePublication(
      {
        input: {
          ...input,
          directory: '/团队/AI',
          notebookId: '20261123095000-xxx1234',
        },
      },
      session
    )
  ).rejects.toThrow('笔记本')
  database.taskArtifact.findUnique.mockResolvedValue({
    taskId: 'different-task',
    path: 'docs/report.md',
  })
  await expect(
    prepareKnowledgePublication(
      { input: { ...input, artifactId: 'artifact' } },
      session
    )
  ).rejects.toThrow('不属于')
  jest.mocked(loadKnowledgeSource).mockResolvedValue({
    ...source,
    provider: 'bridge',
    notebooks: [],
    pathPrefixes: [],
  })
  await expect(prepareKnowledgePublication({ input }, session)).rejects.toThrow(
    '检索桥'
  )
})

it('rejects duplicate target snapshots with different content or creator', async () => {
  database.knowledgePublication.findUnique.mockResolvedValue(row)
  await expect(
    prepareKnowledgePublication(
      {
        input: {
          title: '报告',
          markdown: '其他正文',
          notebookId,
          directory: '/团队/AI',
        },
      },
      session
    )
  ).rejects.toThrow('该目标已有')
})

it('snapshots a real task artifact and rejects files outside docs before creating records', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pdt-publication-'))
  jest.mocked(resolveRepoRoot).mockReturnValue(root)
  const input = {
    taskId: 'task-id',
    artifactId: 'artifact-id',
    title: '报告',
    notebookId,
    directory: '/团队/AI',
  }
  try {
    mkdirSync(path.join(root, 'docs'))
    writeFileSync(path.join(root, 'docs/report.md'), '# 原始产物')
    writeFileSync(path.join(root, 'private.txt'), '私有内容')
    database.taskArtifact.findUnique.mockResolvedValue({
      taskId: input.taskId,
      path: 'docs/report.md',
      kind: 'file',
    })
    const result = await prepareKnowledgePublication({ input }, session)
    writeFileSync(path.join(root, 'docs/report.md'), '# 文件后续已修改')
    expect(result.markdown).toBe('# 原始产物')
    expect(result.contentHash).toBe(publicationHash('# 原始产物'))
    database.knowledgePublication.upsert.mockClear()
    database.taskArtifact.findUnique.mockResolvedValue({
      taskId: input.taskId,
      path: 'docs/../private.txt',
      kind: 'file',
    })
    await expect(
      prepareKnowledgePublication({ input }, session)
    ).rejects.toThrow('docs')
    expect(database.knowledgePublication.upsert).not.toHaveBeenCalled()
    expect(client.create).not.toHaveBeenCalled()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('disables closed notebooks and refuses publication if the notebook was closed after preparation', async () => {
  jest.mocked(listSiYuanNotebooks).mockResolvedValue({
    ok: true,
    notebooks: [{ id: notebookId, name: '团队', closed: true }],
  })
  expect(await knowledgePublicationTargets({}, session)).toMatchObject({
    available: false,
    notebooks: [],
  })
  await expect(
    publishKnowledgePublication(
      { id: row.id, contentHash: row.contentHash },
      session
    )
  ).rejects.toThrow('未打开')
  expect(client.create).not.toHaveBeenCalled()
})

it('verifies an existing identical document without creating or overwriting it', async () => {
  client.find.mockResolvedValue([documentId])
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('VERIFIED')
  expect(client.create).not.toHaveBeenCalled()
})

it('accepts only equivalent rendered Markdown after SiYuan reformats list markers', async () => {
  row.markdown = '- 项目A\n- 项目B'
  row.contentHash = publicationHash(row.markdown)
  client.read.mockResolvedValue({
    documentPath: row.documentPath,
    markdown: '* 项目A\n* 项目B',
  })
  client.render.mockResolvedValue('<ul><li>项目A</li><li>项目B</li></ul>')
  expect(
    (
      await publishKnowledgePublication(
        { id: row.id, contentHash: row.contentHash },
        session
      )
    ).status
  ).toBe('VERIFIED')
  expect(client.render).toHaveBeenCalledWith(row.markdown)
  expect(client.render).toHaveBeenCalledWith('* 项目A\n* 项目B')
})

it('keeps the receipt uncertain when formatting comparison is unavailable', async () => {
  client.read.mockResolvedValue({
    documentPath: row.documentPath,
    markdown: '* 改变格式',
  })
  client.render.mockRejectedValue(new Error('格式核对不可用'))
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('UNCERTAIN')
  expect(KnowledgePublication.documentUrl({}, { root: result })).toBeNull()
})

it('verifies SiYuan formatting despite generated block metadata and configured paragraph indentation', async () => {
  row.markdown = '正文 **重点** 和 `code`\n\n- 项目'
  row.contentHash = publicationHash(row.markdown)
  client.read.mockResolvedValue({
    documentPath: row.documentPath,
    markdown: '　　正文 **重点**  和 ​`code`\n\n* 项目',
  })
  client.render
    .mockResolvedValueOnce(
      '<p id="20261124114311-aaaaaaa" updated="20261124114311">正文 <strong>重点</strong> 和 <code>code</code></p>\n<ul id="20261124114311-bbbbbbb" updated="20261124114311"><li id="20261124114311-ccccccc" updated="20261124114311">项目</li></ul>'
    )
    .mockResolvedValueOnce(
      '<p id="20261124114312-ddddddd" updated="20261124114312">　　正文 <strong>重点</strong>  和 ​<code>code</code></p>\n<ul id="20261124114312-eeeeeee" updated="20261124114312"><li id="20261124114312-fffffff" updated="20261124114312">项目</li></ul>'
    )
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('VERIFIED')
  expect(KnowledgePublication.documentUrl({}, { root: result })).toBe(
    `siyuan://blocks/${documentId}`
  )
})

it.each([
  [
    'code spaces',
    '<pre><code>  x  y\n</code></pre>',
    '<pre><code>x y\n</code></pre>',
  ],
  [
    'code metadata literal',
    '<code> id="20261124114311-aaaaaaa"</code>',
    '<code> id="20261124114312-bbbbbbb"</code>',
  ],
  ['hard breaks', '<p>正文<br />下一行</p>', '<p>正文 下一行</p>'],
  ['link targets', '<a href="/one">链接</a>', '<a href="/two">链接</a>'],
  [
    'quoted attributes',
    '<a title=\' id="20261124114311-aaaaaaa"\'>链接</a>',
    '<a title=\' id="20261124114312-bbbbbbb"\'>链接</a>',
  ],
  ['body text', '<p>同意</p>', '<p>不同意</p>'],
  [
    'spacing after inline code',
    '<p><code>x</code>　　正文</p>',
    '<p><code>x</code>正文</p>',
  ],
  [
    'spacing in a heading after an empty paragraph',
    '<p></p><h1>　　标题</h1>',
    '<p></p><h1>标题</h1>',
  ],
])(
  'keeps changed %s uncertain during formatting comparison',
  async (_name, expected, actual) => {
    client.read.mockResolvedValue({
      documentPath: row.documentPath,
      markdown: '已改变',
    })
    client.render.mockResolvedValueOnce(expected).mockResolvedValueOnce(actual)
    const result = await publishKnowledgePublication(
      { id: row.id, contentHash: row.contentHash },
      session
    )
    expect(result.status).toBe('UNCERTAIN')
    expect(KnowledgePublication.documentUrl({}, { root: result })).toBeNull()
  }
)

it('rechecks notebook ownership for persisted document IDs before marking a receipt verified', async () => {
  row.documentId = documentId
  row.status = 'UNCERTAIN'
  row.attemptedAt = new Date()
  client.find.mockResolvedValue([])
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('UNCERTAIN')
  expect(result.error).toContain('已移动')
  expect(client.read).not.toHaveBeenCalled()
  expect(client.create).not.toHaveBeenCalled()
})

it('does not erase code indentation or hard line breaks from snapshots and readback checks', async () => {
  const markdown = '    代码  \n\n正文  \n换行'
  const prepared = await prepareKnowledgePublication(
    { input: { title: '报告', markdown, notebookId, directory: '/团队/AI' } },
    session
  )
  expect(prepared.markdown).toBe(markdown)
  row.markdown = markdown
  row.contentHash = publicationHash(markdown)
  client.read.mockResolvedValue({
    documentPath: row.documentPath,
    markdown: '    代码\n\n正文\n换行',
  })
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('UNCERTAIN')
  expect(client.render).toHaveBeenCalledTimes(2)
})

it('retries only readback after successful creation and rejects ambiguous target paths', async () => {
  client.read.mockRejectedValueOnce(new Error('暂时无法回读'))
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('UNCERTAIN')
  expect(result.documentId).toBe(documentId)
  expect(
    (
      await publishKnowledgePublication(
        { id: row.id, contentHash: row.contentHash },
        session
      )
    ).status
  ).toBe('VERIFIED')
  expect(client.create).toHaveBeenCalledTimes(1)
  row = { ...row, status: 'PREPARED', documentId: null, attemptedAt: null }
  client.find.mockResolvedValue([documentId, '20261123095000-xyz1234'])
  expect(
    (
      await publishKnowledgePublication(
        { id: row.id, contentHash: row.contentHash },
        session
      )
    ).error
  ).toContain('多个同名')
  expect(client.create).toHaveBeenCalledTimes(1)
})

it('creates once, verifies by readback, and returns a document link only after verification', async () => {
  expect(KnowledgePublication.documentUrl({}, { root: row })).toBeNull()
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('VERIFIED')
  expect(client.create).toHaveBeenCalledTimes(1)
  expect(client.read).toHaveBeenCalledWith(documentId)
  expect(KnowledgePublication.documentUrl({}, { root: result })).toBe(
    `siyuan://blocks/${documentId}`
  )
  await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(client.create).toHaveBeenCalledTimes(1)
})

it('rejects stale content, changed source scope, and concurrent claims before writing', async () => {
  await expect(
    publishKnowledgePublication({ id: row.id, contentHash: 'changed' }, session)
  ).rejects.toThrow('快照已变化')
  jest.mocked(loadKnowledgeSource).mockResolvedValueOnce({
    ...source,
    origin: 'http://new-host',
    notebooks: [notebookId],
    pathPrefixes: ['团队/AI'],
  })
  await expect(
    publishKnowledgePublication(
      { id: row.id, contentHash: row.contentHash },
      session
    )
  ).rejects.toThrow('配置已变化')
  database.knowledgePublication.updateMany.mockResolvedValueOnce({ count: 0 })
  await expect(
    publishKnowledgePublication(
      { id: row.id, contentHash: row.contentHash },
      session
    )
  ).rejects.toThrow('状态已变化')
  expect(client.create).not.toHaveBeenCalled()
})

it('recovers a timed-out creation by locating and reading the same document without recreating', async () => {
  client.create.mockRejectedValueOnce(new Error('思源请求未成功'))
  let result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('UNCERTAIN')
  expect(result.attemptedAt).toBeInstanceOf(Date)
  client.find.mockResolvedValueOnce([documentId])
  result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('VERIFIED')
  expect(client.create).toHaveBeenCalledTimes(1)
})

it('never creates if another worker has already claimed the persistent write attempt', async () => {
  database.knowledgePublication.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 })
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('UNCERTAIN')
  expect(result.error).toContain('已有写入请求')
  expect(client.create).not.toHaveBeenCalled()
})

it('does not recreate an uncertain missing document and does not overwrite different existing content', async () => {
  row.attemptedAt = new Date()
  row.status = 'UNCERTAIN'
  const uncertain = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(uncertain.status).toBe('UNCERTAIN')
  expect(client.create).not.toHaveBeenCalled()
  row.attemptedAt = null
  client.find.mockResolvedValueOnce([documentId])
  client.read.mockResolvedValueOnce({
    documentPath: row.documentPath,
    markdown: 'existing other content',
  })
  const conflict = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(conflict.status).toBe('UNCERTAIN')
  expect(conflict.error).toContain('不一致')
  expect(client.create).not.toHaveBeenCalled()
})

it('keeps VERIFIED after successful readback if workflow synchronization is temporarily unavailable', async () => {
  jest
    .mocked(syncWorkflowPublication)
    .mockRejectedValueOnce(new Error('temporary sync failure'))
  const result = await publishKnowledgePublication(
    { id: row.id, contentHash: row.contentHash },
    session
  )
  expect(result.status).toBe('VERIFIED')
  expect(client.create).toHaveBeenCalledTimes(1)
  expect(database.knowledgePublication.update).not.toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'UNCERTAIN' }),
    })
  )
})
