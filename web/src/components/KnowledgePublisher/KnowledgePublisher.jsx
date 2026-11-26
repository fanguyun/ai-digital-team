import { useRef, useState } from 'react'

import { Alert, Button, Flex, Input, Modal, Select, Tag } from 'antd'

import { useMutation, useQuery } from '@cedarjs/web'

import MarkdownDocument from 'src/components/MarkdownDocument/MarkdownDocument'

const TARGETS = gql`
  query KnowledgePublicationTargets($taskId: ID) {
    knowledgePublicationTargets(taskId: $taskId) {
      available
      reason
      pathPrefixes
      notebooks {
        id
        name
        closed
      }
    }
  }
`
const RECORDS = gql`
  query KnowledgePublications($taskId: ID) {
    knowledgePublications(taskId: $taskId) {
      id
      title
      markdown
      contentHash
      notebookId
      documentPath
      status
      documentUrl
      error
      createdAt
    }
  }
`
const PREPARE = gql`
  mutation PrepareKnowledgePublication(
    $input: PrepareKnowledgePublicationInput!
  ) {
    prepareKnowledgePublication(input: $input) {
      id
      title
      markdown
      contentHash
      notebookId
      documentPath
      status
      documentUrl
      error
    }
  }
`
const PUBLISH = gql`
  mutation PublishKnowledgePublication($id: ID!, $contentHash: String!) {
    publishKnowledgePublication(id: $id, contentHash: $contentHash) {
      id
      title
      markdown
      contentHash
      notebookId
      documentPath
      status
      documentUrl
      error
    }
  }
`

const STATUS = {
  PREPARED: '待确认入库',
  PUBLISHING: '写入核对中',
  VERIFIED: '已回读验证',
  UNCERTAIN: '结果待核对',
  FAILED: '未写入',
}

export default function KnowledgePublisher({
  taskId,
  artifacts = [],
  workflowArtifactId,
  onChanged,
  readOnly = false,
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [artifactId, setArtifactId] = useState(workflowArtifactId || null)
  const [notebookId, setNotebookId] = useState(null)
  const [directory, setDirectory] = useState('')
  const [snapshot, setSnapshot] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const submitting = useRef(false)
  const {
    data: targetData,
    loading: targetLoading,
    error: targetError,
    refetch: refreshTargets,
  } = useQuery(TARGETS, {
    variables: { taskId },
    skip: !open,
    fetchPolicy: 'network-only',
  })
  const {
    data: recordData,
    refetch: refreshRecords,
    error: recordError,
  } = useQuery(RECORDS, {
    variables: { taskId },
    fetchPolicy: 'cache-and-network',
  })
  const [prepare] = useMutation(PREPARE)
  const [publish] = useMutation(PUBLISH)
  const targets = targetData?.knowledgePublicationTargets
  const records = recordData?.knowledgePublications || []
  const eligibleArtifacts = artifacts.filter(
    (artifact) =>
      artifact.kind !== 'url' && /^docs\/.+\.(md|txt)$/i.test(artifact.path)
  )

  const run = async (action) => {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (error) {
      setNotice({
        type: 'error',
        text: error.message || '操作未成功，请重试。',
      })
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  const prepareSnapshot = () =>
    run(async () => {
      const result = await prepare({
        variables: {
          input: {
            taskId,
            artifactId,
            title,
            markdown: artifactId ? null : markdown,
            notebookId,
            directory,
          },
        },
      })
      setSnapshot(result.data.prepareKnowledgePublication)
      await refreshRecords()
    })
  const confirm = () =>
    run(async () => {
      const result = await publish({
        variables: { id: snapshot.id, contentHash: snapshot.contentHash },
      })
      const record = result.data.publishKnowledgePublication
      setSnapshot(record)
      setNotice({
        type: record.status === 'VERIFIED' ? 'success' : 'warning',
        text:
          record.status === 'VERIFIED'
            ? '文档已入库，回读正文与确认快照内容一致（允许 Markdown 等价格式化）。'
            : record.error || '结果仍待核对，请稍后重试。',
      })
      await refreshRecords()
      await onChanged?.()
    })
  const start = () => {
    setSnapshot(null)
    setNotice(null)
    if (
      eligibleArtifacts.length &&
      (workflowArtifactId || (!artifactId && !markdown.trim()))
    ) {
      const document = eligibleArtifacts[0]
      setArtifactId(document.id)
      setTitle(
        document.path
          .split('/')
          .pop()
          .replace(/\.(md|txt)$/i, '')
      )
    }
    setOpen(true)
  }
  return (
    <section className="task-plan-box" aria-label="知识库文档入库">
      <Flex gap={8} align="center" wrap>
        <strong>知识库文档入库</strong>
        <Button onClick={start} disabled={readOnly}>
          将文档写入知识库
        </Button>
        <Button type="text" onClick={() => refreshRecords().catch(() => {})}>
          刷新入库记录
        </Button>
      </Flex>
      <p>
        {workflowArtifactId
          ? '使用当前已通过核验的报告，'
          : '选择任务文档或粘贴 AI 产物，'}
        预览正文与目标后确认。后端写入思源并回读验证；同名不同正文不会被覆盖。
      </p>
      {taskId && (
        <p>
          文档已生成时可直接在此入库，无需重跑
          Agent；执行沙箱的网络报错不决定后端入库结果。
        </p>
      )}
      {recordError && (
        <Alert
          type="error"
          title="入库记录读取失败"
          description="请确认服务已更新、数据库迁移已完成后刷新。"
        />
      )}
      {records.map((record) => (
        <Flex
          key={record.id}
          gap={8}
          align="center"
          wrap
          style={{ marginBottom: 8 }}
        >
          <span>{record.title}</span>
          <Tag color={record.status === 'VERIFIED' ? 'green' : 'gold'}>
            {STATUS[record.status] || record.status}
          </Tag>
          <code>{record.documentPath}</code>
          {record.documentUrl && <a href={record.documentUrl}>在思源中打开</a>}
          <Button
            size="small"
            onClick={() => {
              setSnapshot(record)
              setNotice(null)
              setOpen(true)
            }}
          >
            查看{record.status === 'VERIFIED' ? '回执' : '并继续'}
          </Button>
        </Flex>
      ))}
      <Modal
        title="文档入库思源"
        open={open}
        onCancel={() => {
          if (!busy) setOpen(false)
        }}
        footer={null}
        width={760}
        mask={{ closable: !busy }}
        closable={!busy}
        destroyOnHidden
      >
        {notice && <Alert type={notice.type} title={notice.text} />}
        {!snapshot ? (
          <Flex vertical gap={12}>
            <Alert
              type="info"
              title="确认后将创建外部文档"
              description="当前支持思源直连与 Markdown／文本；不会上传本地附件，也不会覆盖已有文档。"
            />
            {targetError && (
              <Alert type="error" title="目标读取失败，请重新检查连接" />
            )}
            {!targetLoading && targets && !targets.available && (
              <Alert
                type="warning"
                title={targets.reason || '没有可用的目标'}
              />
            )}
            <Button
              loading={targetLoading}
              onClick={() => refreshTargets().catch(() => {})}
            >
              重新读取笔记本
            </Button>
            <label htmlFor="publication-source">文档来源</label>
            <Select
              id="publication-source"
              aria-label="文档来源"
              disabled={Boolean(workflowArtifactId)}
              value={artifactId || 'paste'}
              onChange={(value) =>
                setArtifactId(value === 'paste' ? null : value)
              }
              options={[
                ...(!workflowArtifactId
                  ? [{ value: 'paste', label: '粘贴 AI 生成的正文' }]
                  : []),
                ...eligibleArtifacts.map((artifact) => ({
                  value: artifact.id,
                  label: artifact.label + ' · ' + artifact.path,
                })),
              ]}
            />
            <label htmlFor="publication-title">文档标题</label>
            <Input
              id="publication-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
            {!artifactId && (
              <>
                <label htmlFor="publication-markdown">Markdown 正文</label>
                <Input.TextArea
                  id="publication-markdown"
                  value={markdown}
                  rows={8}
                  onChange={(event) => setMarkdown(event.target.value)}
                />
              </>
            )}
            <label htmlFor="publication-notebook">目标笔记本</label>
            <Select
              id="publication-notebook"
              aria-label="目标笔记本"
              value={notebookId}
              onChange={setNotebookId}
              loading={targetLoading}
              options={(targets?.notebooks || []).map((notebook) => ({
                value: notebook.id,
                label: notebook.name,
              }))}
            />
            <label htmlFor="publication-directory">目标目录</label>
            <Input
              id="publication-directory"
              value={directory}
              onChange={(event) => setDirectory(event.target.value)}
              placeholder="例如 /团队/AI产物；留空使用笔记本根目录"
            />
            {!!targets?.pathPrefixes?.length && (
              <p>可用目录：{targets.pathPrefixes.join('、')}</p>
            )}
            <Button
              type="primary"
              loading={busy}
              disabled={
                targetLoading ||
                !targets?.available ||
                !notebookId ||
                !title.trim() ||
                (!artifactId && !markdown.trim())
              }
              onClick={prepareSnapshot}
            >
              预览待入库文档
            </Button>
          </Flex>
        ) : (
          <Flex vertical gap={12}>
            <Tag>{STATUS[snapshot.status] || snapshot.status}</Tag>
            <strong>{snapshot.title}</strong>
            <p>
              笔记本：
              {targets?.notebooks?.find(
                (notebook) => notebook.id === snapshot.notebookId
              )?.name || snapshot.notebookId}
              （{snapshot.notebookId}）
            </p>
            <p>
              文档路径：<code>{snapshot.documentPath}</code>
            </p>
            <p>
              本次将使用下方保存的正文快照；之后对本地文件的修改不会改变该快照。
            </p>
            <MarkdownDocument content={snapshot.markdown} />
            {snapshot.error && <Alert type="warning" title={snapshot.error} />}
            {snapshot.documentUrl && (
              <a href={snapshot.documentUrl}>在思源中打开已验证文档</a>
            )}
            {snapshot.status !== 'VERIFIED' &&
              (!readOnly ||
                !['PREPARED', 'FAILED'].includes(snapshot.status)) && (
                <Button type="primary" loading={busy} onClick={confirm}>
                  {snapshot.status === 'PREPARED' ||
                  snapshot.status === 'FAILED'
                    ? '确认写入思源并回读验证'
                    : '重试核对（避免重复创建）'}
                </Button>
              )}
            <Button
              disabled={busy || readOnly}
              onClick={() => {
                setSnapshot(null)
                setNotice(null)
              }}
            >
              重新准备文档
            </Button>
          </Flex>
        )}
      </Modal>
    </section>
  )
}
