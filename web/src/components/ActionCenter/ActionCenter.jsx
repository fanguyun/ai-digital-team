import { useState } from 'react'

import { Input, Modal } from 'antd'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Menu,
  PackageOpen,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import { useMutation } from '@cedarjs/web'

const APPROVE_PLAN = gql`
  mutation ActionCenterApprovePlan(
    $id: ID!
    $tool: String
    $planPath: String!
  ) {
    executeTaskPlan(id: $id, tool: $tool, planPath: $planPath) {
      id
      status
    }
  }
`

const REVIEW_TASK = gql`
  mutation ActionCenterReviewTask($id: ID!, $decision: String!, $note: String) {
    reviewTask(id: $id, decision: $decision, note: $note) {
      id
      status
    }
  }
`

const REFRESH_RUN = gql`
  mutation ActionCenterRefreshRun($runId: ID!) {
    refreshRun(runId: $runId) {
      id
      status
    }
  }
`

const TYPE_META = {
  blocked: { label: '环境阻塞', icon: AlertTriangle },
  waiting: { label: '待确认', icon: ShieldAlert },
  approval: { label: '待批准方案', icon: ShieldAlert },
  review: { label: '待验收', icon: CheckCircle2 },
  failed: { label: '执行失败', icon: AlertTriangle },
  stale: { label: '长时间未更新', icon: Clock3 },
  health: { label: '系统异常', icon: DatabaseZap },
  tokens: { label: '数据提醒', icon: DatabaseZap },
  skills: { label: 'Skill 更新', icon: PackageOpen },
}

function ActionCenter({
  model,
  loading,
  onNavigate,
  onRefresh,
  onOpenSidebar,
}) {
  const { items, counts } = model
  const [approvePlan] = useMutation(APPROVE_PLAN)
  const [reviewTask] = useMutation(REVIEW_TASK)
  const [refreshRun] = useMutation(REFRESH_RUN)
  const [pending, setPending] = useState(null)
  const [notice, setNotice] = useState(null)
  const [reviewDialog, setReviewDialog] = useState({
    open: false,
    item: null,
    decision: 'REJECT',
    note: '',
  })

  const runAction = async (item, action, successText) => {
    setNotice(null)
    setPending(item.id)
    try {
      const result = await action()
      const blocked = Object.values(result?.data || {}).some(
        (value) => value?.status === 'ENVIRONMENT_BLOCKED'
      )
      setNotice({
        tone: blocked ? 'info' : 'success',
        text: blocked
          ? '请求已保存，环境预检未通过，请在任务详情查看阻塞原因。'
          : successText,
      })
      onRefresh?.()
    } catch (error) {
      setNotice({ tone: 'error', text: error.message || '操作失败' })
    } finally {
      setPending(null)
    }
  }

  // 方案批准：直接按最近一次执行的平台重启执行
  const handleApprovePlan = (item) => {
    if (!item.planPath) {
      setNotice({
        tone: 'error',
        text: '这张卡片没有可执行的方案文件，请进任务详情查看。',
      })
      return
    }
    runAction(
      item,
      () =>
        approvePlan({
          variables: {
            id: item.taskId,
            tool: item.tool || 'codex',
            planPath: item.planPath,
          },
        }),
      '已批准方案并开始执行'
    )
  }

  // 验收通过：没有产物时服务端要求写清交付物位置，因此先收集说明
  const handleApproveReview = (item) => {
    if (!item.hasArtifacts) {
      setReviewDialog({
        open: true,
        item,
        decision: 'APPROVE',
        note: '',
      })
      return
    }
    runAction(
      item,
      () =>
        reviewTask({
          variables: { id: item.taskId, decision: 'APPROVE', note: '' },
        }),
      '已通过验收'
    )
  }

  const handleReject = (item) => {
    setReviewDialog({ open: true, item, decision: 'REJECT', note: '' })
  }

  const submitReviewDialog = async () => {
    const { item, decision, note } = reviewDialog
    if (!item) return
    await runAction(
      item,
      () => reviewTask({ variables: { id: item.taskId, decision, note } }),
      decision === 'APPROVE' ? '已通过验收' : '已打回任务'
    )
    setReviewDialog({ open: false, item: null, decision: 'REJECT', note: '' })
  }

  const handleRefreshRun = (item) => {
    if (!item.runId) return
    runAction(
      item,
      () => refreshRun({ variables: { runId: item.runId } }),
      '已按最近一次执行刷新状态'
    )
  }

  const renderInlineActions = (item) => {
    const busy = pending === item.id
    const buttons = []

    if (item.type === 'approval') {
      buttons.push(
        <button
          key="approve-plan"
          type="button"
          className="is-primary"
          disabled={busy}
          onClick={() => handleApprovePlan(item)}
        >
          {busy ? '执行中…' : '批准并执行'}
        </button>
      )
    }

    if (item.type === 'review') {
      buttons.push(
        <button
          key="approve"
          type="button"
          className="is-primary"
          disabled={busy}
          onClick={() => handleApproveReview(item)}
        >
          {busy ? '处理中…' : '通过'}
        </button>,
        <button
          key="reject"
          type="button"
          disabled={busy}
          onClick={() => handleReject(item)}
        >
          打回
        </button>
      )
    }

    if (item.type === 'stale' && item.runId) {
      buttons.push(
        <button
          key="refresh"
          type="button"
          disabled={busy}
          onClick={() => handleRefreshRun(item)}
        >
          {busy ? '刷新中…' : '刷新状态'}
        </button>
      )
    }

    return buttons
  }

  return (
    <div className="action-center-page">
      <header className="runtime-header action-center-header">
        <button
          className="mobile-menu"
          onClick={onOpenSidebar}
          aria-label="打开导航"
        >
          <Menu size={20} />
        </button>
        <div className="page-intro">
          <span className="section-kicker">ACTION CENTER</span>
          <h1>待处理中心</h1>
          <p>集中查看需要确认、排障或补充维护的事项。</p>
        </div>
        <button
          type="button"
          className="runtime-refresh"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'is-spinning' : ''} />
          刷新
        </button>
      </header>

      <section className="action-summary" aria-label="待处理统计">
        <div>
          <span>已显示事项</span>
          <strong>{counts.total}</strong>
        </div>
        <div className="danger">
          <span>待验收</span>
          <strong>{counts.review}</strong>
        </div>
        <div className="danger">
          <span>待确认</span>
          <strong>{counts.waiting}</strong>
        </div>
        <div className="danger">
          <span>失败任务</span>
          <strong>{counts.failed}</strong>
        </div>
        <div className="warning">
          <span>长时间未更新</span>
          <strong>{counts.stale}</strong>
        </div>
        <div>
          <span>系统与维护</span>
          <strong>{counts.system}</strong>
        </div>
      </section>

      {notice && (
        <p
          className={`action-notice ${notice.tone === 'error' ? 'error' : ''}`}
          role="status"
        >
          {notice.text}
        </p>
      )}

      <Modal
        open={reviewDialog.open}
        title={
          reviewDialog.decision === 'APPROVE'
            ? `通过验收 · ${reviewDialog.item?.title || ''}`
            : `打回任务 · ${reviewDialog.item?.title || ''}`
        }
        okText={reviewDialog.decision === 'APPROVE' ? '确认通过' : '确认打回'}
        cancelText="取消"
        okButtonProps={{
          disabled:
            Boolean(pending) ||
            // 打回必须写原因；通过但在没有产物时也要写明交付物位置
            ((reviewDialog.decision === 'REJECT' ||
              !reviewDialog.item?.hasArtifacts) &&
              !reviewDialog.note.trim()),
        }}
        onOk={submitReviewDialog}
        onCancel={() =>
          setReviewDialog({
            open: false,
            item: null,
            decision: 'REJECT',
            note: '',
          })
        }
        destroyOnHidden
      >
        <p className="action-dialog-hint">
          {reviewDialog.decision === 'APPROVE'
            ? '这次执行没有登记任何产物，请写明交付物在哪里（例如 git 改动或具体文件）。'
            : '打回需要说明原因，任务会回到待派发。'}
        </p>
        <Input.TextArea
          value={reviewDialog.note}
          onChange={(event) =>
            setReviewDialog((state) => ({ ...state, note: event.target.value }))
          }
          rows={3}
          placeholder={
            reviewDialog.decision === 'APPROVE' ? '交付物位置说明' : '打回原因'
          }
        />
      </Modal>

      {model.taskLimitReached && (
        <p role="status">
          仅显示最近 100 条待处理任务，其余任务请到任务看板查看。
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="action-center-state">
          <RefreshCw size={20} className="is-spinning" />
          <strong>正在汇总待处理事项</strong>
          <span>正在检查任务、运行时、数据覆盖和 Skill 更新。</span>
        </div>
      ) : items.length === 0 ? (
        <div className="action-center-state success">
          <CheckCircle2 size={24} />
          <strong>目前没有待处理事项</strong>
          <span>团队运行正常，新的异常或确认请求会集中显示在这里。</span>
        </div>
      ) : (
        <section className="action-list" aria-label="待处理事项">
          {items.map((item) => {
            const meta = TYPE_META[item.type]
            const Icon = meta.icon
            return (
              <article
                className={`action-card priority-${item.priority}`}
                key={item.id}
              >
                <div className={`action-icon type-${item.type}`}>
                  <Icon size={18} />
                </div>
                <div className="action-card-body">
                  <div className="action-card-heading">
                    <span className={`action-type type-${item.type}`}>
                      {meta.label}
                    </span>
                    <span className="action-agent">{item.agent}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
                <div className="action-card-side">
                  <span>{item.meta}</span>
                  <div className="action-card-buttons">
                    {renderInlineActions(item)}
                    <button
                      type="button"
                      onClick={() =>
                        item.action === 'refresh'
                          ? onRefresh()
                          : onNavigate(
                              item.action,
                              item.taskId
                                ? { taskId: item.taskId, section: item.section }
                                : null
                            )
                      }
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

export default ActionCenter
