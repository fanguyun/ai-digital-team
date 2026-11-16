import { useEffect, useMemo, useState } from 'react'

import { Alert, Button, Drawer, Tabs, Tag } from 'antd'
import { Send } from 'lucide-react'

import { useMutation, useQuery } from '@cedarjs/web'

import MarkdownDocument from 'src/components/MarkdownDocument/MarkdownDocument'
import MarkdownEditor from 'src/components/MarkdownEditor/MarkdownEditor'

const EVALUATIONS_QUERY = gql`
  query RoleEvaluations($agentSlug: String) {
    roleEvaluations(agentSlug: $agentSlug) {
      id
      agentSlug
      agentName
      projectKey
      projectRoot
      tool
      status
      sessionId
      reportPath
      logPath
      startedAt
      finishedAt
    }
  }
`

const MESSAGES_QUERY = gql`
  query RoleEvaluationMessages($id: ID!) {
    roleEvaluationMessages(id: $id) {
      role
      content
      createdAt
    }
  }
`

const REPORT_QUERY = gql`
  query RoleEvaluationReport($id: ID!) {
    roleEvaluationReport(id: $id)
  }
`

const SEND_MESSAGE = gql`
  mutation SendRoleEvaluationMessage($id: ID!, $message: String!) {
    sendRoleEvaluationMessage(id: $id, message: $message) {
      id
      status
    }
  }
`

const TOOL_LABELS = {
  codex: 'Codex',
  'deepseek-harness': 'DeepSeek Harness',
}

const STATUS_META = {
  running: { label: '运行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
}

const formatTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', { hour12: false })
}

const formatDuration = (start, end) => {
  if (!start) return '—'
  const from = new Date(start).getTime()
  const to = end ? new Date(end).getTime() : Date.now()
  if (Number.isNaN(from) || Number.isNaN(to)) return '—'
  const seconds = Math.max(0, Math.round((to - from) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分 ${seconds % 60} 秒`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
}

const RoleEvaluationHistory = ({ agentSlug }) => {
  const { data, loading, error } = useQuery(EVALUATIONS_QUERY, {
    variables: { agentSlug },
    fetchPolicy: 'cache-and-network',
    pollInterval: 10_000,
  })

  const [openId, setOpenId] = useState(null)
  const [tab, setTab] = useState('thread')
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')

  const evaluations = useMemo(() => data?.roleEvaluations || [], [data])
  const current = evaluations.find((item) => item.id === openId) || null

  useEffect(() => {
    setOpenId(null)
    setNotice('')
    setDraft('')
  }, [agentSlug])

  return (
    <>
      <div className="eval-history">
        <div className="eval-history-head">
          <span className="detail-label">评估记录</span>
          <span className="eval-history-count">
            {loading && !evaluations.length
              ? '读取中'
              : `${evaluations.length} 条`}
          </span>
        </div>

        {error && !evaluations.length && (
          <p className="eval-history-empty">暂时读不到评估记录。</p>
        )}
        {!error && !loading && !evaluations.length && (
          <p className="eval-history-empty">还没有评估记录。</p>
        )}

        {evaluations.slice(0, 6).map((item) => (
          <button
            type="button"
            key={item.id}
            className={`eval-history-row ${item.status}`}
            onClick={() => {
              setOpenId(item.id)
              setTab('thread')
              setNotice('')
            }}
          >
            <span className={`eval-dot ${item.status}`} aria-hidden="true" />
            <span className="eval-history-time">
              {formatTime(item.startedAt)}
            </span>
            <span className="eval-history-tool">
              {TOOL_LABELS[item.tool] || item.tool}
            </span>
            <span className="eval-history-state">
              {STATUS_META[item.status]?.label || item.status}
            </span>
            <span className="eval-history-open">›</span>
          </button>
        ))}
      </div>

      <Drawer
        open={Boolean(current)}
        onClose={() => setOpenId(null)}
        size="var(--drawer-width)"
        title={current ? `${current.agentName} · 岗位评估` : '岗位评估'}
        destroyOnHidden
      >
        {current && (
          <div className="eval-detail">
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                { key: 'thread', label: '线程' },
                { key: 'report', label: '交付物' },
                { key: 'meta', label: '概览' },
              ]}
            />

            {tab === 'thread' && (
              <ThreadPanel
                evaluation={current}
                draft={draft}
                setDraft={setDraft}
                notice={notice}
                setNotice={setNotice}
              />
            )}

            {tab === 'report' && <ReportPanel evaluation={current} />}

            {tab === 'meta' && <MetaPanel evaluation={current} />}
          </div>
        )}
      </Drawer>
    </>
  )
}

const ThreadPanel = ({ evaluation, draft, setDraft, notice, setNotice }) => {
  const { data, loading, error, refetch } = useQuery(MESSAGES_QUERY, {
    variables: { id: evaluation.id },
    fetchPolicy: 'cache-and-network',
    pollInterval: 5_000,
  })
  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE)
  const messages = data?.roleEvaluationMessages || []

  const submit = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setNotice('')
    try {
      await sendMessage({ variables: { id: evaluation.id, message: text } })
      setDraft('')
      await refetch()
    } catch (sendError) {
      setNotice(sendError.message)
    }
  }

  if (!evaluation.sessionId) {
    return (
      <Alert
        type="info"
        showIcon
        message="这条评估还没有关联到本地会话"
        description="会话 id 会在评估启动后自动补全；若一直没有，说明派发时没能识别到会话文件。"
      />
    )
  }

  return (
    <div className="eval-thread">
      <ResumeHint evaluation={evaluation} />
      {loading && !messages.length && (
        <p className="eval-history-empty">正在读取会话…</p>
      )}
      {error && !messages.length && (
        <Alert type="error" showIcon message="会话读取失败。" />
      )}
      {!loading && !messages.length && (
        <p className="eval-history-empty">会话里还没有消息。</p>
      )}

      <div className="eval-thread-list">
        {messages.map((message, index) => (
          <div
            key={`${message.createdAt}-${index}`}
            className={`eval-bubble ${message.role}`}
          >
            <div className="eval-bubble-meta">
              {message.role === 'user' ? '我' : 'Agent'} ·{' '}
              {formatTime(message.createdAt)}
            </div>
            <div className="eval-bubble-body">{message.content}</div>
          </div>
        ))}
      </div>

      {notice && <Alert type="error" showIcon message={notice} />}

      <div className="eval-composer">
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          minRows={2}
          maxRows={5}
          placeholder="继续和这个本地会话对话，例如：把 P1 项展开成实施方案"
        />
        <Button
          type="primary"
          icon={<Send size={14} />}
          loading={sending}
          disabled={!draft.trim()}
          onClick={submit}
        >
          发送
        </Button>
      </div>
    </div>
  )
}

const ReportPanel = ({ evaluation }) => {
  const { data, loading, error } = useQuery(REPORT_QUERY, {
    variables: { id: evaluation.id },
    fetchPolicy: 'cache-and-network',
  })

  if (loading && !data)
    return <p className="eval-history-empty">正在读取报告…</p>
  if (error) {
    return (
      <Alert
        type="info"
        showIcon
        message="报告还不可读"
        description={error.message}
      />
    )
  }

  return (
    <div className="eval-report">
      <p className="eval-report-path">{evaluation.reportPath}</p>
      <MarkdownDocument content={data?.roleEvaluationReport || ''} />
    </div>
  )
}

const resumeCommand = (evaluation) =>
  evaluation.tool === 'codex'
    ? `codex exec resume ${evaluation.sessionId}`
    : `dsh --profile headless --session-id ${evaluation.sessionId} "继续"`

const ResumeHint = ({ evaluation }) => {
  const [copied, setCopied] = useState(false)
  if (!evaluation.sessionId) return null
  const command = resumeCommand(evaluation)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="eval-resume">
      <code>{command}</code>
      <Button size="small" onClick={copy}>
        {copied ? '已复制' : '复制命令'}
      </Button>
    </div>
  )
}

const MetaPanel = ({ evaluation }) => (
  <dl className="eval-meta">
    <dt>项目</dt>
    <dd>
      {evaluation.projectKey} · {evaluation.projectRoot}
    </dd>
    <dt>工具</dt>
    <dd>{TOOL_LABELS[evaluation.tool] || evaluation.tool}</dd>
    <dt>状态</dt>
    <dd>
      <Tag color={STATUS_META[evaluation.status]?.color}>
        {STATUS_META[evaluation.status]?.label || evaluation.status}
      </Tag>
    </dd>
    <dt>耗时</dt>
    <dd>{formatDuration(evaluation.startedAt, evaluation.finishedAt)}</dd>
    <dt>线程 ID</dt>
    <dd>
      {evaluation.sessionId ? (
        <>
          <code>{evaluation.sessionId}</code>
          <ResumeHint evaluation={evaluation} />
        </>
      ) : (
        '未关联（会话文件尚未识别）'
      )}
    </dd>
    <dt>报告</dt>
    <dd>{evaluation.reportPath}</dd>
    <dt>日志</dt>
    <dd>{evaluation.logPath}</dd>
  </dl>
)

export default RoleEvaluationHistory
