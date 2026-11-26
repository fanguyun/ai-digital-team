import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs'
import path from 'node:path'

import { UserInputError } from '@cedarjs/graphql-server'

import { assertAuthenticated } from 'src/directives/requireAuth/requireAuth'
import { db } from 'src/lib/db'
import { loadKnowledgeSource } from 'src/lib/knowledgeSource'
import { logger } from 'src/lib/logger'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'
import { listSiYuanNotebooks } from 'src/lib/siyuanKnowledge'
import {
  normalizePublicationHtml,
  normalizePublicationMarkdown,
  publicationHash,
  publicationPath,
  publicationPathAllowed,
  siyuanId,
  siyuanPublicationClient,
} from 'src/lib/siyuanPublication'
import {
  assertWorkflowPublication,
  beginWorkflowPublication,
  syncWorkflowPublication,
} from 'src/lib/workflowRuntime'

type Session = { context?: { currentUser?: { id?: string } | null } }
type PrepareInput = {
  taskId?: string | null
  artifactId?: string | null
  title: string
  markdown?: string | null
  notebookId: string
  directory: string
}

const userId = (service: Session) => {
  assertAuthenticated(service.context)
  return service.context!.currentUser!.id!
}

const sourceFor = async (taskId?: string | null) => {
  const task = taskId
    ? await db.task.findUnique({ where: { id: taskId } })
    : null
  if (taskId && !task) throw new UserInputError('任务不存在')
  const source = await loadKnowledgeSource(task?.agentSlug || 'main-agent')
  if (source.status !== 'ok' || source.provider !== 'siyuan')
    throw new UserInputError(
      '请启用思源直连并配置令牌及岗位范围；检索桥暂不支持文档入库。'
    )
  return source
}

const fingerprint = (source: Awaited<ReturnType<typeof sourceFor>>) =>
  publicationHash(
    JSON.stringify({
      origin: source.origin,
      provider: source.provider,
      notebooks: [...source.notebooks].sort(),
      pathPrefixes: [...source.pathPrefixes].sort(),
    })
  )

const readArtifact = (relative: string) => {
  const root = realpathSync(resolveRepoRoot())
  const absolute = realpathSync(path.resolve(root, relative))
  const canonical = path.relative(root, absolute).split(path.sep).join('/')
  if (!canonical.startsWith('docs/') || !/\.(md|txt)$/i.test(canonical))
    throw new UserInputError(
      '仅支持仓库 docs 目录内的 Markdown 或文本产物；其他正文可复制后手动入库。'
    )
  const descriptor = openSync(
    absolute,
    constants.O_RDONLY | (constants.O_NOFOLLOW || 0)
  )
  try {
    if (!fstatSync(descriptor).isFile())
      throw new UserInputError('产物不是文本文件')
    const buffer = Buffer.alloc(200_001)
    const length = readSync(descriptor, buffer, 0, buffer.length, 0)
    if (length > 200_000) throw new UserInputError('文档超过200KB')
    return buffer.subarray(0, length).toString('utf8')
  } finally {
    closeSync(descriptor)
  }
}

const checkDestination = async (
  source: Awaited<ReturnType<typeof sourceFor>>,
  notebookId: string,
  documentPath: string
) => {
  if (
    !siyuanId(notebookId) ||
    (source.notebooks.length && !source.notebooks.includes(notebookId))
  )
    throw new UserInputError('目标笔记本不在已配置的可用范围内')
  if (!publicationPathAllowed(documentPath, source.pathPrefixes))
    throw new UserInputError('目标目录不在已配置的目录白名单内')
  const listing = await listSiYuanNotebooks(source)
  if (
    !listing.ok ||
    !listing.notebooks.some(
      (notebook) => notebook.id === notebookId && !notebook.closed
    )
  )
    throw new UserInputError('目标笔记本不可用或未打开，请检查思源连接及权限')
}

export const knowledgePublicationTargets = async (
  { taskId }: { taskId?: string | null },
  service: Session = {}
) => {
  userId(service)
  try {
    const source = await sourceFor(taskId)
    const listing = await listSiYuanNotebooks(source)
    if (!listing.ok) throw new Error('无法读取思源笔记本，请检查连接与令牌。')
    const notebooks = listing.notebooks.filter(
      (notebook) =>
        !notebook.closed &&
        (!source.notebooks.length || source.notebooks.includes(notebook.id))
    )
    return {
      available: notebooks.length > 0,
      reason: notebooks.length ? null : '没有可写入的已打开笔记本。',
      notebooks,
      pathPrefixes: source.pathPrefixes,
    }
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : '知识库暂不可用',
      notebooks: [],
      pathPrefixes: [],
    }
  }
}

export const knowledgePublications = (
  { taskId }: { taskId?: string | null },
  service: Session = {}
) =>
  db.knowledgePublication.findMany({
    where: {
      createdBy: userId(service),
      ...(taskId ? { taskId } : { taskId: null }),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

export const prepareKnowledgePublication = async (
  { input }: { input: PrepareInput },
  service: Session = {}
) => {
  const createdBy = userId(service)
  if (input.taskId)
    await assertWorkflowPublication(input.taskId, input.artifactId)
  const source = await sourceFor(input.taskId)
  let markdown = input.markdown || ''
  if (input.artifactId) {
    const artifact = await db.taskArtifact.findUnique({
      where: { id: input.artifactId },
    })
    if (
      !input.taskId ||
      !artifact ||
      artifact.taskId !== input.taskId ||
      artifact.kind === 'url'
    )
      throw new UserInputError('产物不属于当前任务或不是可读取文档')
    try {
      markdown = readArtifact(artifact.path)
    } catch (error) {
      throw new UserInputError(
        error instanceof UserInputError
          ? error.message
          : '产物不可读取，请检查文件是否存在及访问范围。'
      )
    }
  }
  markdown = normalizePublicationMarkdown(markdown)
  if (
    !markdown.trim() ||
    Buffer.byteLength(markdown, 'utf8') > 200_000 ||
    markdown.includes('\0')
  )
    throw new UserInputError('文档不能为空、包含空字符或超过200KB')
  if (
    /!\[[^\]]*\]\((?:\/images\/|(?:\.\.?\/)?(?:assets|images)\/)/i.test(
      markdown
    )
  )
    throw new UserInputError(
      '文档含本地图片引用，请先转为知识库可访问的链接；本轮不自动上传附件。'
    )
  let documentPath: string
  try {
    documentPath = publicationPath(input.directory, input.title)
  } catch (error) {
    throw new UserInputError((error as Error).message)
  }
  await checkDestination(source, input.notebookId, documentPath)
  const contentHash = publicationHash(markdown)
  const sourceFingerprint = fingerprint(source)
  const requestKey = publicationHash(
    JSON.stringify({
      createdBy,
      taskId: input.taskId || null,
      artifactId: input.artifactId || null,
      sourceFingerprint,
      notebookId: input.notebookId,
      documentPath,
      contentHash,
    })
  )
  const targetKey = publicationHash(
    JSON.stringify({
      origin: source.origin,
      notebookId: input.notebookId,
      documentPath,
    })
  )
  const existing = await db.knowledgePublication.findUnique({
    where: { targetKey },
  })
  if (existing && existing.requestKey !== requestKey)
    throw new UserInputError(
      '该目标已有入库快照，请从原记录继续；不同正文或来源请使用新标题。'
    )
  try {
    return await db.knowledgePublication.upsert({
      where: { requestKey },
      update: {},
      create: {
        requestKey,
        targetKey,
        taskId: input.taskId || null,
        artifactId: input.artifactId || null,
        createdBy,
        title: input.title.trim(),
        markdown,
        contentHash,
        sourceFingerprint,
        notebookId: input.notebookId,
        documentPath,
      },
    })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    )
      throw new UserInputError('该目标已有入库快照，请刷新原记录或使用新标题。')
    throw error
  }
}

export const publishKnowledgePublication = async (
  { id, contentHash }: { id: string; contentHash: string },
  service: Session = {}
) => {
  const createdBy = userId(service)
  const row = await db.knowledgePublication.findUnique({ where: { id } })
  if (!row || row.createdBy !== createdBy)
    throw new UserInputError('入库记录不存在')
  if (contentHash !== row.contentHash)
    throw new UserInputError('文档快照已变化，请重新预览后确认')
  if (row.taskId)
    await assertWorkflowPublication(row.taskId, row.artifactId, row.id)
  if (row.status === 'VERIFIED') {
    if (row.taskId) await syncWorkflowPublication(row.taskId)
    return row
  }
  if (
    row.status === 'PUBLISHING' &&
    Date.now() - row.updatedAt.getTime() < 60_000
  )
    throw new UserInputError('正在写入或核对，请稍后刷新，勿重复创建')
  const source = await sourceFor(row.taskId)
  if (fingerprint(source) !== row.sourceFingerprint)
    throw new UserInputError('知识库地址或范围配置已变化，请重新准备并确认文档')
  await checkDestination(source, row.notebookId, row.documentPath)
  await db.$transaction(async (tx) => {
    const claimed = await tx.knowledgePublication.updateMany({
      where: { id, status: row.status, updatedAt: row.updatedAt },
      data: {
        status: 'PUBLISHING',
        confirmedAt: row.confirmedAt || new Date(),
        error: null,
      },
    })
    if (!claimed.count) throw new UserInputError('入库状态已变化，请刷新后重试')
    if (row.taskId) await beginWorkflowPublication(row.taskId, row.id, tx)
  })
  const client = siyuanPublicationClient(source)
  let documentId = row.documentId
  let attempted = Boolean(row.attemptedAt)
  let result
  try {
    if (!documentId) {
      const ids = await client.find(row.notebookId, row.documentPath)
      if (ids.length > 1)
        throw new Error(
          '目标路径有多个同名文档，已停止；请在思源中整理后重试核对。'
        )
      documentId = ids[0] || null
      if (!documentId) {
        if (attempted)
          throw new Error(
            '上次写入结果未确认，暂未查到目标文档；请在思源检查后重试核对，系统不会重复创建。'
          )
        if (row.taskId)
          await assertWorkflowPublication(row.taskId, row.artifactId, row.id)
        const attempt = await db.knowledgePublication.updateMany({
          where: { id, attemptedAt: null },
          data: { attemptedAt: new Date() },
        })
        attempted = true
        if (!attempt.count)
          throw new Error(
            '已有写入请求正在处理，请稍后重试核对；系统不会重复创建。'
          )
        documentId = await client.create(
          row.notebookId,
          row.documentPath,
          row.markdown
        )
      }
      await db.knowledgePublication.update({
        where: { id },
        data: { documentId },
      })
    }
    const targetIds = await client.find(row.notebookId, row.documentPath)
    if (targetIds.length !== 1 || targetIds[0] !== documentId)
      throw new Error(
        '目标笔记本与路径下的文档不唯一或已移动，请在思源检查后重试核对。'
      )
    const readback = await client.read(documentId)
    if (readback.documentPath !== row.documentPath)
      throw new Error('目标文档路径与确认快照不一致，请在思源检查后重试核对。')
    let contentMatches =
      publicationHash(normalizePublicationMarkdown(readback.markdown)) ===
      row.contentHash
    if (!contentMatches) {
      const [expected, actual] = await Promise.all([
        client.render(row.markdown),
        client.render(readback.markdown),
      ])
      contentMatches =
        publicationHash(normalizePublicationHtml(expected)) ===
        publicationHash(normalizePublicationHtml(actual))
    }
    if (!contentMatches)
      throw new Error(
        '目标文档路径或回读正文与确认快照不一致；未覆盖已有文档，请检查思源内容或更换标题重新准备。'
      )
    result = await db.knowledgePublication.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        documentId,
        verifiedAt: new Date(),
        error: null,
      },
    })
  } catch (error) {
    result = await db.knowledgePublication.update({
      where: { id },
      data: {
        status: attempted || documentId ? 'UNCERTAIN' : 'FAILED',
        documentId,
        error: (error instanceof Error
          ? error.message
          : '入库未成功，请检查后重试核对。'
        ).slice(0, 500),
      },
    })
  }
  if (row.taskId) {
    try {
      await syncWorkflowPublication(row.taskId)
    } catch (error) {
      logger.warn(
        { error, taskId: row.taskId },
        'workflow publication state sync deferred to sweep'
      )
    }
  }
  return result
}

export const KnowledgePublication = {
  documentUrl: (
    _args: unknown,
    { root }: { root: { status: string; documentId?: string | null } }
  ) =>
    root.status === 'VERIFIED' && siyuanId(root.documentId)
      ? `siyuan://blocks/${root.documentId}`
      : null,
}
