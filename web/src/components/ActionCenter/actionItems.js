export const STALE_TASK_THRESHOLD_MS = 30 * 60 * 1000

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 }

const minutesSince = (value, now) =>
  Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60000))

const waitLabel = (minutes) => {
  if (minutes < 1) return '刚刚更新'
  if (minutes < 60) return `${minutes} 分钟未更新`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时未更新`
  return `${Math.floor(hours / 24)} 天未更新`
}

export const buildActionCenterModel = ({
  taskRuns = [],
  tasks = [],
  runtimeHealth,
  skills = [],
  queryError,
  now = new Date(),
}) => {
  const items = []
  const taskTypes = {
    AWAITING_APPROVAL: [
      'approval',
      '方案已生成，请审阅后批准执行。',
      '审阅方案',
      'plan',
    ],
    AWAITING_REVIEW: [
      'review',
      '成果已就绪，请检查产物与验证说明后验收。',
      '验收成果',
      'review',
    ],
    FAILED: [
      'failed',
      '最近一次执行失败，请查看原因后决定是否重试。',
      '查看失败原因',
      'runs',
    ],
  }
  for (const task of tasks) {
    const metadata = task.blocker
      ? ['blocked', task.blocker.prompt, '检查执行环境', 'runs']
      : task.confirmation
        ? ['waiting', task.confirmation.prompt, '查看并确认', 'runs']
        : taskTypes[task.status]
    if (!metadata) continue
    const [type, description, actionLabel, section] = metadata
    items.push({
      id: `task-${task.id}`,
      taskId: task.id,
      type,
      priority:
        task.blocker || task.confirmation || task.priority === 'P0'
          ? 'high'
          : task.priority === 'P2'
            ? 'low'
            : 'medium',
      title: task.title,
      agent: task.agentSlug,
      description:
        type === 'failed'
          ? task.runs?.[0]?.summary || task.reviewNote || description
          : description,
      meta: waitLabel(minutesSince(task.updatedAt, now)),
      updatedAt: task.updatedAt,
      action: 'tasks',
      section,
      actionLabel,
      // 行内操作需要的上下文
      planPath: task.planPath || null,
      tool: task.runs?.[0]?.platform || null,
      hasArtifacts: (task.artifacts?.length ?? 0) > 0,
    })
  }

  const actionableTaskIds = new Set(items.map((item) => item.taskId))
  for (const task of taskRuns) {
    if (
      task.taskId &&
      (task.status === 'FAILED' || actionableTaskIds.has(task.taskId))
    )
      continue
    const destination = {
      ...(task.taskId
        ? { action: 'tasks', taskId: task.taskId, section: 'runs' }
        : { action: 'runs' }),
      runId: task.id,
    }
    const ageMinutes = minutesSince(task.updatedAt, now)

    if (task.status === 'WAITING_CONFIRMATION') {
      items.push({
        id: `waiting-${task.id}`,
        type: 'waiting',
        priority: 'high',
        title: task.title,
        agent: task.primaryAgent,
        description: task.summary || '任务正在等待你的确认后继续。',
        meta: waitLabel(ageMinutes),
        updatedAt: task.updatedAt,
        ...destination,
        actionLabel: '查看运行记录',
      })
      continue
    }

    if (task.status === 'FAILED') {
      items.push({
        id: `failed-${task.id}`,
        type: 'failed',
        priority: 'high',
        title: task.title,
        agent: task.primaryAgent,
        description: task.summary || '任务执行失败，请查看运行事件定位原因。',
        meta: waitLabel(ageMinutes),
        updatedAt: task.updatedAt,
        ...destination,
        actionLabel: '查看运行记录',
      })
      continue
    }

    if (
      ['QUEUED', 'RUNNING'].includes(task.status) &&
      ageMinutes * 60000 >= STALE_TASK_THRESHOLD_MS
    ) {
      items.push({
        id: `stale-${task.id}`,
        type: 'stale',
        priority: 'medium',
        title: task.title,
        agent: task.primaryAgent,
        description:
          '活跃任务长时间没有产生新事件：进程退出后 30 秒内会自动收尾；仍在跑可到任务看板取消。',
        meta: waitLabel(ageMinutes),
        updatedAt: task.updatedAt,
        ...destination,
        actionLabel: '查看运行记录',
      })
    }
  }

  const healthComponents = [
    ['database', '数据库'],
    ['realtime', '实时连接'],
  ]
  for (const [key, label] of healthComponents) {
    const component = runtimeHealth?.[key]
    if (component && component.status !== 'UP') {
      items.push({
        id: `health-${key}`,
        type: 'health',
        priority: 'high',
        title: `${label}异常`,
        agent: '系统运行时',
        description: component.message || `${label}当前不可用。`,
        meta: '需要检查',
        action: 'runs',
        actionLabel: '查看运行状态',
      })
    }
  }

  if (queryError) {
    items.push({
      id: 'health-query',
      type: 'health',
      priority: 'high',
      title: '待处理数据同步失败',
      agent: '系统运行时',
      description: queryError.message || '暂时无法获取团队运行状态。',
      meta: '可尝试刷新',
      action: 'refresh',
      actionLabel: '重新同步',
    })
  }

  const updatableSkills = skills.filter((skill) => skill.updatable)
  if (updatableSkills.length > 0) {
    items.push({
      id: 'skill-updates',
      type: 'skills',
      priority: 'low',
      title: `${updatableSkills.length} 个 Skill 可更新`,
      agent: '插件市场',
      description: updatableSkills
        .slice(0, 4)
        .map((skill) => skill.name)
        .join('、'),
      meta:
        updatableSkills.length > 4
          ? `另有 ${updatableSkills.length - 4} 个`
          : '可更新',
      action: 'market',
      actionLabel: '前往插件市场',
    })
  }

  items.sort(
    (left, right) =>
      Number(right.type === 'health') - Number(left.type === 'health') ||
      Number(left.type === 'skills') - Number(right.type === 'skills') ||
      PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
      new Date(left.updatedAt || now).getTime() -
        new Date(right.updatedAt || now).getTime()
  )

  return {
    items,
    taskLimitReached: tasks.length >= 100,
    counts: {
      total: items.length,
      waiting: items.filter((item) =>
        ['waiting', 'approval'].includes(item.type)
      ).length,
      review: items.filter((item) => item.type === 'review').length,
      failed: items.filter((item) => item.type === 'failed').length,
      stale: items.filter((item) => item.type === 'stale').length,
      system: items.filter((item) =>
        ['health', 'tokens', 'skills'].includes(item.type)
      ).length,
    },
  }
}
