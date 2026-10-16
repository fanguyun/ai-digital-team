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
  runtimeHealth,
  overview,
  skills = [],
  queryError,
  now = new Date(),
}) => {
  const items = []

  for (const task of taskRuns) {
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
        action: 'runs',
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
        action: 'runs',
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
        description: '活跃任务长时间没有产生新事件，建议检查执行状态。',
        meta: waitLabel(ageMinutes),
        action: 'runs',
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

  if (queryError && !runtimeHealth) {
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

  if (
    overview?.totalTaskCount > 0 &&
    overview.totalTokenCoverage !== 'COMPLETE'
  ) {
    items.push({
      id: 'token-coverage',
      type: 'tokens',
      priority: 'low',
      title: 'Token 数据覆盖不完整',
      agent: '数据总览',
      description: `已记录 ${overview.trackedWorkCount || 0} / ${overview.totalTaskCount} 个任务的 Token 数据。`,
      meta: overview.totalTokenCoverage === 'NONE' ? '暂无数据' : '部分覆盖',
      action: 'runs',
      actionLabel: '查看运行记录',
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
      PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority]
  )

  return {
    items,
    counts: {
      total: items.length,
      waiting: items.filter((item) => item.type === 'waiting').length,
      failed: items.filter((item) => item.type === 'failed').length,
      stale: items.filter((item) => item.type === 'stale').length,
      system: items.filter((item) =>
        ['health', 'tokens', 'skills'].includes(item.type)
      ).length,
    },
  }
}
