import { sceneForAgent } from 'src/illustrations/rafikiScenes'
import { useThemedSceneSrc } from 'src/illustrations/useThemedSceneSrc'

const DEPARTMENT_COLORS = {
  管理中枢: '#6e62d9',
  产品策略: '#b88a45',
  设计体验: '#2e938a',
  工程交付: '#4c78c8',
  增长经营: '#b66555',
  后台支持: '#66727f',
  个人财富: '#8b7435',
  个人成长: '#7a5aaa',
}

export const TASK_STAGE_LABELS = {
  INTAKE: '需求进入',
  PLANNING: '方案规划',
  EXECUTION: '执行实现',
  VERIFICATION: '验证确认',
  DELIVERY: '结果交付',
}

export const formatTaskStage = (stage) => TASK_STAGE_LABELS[stage] || '任务执行'

const roomStatus = (employees, runtimeStateFor) => {
  const counts = { working: 0, waiting: 0, idle: 0, unavailable: 0 }
  for (const employee of employees) {
    const tone = runtimeStateFor(employee).tone
    if (tone === 'working') counts.working += 1
    else if (tone === 'waiting') counts.waiting += 1
    else if (tone === 'idle') counts.idle += 1
    else counts.unavailable += 1
  }
  return counts
}

const AgentDesk = ({ agent, runtimeState, selected, onSelect }) => {
  const task = runtimeState.task
  const scene = sceneForAgent(agent.slug)
  const illustration = useThemedSceneSrc(scene.src)

  return (
    <button
      type="button"
      className={`office-desk ${runtimeState.tone} ${selected ? 'selected' : ''}`}
      style={{ '--agent-color': agent.color }}
      onClick={() => onSelect(agent)}
      aria-label={`${agent.name}，${agent.role}，${runtimeState.label}`}
      title={task?.title || `${agent.name} · ${runtimeState.label}`}
    >
      <div className="desk-heading">
        <div className="desk-person">
          <strong>{agent.name}</strong>
          <span>{agent.en}</span>
        </div>
      </div>

      <div className="desk-scene">
        <img
          className={`desk-illustration${illustration.pending ? ' is-pending' : ''}`}
          src={illustration.src}
          alt=""
          data-scene={scene.id}
        />
        {runtimeState.tone === 'working' && (
          <span className="desk-work-motion" aria-hidden="true" />
        )}
        <span className={`desk-status ${runtimeState.tone}`}>
          <i />
          <b>{runtimeState.label}</b>
        </span>
      </div>

      <div
        className={`desk-task ${task ? 'active' : 'placeholder'}`}
        aria-hidden={!task}
      >
        {task ? (
          <>
            <span>{task.title}</span>
            {task.currentStage && <b>{formatTaskStage(task.currentStage)}</b>}
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
    </button>
  )
}

const AgentOfficeView = ({
  agents,
  groups,
  runtimeStateFor,
  selectedId,
  onSelectAgent,
}) => {
  const departments = groups
    .map((group) => ({
      name: group,
      agents: agents.filter((agent) => agent.group === group),
    }))
    .filter((department) => department.agents.length > 0)

  return (
    <div className="office-floor">
      {departments.map((department) => {
        const counts = roomStatus(department.agents, runtimeStateFor)
        const departmentColor = DEPARTMENT_COLORS[department.name] || '#777773'
        return (
          <section
            className="department-room"
            style={{ '--department-color': departmentColor }}
            key={department.name}
          >
            <header className="department-header">
              <div>
                <span className="department-marker" />
                <h3>{department.name}</h3>
                <span className="department-count">
                  {department.agents.length} 人
                </span>
              </div>
              <div className="department-status" aria-label="部门状态统计">
                {counts.working > 0 && (
                  <span className="working">{counts.working} 工作中</span>
                )}
                {counts.waiting > 0 && (
                  <span className="waiting">{counts.waiting} 待确认</span>
                )}
                <span>{counts.idle} 空闲</span>
                {counts.unavailable > 0 && (
                  <span className="unknown">{counts.unavailable} 未知</span>
                )}
              </div>
            </header>
            <div className="department-desks">
              {department.agents.map((agent) => (
                <AgentDesk
                  key={agent.id}
                  agent={agent}
                  runtimeState={runtimeStateFor(agent)}
                  selected={selectedId === agent.id}
                  onSelect={onSelectAgent}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default AgentOfficeView
