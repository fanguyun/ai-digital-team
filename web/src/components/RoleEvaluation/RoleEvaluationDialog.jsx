const RoleEvaluationDialog = ({
  open,
  agent,
  tools = [],
  loading = false,
  toolsError = null,
  selectedTool = 'codex',
  submitting = false,
  error = '',
  onSelectTool,
  onSubmit,
  onClose,
}) => {
  if (!open) return null

  const selected = tools.find((tool) => tool.id === selectedTool)
  const canSubmit = !loading && !toolsError && Boolean(selected?.available) && !submitting

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="dispatch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-evaluation-title"
      >
        <header className="modal-header">
          <div>
            <span className="modal-kicker">ROLE EVALUATION</span>
            <h2 id="role-evaluation-title">岗位评估更新</h2>
            <p>
              {agent?.name}
              {agent?.en ? ` · ${agent.en}` : ''}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="modal-body dispatch-body">
          <p className="dispatch-lead">
            将调用「岗位发展与能力评估」对「{agent?.name}」做一次只读评估，报告写入{' '}
            <code>docs/role-evaluations/</code>。不会修改岗位规则、不安装 Skill、不提交代码。
          </p>
          <div className="dispatch-tools">
            <span className="detail-label">执行工具</span>
            {loading ? (
              <div className="dispatch-loading">
                <span className="pulse" /> 正在探测本机工具…
              </div>
            ) : toolsError ? (
              <div className="dispatch-error">
                无法探测执行工具（{toolsError.message || toolsError}）
              </div>
            ) : (
              tools.map((tool) => (
                <label
                  key={tool.id}
                  className={`dispatch-tool ${tool.available ? '' : 'unavailable'}`}
                >
                  <input
                    type="radio"
                    name="role-evaluation-tool"
                    value={tool.id}
                    checked={selectedTool === tool.id}
                    disabled={!tool.available}
                    onChange={() => onSelectTool?.(tool.id)}
                  />
                  <span>
                    <strong>{tool.name}</strong>
                    <em>
                      {tool.available ? tool.version || '已就绪' : tool.reason}
                    </em>
                  </span>
                </label>
              ))
            )}
          </div>
          {selectedTool === 'deepseek-harness' && (
            <p className="dispatch-hint">
              DeepSeek Harness 走 headless 配置，需要启动环境或 <code>.env</code>{' '}
              里存在 API Key。
            </p>
          )}
          {error && <div className="dispatch-error">{error}</div>}
        </div>
        <footer className="dispatch-actions">
          <button className="dispatch-cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="dispatch-submit"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? '正在派发…' : '开始评估'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export const evaluationToolName = (tools, id) =>
  tools.find((tool) => tool.id === id)?.name || id

export default RoleEvaluationDialog
