import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { Alert, Button, Drawer, Modal, Segmented, Skeleton, Tag } from 'antd'
import { CheckCircle2, Clock3, FileText, Terminal, Wrench } from 'lucide-react'

import { useQuery } from '@cedarjs/web'

import CodePreview from 'src/components/CodePreview/CodePreview'
import {
  isMarkdownPath,
  languageForPath,
} from 'src/components/CodePreview/artifactTree'
import MarkdownDocument from 'src/components/MarkdownDocument/MarkdownDocument'
import {
  describeWorkflowStage,
  WORKFLOW_STAGES,
  type WorkflowStageName,
} from 'src/components/TaskRuntimeDashboard/workflowFlow'

import {
  buildStageSections,
  stageMetrics,
  type StageDetailRun,
  type StageSection,
  type StageTaskArtifact,
  type StageTrace,
} from './stageDetailData'

const SOURCES_QUERY = gql`
  query TaskStageSources($id: ID!) {
    taskRun(id: $id) {
      id
      taskId
      logPath
      task {
        id
        title
        brief
        acceptance
        planPath
        planNote
        reviewNote
        reviewedAt
        completedAt
        artifacts {
          id
          kind
          path
          label
        }
      }
    }
  }
`

const TRACE_QUERY = gql`
  query TaskStageTrace($runId: ID!) {
    taskRunTrace(runId: $runId) {
      turn
      source
      truncated
      messages {
        role
        content
        createdAt
        step
      }
      tools {
        name
        detail
        result
        resultTruncated
        redacted
        createdAt
        step
      }
    }
  }
`

const PLAN_QUERY = gql`
  query TaskStagePlan($taskId: ID!) {
    taskPlanContent(taskId: $taskId)
  }
`

const LOG_QUERY = gql`
  query TaskStageLog($runId: ID!) {
    taskRunLog(runId: $runId)
  }
`

const ARTIFACT_QUERY = gql`
  query TaskStageArtifactContent($id: ID!) {
    taskArtifactContent(id: $id)
  }
`

type MessageMode = 'preview' | 'source'

const STATE_LABEL = {
  done: '已完成',
  active: '执行中',
  waiting: '待确认',
  failed: '异常',
  next: '未开始',
} as const

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

const formatTokens = (value: number | null) =>
  value == null ? '未采集' : new Intl.NumberFormat('zh-CN').format(value)

const SectionHeading = ({
  section,
  extra,
}: {
  section: StageSection
  extra?: ReactNode
}) => (
  <div className="stage-detail-section-heading">
    <h3>{section.title}</h3>
    <div className="stage-detail-heading-side">
      {extra}
      <span className="stage-detail-source">{section.source}</span>
    </div>
  </div>
)

const ArtifactList = ({
  items,
  onOpen,
}: {
  items: StageTaskArtifact[]
  onOpen: (artifact: StageTaskArtifact) => void
}) => (
  <ul className="stage-detail-artifacts">
    {items.map((artifact) => (
      <li key={artifact.id}>
        <Button
          type="link"
          size="small"
          onClick={() => onOpen(artifact)}
          disabled={artifact.kind === 'url'}
        >
          {artifact.label}
        </Button>
        <code>{artifact.path}</code>
      </li>
    ))}
  </ul>
)

const SectionBody = ({
  section,
  messageMode,
  onOpenArtifact,
}: {
  section: StageSection
  messageMode: MessageMode
  onOpenArtifact: (artifact: StageTaskArtifact) => void
}) => {
  if (section.kind === 'keyvals') {
    return (
      <dl className="stage-detail-keyvals">
        {section.items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  if (section.kind === 'markdown') {
    return <MarkdownDocument content={section.body} />
  }

  if (section.kind === 'text') {
    return <p className="stage-detail-text">{section.body}</p>
  }

  if (section.kind === 'list') {
    return (
      <ul className="stage-detail-list">
        {section.items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    )
  }

  if (section.kind === 'artifacts') {
    return <ArtifactList items={section.items} onOpen={onOpenArtifact} />
  }

  if (section.kind === 'messages') {
    return (
      <div
        className={`stage-detail-messages ${messageMode === 'preview' ? 'is-preview' : ''}`}
      >
        {section.messages.map((message, index) => (
          <div
            key={`${message.createdAt}-${index}`}
            className={`eval-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className="eval-bubble-meta">
              {message.role === 'user' ? '我' : 'Agent'}
              {message.step != null ? ` · STEP ${message.step}` : ''} ·{' '}
              {formatDateTime(message.createdAt)}
            </div>
            {messageMode === 'preview' ? (
              <div className="stage-detail-message-md">
                <MarkdownDocument content={message.content} toggle={false} />
              </div>
            ) : (
              <div className="eval-bubble-body">{message.content}</div>
            )}
          </div>
        ))}
        {section.truncated && (
          <p className="stage-detail-hint">
            内容较多，只显示前面的部分；完整过程可在原始会话里查看。
          </p>
        )}
      </div>
    )
  }

  if (section.kind === 'tools') {
    return (
      <div className="stage-detail-tools">
        {section.tools.map((tool, index) => (
          <div className="stage-detail-tool" key={`${tool.createdAt}-${index}`}>
            <div className="stage-detail-tool-head">
              <Wrench size={13} /> <strong>{tool.name}</strong>
              {tool.redacted && <Tag>已隐藏内容</Tag>}
              <time>{formatDateTime(tool.createdAt)}</time>
            </div>
            {tool.detail && <code>{tool.detail}</code>}
            {tool.result && (
              <span className="stage-detail-tool-result">
                ↳ {tool.result}
                {tool.resultTruncated ? ' …' : ''}
              </span>
            )}
          </div>
        ))}
        {section.truncated && (
          <p className="stage-detail-hint">
            轨迹较多，只显示前面的部分；完整过程可在原始会话里查看。
          </p>
        )}
      </div>
    )
  }

  return <p className="stage-detail-empty">{section.body}</p>
}

export const StageDetailDrawer = ({
  run,
  stage,
  onClose,
}: {
  run: StageDetailRun
  stage: WorkflowStageName | null
  onClose: () => void
}) => {
  const open = Boolean(stage)
  const index = stage
    ? WORKFLOW_STAGES.findIndex((item) => item.value === stage)
    : -1
  const described = stage ? describeWorkflowStage(run, stage, index) : null
  const reached = Boolean(described && described.state !== 'next')
  // 需求与交付在没有关联任务时只能从会话里取（首条需求 / 收尾说明）
  const needsTrace =
    stage === 'INTAKE' || stage === 'EXECUTION' || stage === 'DELIVERY'

  const [logOpen, setLogOpen] = useState(false)
  const [artifact, setArtifact] = useState<StageTaskArtifact | null>(null)
  const [messageMode, setMessageMode] = useState<MessageMode>('preview')

  // 切换阶段或关闭时收起上一次留下的日志、产物与渲染模式
  useEffect(() => {
    setLogOpen(false)
    setArtifact(null)
    setMessageMode('preview')
  }, [stage])

  const sources = useQuery<{
    taskRun: {
      taskId?: string | null
      logPath?: string | null
      task?: {
        id: string
        title: string
        brief: string
        acceptance: string
        planPath?: string | null
        planNote?: string | null
        reviewNote?: string | null
        artifacts: StageTaskArtifact[]
      } | null
    } | null
  }>(SOURCES_QUERY, {
    variables: { id: run.id },
    skip: !open,
    fetchPolicy: 'cache-and-network',
  })

  const task = sources.data?.taskRun?.task ?? null
  const logPath = sources.data?.taskRun?.logPath ?? null

  const trace = useQuery<{ taskRunTrace: StageTrace }>(TRACE_QUERY, {
    variables: { runId: run.id },
    skip: !open || !reached || !needsTrace,
    fetchPolicy: 'cache-and-network',
  })

  const plan = useQuery<{ taskPlanContent: string }>(PLAN_QUERY, {
    variables: { taskId: task?.id },
    skip: !open || !reached || stage !== 'PLANNING' || !task?.planPath,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  })

  const log = useQuery<{ taskRunLog: string }>(LOG_QUERY, {
    variables: { runId: run.id },
    skip: !open || !logOpen,
    fetchPolicy: 'cache-first',
  })

  const artifactContent = useQuery<{ taskArtifactContent: string }>(
    ARTIFACT_QUERY,
    {
      variables: { id: artifact?.id },
      skip: !artifact || artifact.kind === 'url',
      fetchPolicy: 'cache-and-network',
    }
  )

  const sections = useMemo(
    () =>
      stage
        ? buildStageSections({
            stage,
            run,
            task,
            trace: trace.data?.taskRunTrace ?? null,
            plan: {
              content: plan.data?.taskPlanContent ?? null,
              error: plan.error?.message ?? null,
            },
          })
        : [],
    [plan.data, plan.error, run, stage, task, trace.data]
  )

  const metrics = stage ? stageMetrics(run, stage) : null
  const label = stage
    ? (WORKFLOW_STAGES.find((item) => item.value === stage)?.label ?? stage)
    : ''

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        size="var(--drawer-width)"
        title={stage ? `阶段详情 · ${label}` : '阶段详情'}
        destroyOnHidden
      >
        {stage && described && metrics && (
          <div className="stage-detail">
            <div className="stage-detail-head">
              <span className={`workflow-stage-state ${described.state}`}>
                {described.state === 'done' ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <Clock3 size={13} />
                )}
                {STATE_LABEL[described.state]}
              </span>
              <Tag>{described.agent || '未分配岗位'}</Tag>
              <Tag>STEP {String(index + 1).padStart(2, '0')}</Tag>
              <Tag>{metrics.events.length} 条事件</Tag>
            </div>

            <dl className="stage-detail-metrics">
              <div>
                <dt>阶段开始</dt>
                <dd>{formatDateTime(metrics.start)}</dd>
              </div>
              <div>
                <dt>阶段结束</dt>
                <dd>
                  {metrics.end
                    ? formatDateTime(metrics.end)
                    : described.state === 'active' ||
                        described.state === 'waiting'
                      ? '进行中'
                      : '—'}
                </dd>
              </div>
              <div>
                <dt>输入 / 输出 Token</dt>
                <dd>
                  {formatTokens(metrics.inputTokens)} /{' '}
                  {formatTokens(metrics.outputTokens)}
                </dd>
              </div>
              <div>
                <dt>模型</dt>
                <dd>{metrics.models.join('、') || '未采集'}</dd>
              </div>
            </dl>

            {!reached ? (
              <Alert
                type="info"
                showIcon
                message="尚未到达该阶段"
                description="这条运行还没有进入这个阶段，暂时没有可展示的内容。"
              />
            ) : sources.loading && !sources.data ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : sources.error ? (
              <Alert
                type="warning"
                showIcon
                message="读取任务资料失败"
                description={sources.error.message}
              />
            ) : (
              <>
                {sections.map((section) => (
                  <section className="stage-detail-section" key={section.key}>
                    <SectionHeading
                      section={section}
                      extra={
                        section.kind === 'messages' ? (
                          <Segmented
                            size="small"
                            value={messageMode}
                            onChange={(value) =>
                              setMessageMode(value as MessageMode)
                            }
                            options={[
                              { label: '预览', value: 'preview' },
                              { label: '源码', value: 'source' },
                            ]}
                          />
                        ) : null
                      }
                    />
                    <SectionBody
                      section={section}
                      messageMode={messageMode}
                      onOpenArtifact={setArtifact}
                    />
                  </section>
                ))}

                {stage === 'EXECUTION' && logPath && (
                  <section className="stage-detail-section">
                    <div className="stage-detail-section-heading">
                      <h3>原始日志</h3>
                      <span className="stage-detail-source">本地文件</span>
                    </div>
                    <Button
                      size="small"
                      icon={<Terminal size={14} />}
                      onClick={() => setLogOpen((value) => !value)}
                    >
                      {logOpen ? '收起日志' : `查看 ${logPath}`}
                    </Button>
                    {logOpen && (
                      <pre className="md-source task-log">
                        {log.loading && !log.data
                          ? '正在读取日志…'
                          : (log.data?.taskRunLog ?? log.error?.message ?? '')}
                      </pre>
                    )}
                  </section>
                )}
              </>
            )}

            <section className="stage-detail-section">
              <div className="stage-detail-section-heading">
                <h3>阶段事件</h3>
                <span className="stage-detail-source">任务记录</span>
              </div>
              {metrics.events.length ? (
                <div className="workflow-stage-event-list">
                  {metrics.events.map((event) => (
                    <div className="workflow-stage-event" key={event.id}>
                      <time>{formatDateTime(event.createdAt)}</time>
                      <strong>{event.summary}</strong>
                      <span>#{event.sequence}</span>
                      <div>
                        <em>{event.agent}</em>
                        {(event.skills ?? []).map((skill) => (
                          <em key={skill}>{skill}</em>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="stage-detail-empty">这个阶段没有写入事件记录。</p>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(artifact)}
        onCancel={() => setArtifact(null)}
        footer={null}
        className="artifact-preview-modal"
        width="min(1180px, 94vw)"
        style={{ top: 28 }}
        title={
          <span>
            <FileText size={14} /> {artifact?.label}
          </span>
        }
        destroyOnHidden
      >
        {artifactContent.error ? (
          <Alert
            type="warning"
            showIcon
            message="读取产物失败"
            description={artifactContent.error.message}
          />
        ) : artifact?.kind === 'report' || isMarkdownPath(artifact?.path) ? (
          <MarkdownDocument
            content={artifactContent.data?.taskArtifactContent ?? ''}
          />
        ) : languageForPath(artifact?.path) ? (
          <CodePreview
            content={artifactContent.data?.taskArtifactContent ?? ''}
            language={languageForPath(artifact?.path) ?? 'ts'}
          />
        ) : (
          <pre className="md-source">
            {artifactContent.loading && !artifactContent.data
              ? '读取中…'
              : (artifactContent.data?.taskArtifactContent ?? '')}
          </pre>
        )}
      </Modal>
    </>
  )
}

export default StageDetailDrawer
