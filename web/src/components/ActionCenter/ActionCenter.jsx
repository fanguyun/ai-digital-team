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

const TYPE_META = {
  waiting: { label: '待确认', icon: ShieldAlert },
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
          <span>全部事项</span>
          <strong>{counts.total}</strong>
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
                  <button
                    type="button"
                    onClick={() =>
                      item.action === 'refresh'
                        ? onRefresh()
                        : onNavigate(item.action)
                    }
                  >
                    {item.actionLabel}
                  </button>
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
