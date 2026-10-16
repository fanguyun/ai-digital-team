import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileCheck2,
  Users,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Button, Card, Tag, Typography } from 'antd'

import {
  describeWorkflowStage,
  WORKFLOW_STAGES,
  type WorkflowStageName,
  type WorkflowStatus,
} from 'src/components/TaskRuntimeCell/workflowFlow'

import {
  formatTokenValue,
  summarizeTaskTokens,
  taskParticipants,
  taskSkills,
} from './taskDetailData'

export type TaskDetailEvent = {
  id: string
  sequence: number
  eventType: string
  status?: WorkflowStatus | null
  stage: WorkflowStageName
  agent: string
  skills: string[]
  summary: string
  evidence?: unknown
  inputTokens?: number | null
  outputTokens?: number | null
  cachedTokens?: number | null
  modelId?: string | null
  createdAt: string
}
export type TaskDetailTask = {
  id: string
  title: string
  platform: string
  externalReference?: string | null
  primaryAgent: string
  status: WorkflowStatus
  currentStage: WorkflowStageName
  summary?: string | null
  version: number
  startedAt: string
  updatedAt: string
  completedAt?: string | null
  events: TaskDetailEvent[]
}
const STATUS_LABEL: Record<WorkflowStatus, string> = {
  QUEUED: '排队中',
  RUNNING: '进行中',
  WAITING_CONFIRMATION: '待确认',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消',
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))

const evidenceEntries = (evidence: unknown): string[] => {
  if (evidence == null) return []
  if (typeof evidence === 'string') return [evidence]
  if (Array.isArray(evidence)) return evidence.flatMap(evidenceEntries)
  if (typeof evidence !== 'object') return [String(evidence)]

  const values = Object.values(evidence)
  if (values.length === 0) return []
  return values.flatMap(evidenceEntries)
}

const stageLabel = (stage: WorkflowStageName) =>
  WORKFLOW_STAGES.find((item) => item.value === stage)?.label || stage

const statusTone = (status: WorkflowStatus) =>
  status === 'COMPLETED'
    ? 'completed'
    : status === 'RUNNING'
      ? 'running'
      : status === 'WAITING_CONFIRMATION'
        ? 'waiting'
        : status === 'FAILED'
          ? 'failed'
          : status === 'CANCELLED'
            ? 'cancelled'
            : 'queued'

const DetailEmpty = ({ children }: { children: ReactNode }) => (
  <span className="task-detail-empty">{children}</span>
)

export const TaskDetail = ({
  task,
  onBack,
  backLabel = '返回运行记录',
}: {
  task: TaskDetailTask
  onBack?: () => void
  backLabel?: string
}) => {
  const orderedEvents = [...task.events].sort(
    (left, right) => left.sequence - right.sequence
  )
  const participants = taskParticipants(task.primaryAgent, orderedEvents)
  const skills = taskSkills(orderedEvents)
  const tokens = summarizeTaskTokens(orderedEvents)
  const evidence = orderedEvents.flatMap((event) =>
    evidenceEntries(event.evidence).map((item) => ({
      eventId: event.id,
      sequence: event.sequence,
      value: item,
    }))
  )

  return (
    <div className="task-detail">
      {onBack && (
        <Button
          className="task-detail-back"
          type="text"
          icon={<ArrowLeft size={16} />}
          onClick={onBack}
        >
          {backLabel}
        </Button>
      )}

      <div className="task-detail-hero">
        <div>
          <span className="task-detail-kicker">TASK DETAIL</span>
          <Typography.Title level={2}>{task.title}</Typography.Title>
          <Typography.Paragraph type="secondary">
            {task.summary || '暂无任务摘要'}
          </Typography.Paragraph>
        </div>
        <div className="task-detail-tags">
          <Tag className={`runtime-status ${statusTone(task.status)}`}>
            {STATUS_LABEL[task.status]}
          </Tag>
          <Tag>{task.platform}</Tag>
          <Tag>{stageLabel(task.currentStage)}</Tag>
          <Tag>v{task.version}</Tag>
        </div>
      </div>

      <div className="task-detail-metrics">
        <Card size="small">
          <span>总 Token</span>
          <strong>{formatTokenValue(tokens.total.value, tokens.total.coverage)}</strong>
          <small>输入与输出合计</small>
        </Card>
        <Card size="small">
          <span>输入 Token</span>
          <strong>{formatTokenValue(tokens.input.value, tokens.input.coverage)}</strong>
          <small>按真实事件聚合</small>
        </Card>
        <Card size="small">
          <span>输出 Token</span>
          <strong>{formatTokenValue(tokens.output.value, tokens.output.coverage)}</strong>
          <small>缺失事件不补零</small>
        </Card>
        <Card size="small">
          <span>缓存 Token</span>
          <strong>{formatTokenValue(tokens.cached.value, tokens.cached.coverage)}</strong>
          <small>单独统计，不计入总量</small>
        </Card>
      </div>

      <div className="task-detail-grid">
        <Card className="task-detail-card" title={<><Users size={16} /> 参与岗位</>}>
          <div className="task-detail-chips">
            {participants.map((agent) => <Tag key={agent}>{agent}</Tag>)}
          </div>
        </Card>
        <Card className="task-detail-card" title={<><Wrench size={16} /> 使用 Skill</>}>
          <div className="task-detail-chips">
            {skills.length ? skills.map((skill) => <Tag key={skill}>{skill}</Tag>) : <DetailEmpty>未记录 Skill</DetailEmpty>}
          </div>
        </Card>
        <Card className="task-detail-card" title={<><FileCheck2 size={16} /> 证据</>}>
          {evidence.length ? (
            <ul className="task-detail-evidence">
              {evidence.map((item) => <li key={`${item.eventId}-${item.value}`}>#{item.sequence} · {item.value}</li>)}
            </ul>
          ) : <DetailEmpty>暂未提交证据</DetailEmpty>}
        </Card>
        <Card className="task-detail-card" title={<><Clock3 size={16} /> 时间</>}>
          <dl className="task-detail-dates">
            <div><dt>开始</dt><dd>{formatDate(task.startedAt)}</dd></div>
            <div><dt>更新</dt><dd>{formatDate(task.updatedAt)}</dd></div>
            <div><dt>完成</dt><dd>{task.completedAt ? formatDate(task.completedAt) : '尚未完成'}</dd></div>
          </dl>
        </Card>
      </div>

      <section className="task-detail-section">
        <div className="task-detail-section-heading">
          <div><span>PROCESS</span><h2>阶段进度</h2></div>
          <p>从需求进入到结果交付的统一状态。</p>
        </div>
        <div className="workflow-stage-board task-detail-stage-board">
          {WORKFLOW_STAGES.map((stage, index) => {
            const described = describeWorkflowStage(task, stage.value, index)
            const StateIcon = described.state === 'done' ? CheckCircle2 : described.state === 'active' ? CircleDashed : Clock3
            const stateText = { done: '已完成', active: '执行中', waiting: '待确认', failed: task.status === 'CANCELLED' ? '已取消' : '异常', next: '未开始' }[described.state]
            return (
              <div className={`workflow-stage-slot ${described.state}`} key={stage.value}>
                {index > 0 && <span className={`workflow-stage-arrow${described.flowing ? ' flowing' : ''}`} aria-hidden="true" />}
                <Card className="workflow-stage-card" size="small">
                  <div className="workflow-stage-heading">
                    <div><span className="workflow-stage-step">STEP {String(index + 1).padStart(2, '0')}</span><Typography.Title level={4}>{stage.label}</Typography.Title></div>
                    <span className="workflow-stage-state"><StateIcon size={13} aria-hidden="true" />{stateText}</span>
                  </div>
                  <div className="workflow-stage-summary"><span className="workflow-stage-agent">{described.agent || '等待分配岗位'}</span><Typography.Paragraph type="secondary">{described.summary}</Typography.Paragraph></div>
                </Card>
              </div>
            )
          })}
        </div>
      </section>

      <section className="task-detail-section">
        <div className="task-detail-section-heading">
          <div><span>ACTIVITY</span><h2>执行日志</h2></div>
          <p>{orderedEvents.length} 条真实任务事件。</p>
        </div>
        {orderedEvents.length ? (
          <div className="task-detail-log">
            {orderedEvents.map((event) => {
              const eventEvidence = evidenceEntries(event.evidence)
              return (
                <article key={event.id}>
                  <span className="task-detail-log-sequence">{event.sequence}</span>
                  <div className="task-detail-log-body">
                    <div className="task-detail-log-heading"><strong>{event.summary}</strong><time>{formatDate(event.createdAt)}</time></div>
                    <div className="task-detail-log-meta"><Tag>{stageLabel(event.stage)}</Tag><Tag>{event.agent}</Tag>{event.status && <Tag>{STATUS_LABEL[event.status]}</Tag>}</div>
                    <div className="task-detail-log-data">
                      <span><Bot size={13} /> 模型：{event.modelId || '未采集'}</span>
                      <span>输入：{event.inputTokens == null ? '未采集' : event.inputTokens.toLocaleString('zh-CN')}</span>
                      <span>输出：{event.outputTokens == null ? '未采集' : event.outputTokens.toLocaleString('zh-CN')}</span>
                      <span>缓存：{event.cachedTokens == null ? '未采集' : event.cachedTokens.toLocaleString('zh-CN')}</span>
                    </div>
                    {event.skills.length > 0 && <div className="task-detail-chips">{event.skills.map((skill) => <Tag key={skill}>{skill}</Tag>)}</div>}
                    {eventEvidence.length > 0 && <div className="task-detail-log-evidence">证据：{eventEvidence.join(' · ')}</div>}
                  </div>
                </article>
              )
            })}
          </div>
        ) : <div className="task-detail-log-empty">该任务还没有事件日志。</div>}
      </section>
    </div>
  )
}
