import { useEffect, useRef, useState } from 'react'

import { Alert, Button, Collapse, Flex, Input, Select, Steps, Tag } from 'antd'

import { useMutation } from '@cedarjs/web'

import KnowledgePublisher from 'src/components/KnowledgePublisher/KnowledgePublisher'
import MarkdownDocument from 'src/components/MarkdownDocument/MarkdownDocument'

import { START } from './WorkflowCreator'

const RETRY = gql`
  mutation RetryWorkflowStep(
    $taskId: ID!
    $version: Int!
    $note: String
    $sourceMode: String
    $target: String
  ) {
    retryWorkflowStep(
      taskId: $taskId
      version: $version
      note: $note
      sourceMode: $sourceMode
      target: $target
    ) {
      id
    }
  }
`
const labels = {
  DRAFT: '草稿',
  PENDING: '待执行',
  STARTING: '正在启动',
  QUEUED: '等待岗位空闲',
  RUNNING: '执行中',
  COMPLETED: '已完成',
  WAITING: '等待处理',
  WAITING_CONFIRMATION: '待入库确认',
  NEEDS_INPUT: '待补充信息',
  BLOCKED: '环境阻塞',
  FAILED: '执行失败',
  REVIEW_FAILED: '核验未通过',
  REWORK: '核验退回',
  CANCELLED: '已取消',
  PUBLISHING: '入库核对中',
  PUBLICATION_FAILED: '入库待核对',
}
const roleNames = {
  'main-agent': '数字总经理',
  'research-knowledge-agent': '研究与知识管理',
  'content-brand-agent': '内容与品牌运营',
  user: '人工确认',
  backend: '团队后端',
}
export default function WorkflowPanel({ task, onChanged }) {
  const w = task.workflow
  const [start] = useMutation(START)
  const [retry] = useMutation(RETRY)
  const [tool, setTool] = useState('codex')
  const [note, setNote] = useState('')
  const [sourceMode, setSourceMode] = useState(
    w.input?.sourceMode || 'knowledge-web'
  )
  useEffect(() => {
    setSourceMode(w.input?.sourceMode || 'knowledge-web')
    setTarget(null)
  }, [w.version, w.input?.sourceMode])
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const acting = useRef(false)
  const [error, setError] = useState(null)
  const act = async (action) => {
    if (acting.current) return
    acting.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      setNote('')
      await onChanged()
    } catch (e) {
      setError(e.message)
    } finally {
      acting.current = false
      setBusy(false)
    }
  }
  const draft = w.steps?.[2]
  const report = draft?.attempts?.find(
    (a) => a.number === draft.attemptCount && a.status === 'COMPLETED'
  )
  const canRetry = [
    'FAILED',
    'BLOCKED',
    'NEEDS_INPUT',
    'REVIEW_FAILED',
  ].includes(w.status)
  const canReturn = [
    'WAITING_CONFIRMATION',
    ...['FAILED', 'BLOCKED', 'NEEDS_INPUT', 'REVIEW_FAILED'],
  ].includes(w.status)
  const verified = w.steps?.[3]?.attempts?.find(
    (a) =>
      a.number === w.steps[3].attemptCount &&
      a.status === 'COMPLETED' &&
      a.output?.verdict === 'PASS'
  )
  const canPublish =
    Boolean(report && verified) &&
    [
      'WAITING_CONFIRMATION',
      'PUBLISHING',
      'PUBLICATION_FAILED',
      'COMPLETED',
      'CANCELLED',
    ].includes(w.status)
  const reportArtifacts = task.artifacts.filter(
    (a) => a.id === report?.artifactId
  )
  return (
    <section aria-label="工作流进度" className="task-plan-box">
      <Flex gap={8} wrap>
        <strong>资料研究与知识沉淀</strong>
        <Tag>{labels[w.status] || w.status}</Tag>
        <span>
          模板 v{w.templateVersion} · 自动返工 {w.reworkCount}/1
        </span>
      </Flex>
      <details open={w.status === 'DRAFT'}>
        <summary>研究要求与授权范围</summary>
        <p>研究主题：{w.input?.title || task.title}</p>
        <p>研究问题：{w.input?.questions}</p>
        <p>目标读者：{w.input?.audience}</p>
        <p>范围与时效：{w.input?.scope}</p>
        <p>
          来源：
          {
            {
              'knowledge-web': '思源知识库＋公开网页',
              knowledge: '仅知识库与用户资料',
              web: '仅公开网页与用户资料',
            }[w.input?.sourceMode]
          }
        </p>
        {w.input?.materials && <p>补充资料：{w.input.materials}</p>}
      </details>
      {w.note && (
        <Alert
          type={
            [
              'FAILED',
              'BLOCKED',
              'REVIEW_FAILED',
              'PUBLICATION_FAILED',
            ].includes(w.status)
              ? 'warning'
              : 'info'
          }
          title={w.note}
        />
      )}
      {error && <Alert type="error" title={error} />}
      <Steps
        direction="vertical"
        size="small"
        current={w.currentStep}
        items={(w.steps || []).map((step) => ({
          title: step.name,
          description: `${roleNames[step.agentSlug] || step.agentSlug} · ${labels[step.status] || step.status}`,
          status:
            step.status === 'COMPLETED'
              ? 'finish'
              : ['FAILED', 'REWORK'].includes(step.status)
                ? 'error'
                : step.ordinal === w.currentStep
                  ? 'process'
                  : 'wait',
        }))}
      />
      <Collapse
        items={(w.steps || [])
          .filter((s) => s.attempts.length)
          .map((step) => ({
            key: step.id,
            label: `${step.name} · ${step.attemptCount}次尝试`,
            children: step.attempts.map((a) => (
              <article key={a.id}>
                <p>
                  第{a.number}次 · {labels[a.status] || a.status} ·{' '}
                  {new Date(a.startedAt).toLocaleString()}{' '}
                  {a.finishedAt &&
                    `· 耗时 ${Math.max(0, Math.round((new Date(a.finishedAt) - new Date(a.startedAt)) / 1000))} 秒`}
                </p>
                <p>
                  Token：输入 {a.inputTokens ?? '未采集'} / 输出{' '}
                  {a.outputTokens ?? '未采集'} / 缓存{' '}
                  {a.cachedTokens ?? '未采集'}
                </p>
                {a.sessionId && <p>会话：{a.sessionId}</p>}
                {a.logPath && <p>日志：{a.logPath}</p>}
                {a.contentHash && (
                  <p>
                    产物摘要：<code>{a.contentHash}</code>
                  </p>
                )}
                {a.error && <Alert type="error" title={a.error} />}
                {a.output?.markdown && (
                  <MarkdownDocument content={a.output.markdown} />
                )}
                {a.output?.sources?.map((source) => (
                  <div key={source.id}>
                    <p>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        [{source.id}] {source.title}
                      </a>{' '}
                      · 发布：{source.date} · 访问：{source.accessedAt}
                    </p>
                    <blockquote>{source.excerpt}</blockquote>
                    <p>
                      支持论点：{source.supports}（
                      {{ fact: '事实', opinion: '观点', inference: '推断' }[
                        source.type
                      ] || source.type}
                      ）
                    </p>
                  </div>
                ))}
              </article>
            )),
          }))}
      />
      {w.status === 'DRAFT' && (
        <Flex gap={8}>
          <Select
            aria-label="工作流执行平台"
            value={tool}
            onChange={setTool}
            options={[
              { value: 'codex', label: 'Codex' },
              { value: 'deepseek-harness', label: 'DeepSeek Harness' },
            ]}
          />
          <Button
            type="primary"
            loading={busy}
            onClick={() =>
              act(() =>
                start({
                  variables: { taskId: task.id, version: w.version, tool },
                })
              )
            }
          >
            确认范围并启动工作流
          </Button>
        </Flex>
      )}
      {canReturn && (
        <div>
          <Input.TextArea
            aria-label="工作流补充或返工意见"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="填写补充资料、返工原因或缩小来源范围的理由"
          />
          <Flex gap={8} wrap>
            <Select
              aria-label="研究来源范围"
              value={sourceMode}
              onChange={setSourceMode}
              options={[
                { value: 'knowledge-web', label: '知识库＋公开网页' },
                { value: 'knowledge', label: '仅知识库与用户资料' },
                { value: 'web', label: '仅公开网页与用户资料' },
              ]}
            />
            <Select
              aria-label="退回步骤"
              allowClear
              placeholder="选择退回步骤"
              value={target}
              onChange={setTarget}
              options={[
                {
                  value: 'research',
                  label: '资料收集',
                  disabled: w.currentStep < 1,
                },
                {
                  value: 'draft',
                  label: '报告成稿',
                  disabled: w.currentStep < 2,
                },
              ]}
            />
            <Button
              loading={busy}
              disabled={
                !canRetry && !target && sourceMode === w.input?.sourceMode
              }
              onClick={() =>
                act(() =>
                  retry({
                    variables: {
                      taskId: task.id,
                      version: w.version,
                      note,
                      sourceMode,
                      target,
                    },
                  })
                )
              }
            >
              {sourceMode !== w.input?.sourceMode
                ? '确认调整来源并重新研究'
                : target
                  ? '按意见退回并继续'
                  : '补充后重试当前步骤'}
            </Button>
          </Flex>
        </div>
      )}
      {canPublish && (
        <KnowledgePublisher
          key={report?.artifactId || task.id}
          taskId={task.id}
          artifacts={reportArtifacts}
          workflowArtifactId={report?.artifactId}
          onChanged={onChanged}
          readOnly={['COMPLETED', 'CANCELLED'].includes(w.status)}
        />
      )}
    </section>
  )
}
