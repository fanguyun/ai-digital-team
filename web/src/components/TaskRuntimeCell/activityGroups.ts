type GroupableTask = {
  id: string
  title: string
  platform: string
  externalReference?: string | null
  primaryAgent: string
  summary?: string | null
  status: string
  updatedAt: string
}

const STATUS_PRIORITY: Record<string, number> = {
  RUNNING: 0,
  WAITING_CONFIRMATION: 1,
  QUEUED: 2,
  FAILED: 3,
  COMPLETED: 4,
  CANCELLED: 5,
}

export const normalizedActivityTitle = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s`*_>#，。！？、,.!?:：；;"“”'‘’()（）\[\]{}]+/g, '')

const taskSource = (task: GroupableTask) => {
  const reference = task.externalReference?.trim()
  const importedTask = reference?.match(/^((?:codex|dsh)-task:[^:]+):[^:]+$/)
  if (importedTask) return importedTask[1]
  if (reference) return reference
  return `${task.summary || ''}:${task.primaryAgent}`.toLocaleLowerCase()
}

const compareTasks = (left: GroupableTask, right: GroupableTask) => {
  const priority =
    (STATUS_PRIORITY[left.status] ?? 99) - (STATUS_PRIORITY[right.status] ?? 99)
  if (priority !== 0) return priority
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )
}

export type ActivityGroup<Task extends GroupableTask> = {
  key: string
  task: Task
  items: Task[]
}

export const groupTaskRuns = <Task extends GroupableTask>(tasks: Task[]) => {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = [
      normalizedActivityTitle(task.title),
      task.platform.toLocaleLowerCase(),
      taskSource(task),
    ].join('::')
    const items = groups.get(key)
    if (items) items.push(task)
    else groups.set(key, [task])
  }

  return [...groups.entries()]
    .map(([key, items]): ActivityGroup<Task> => {
      const ordered = [...items].sort(compareTasks)
      return {
        key,
        task: ordered[0],
        items: [...items].sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
        ),
      }
    })
    .sort(
      (left, right) =>
        new Date(right.task.updatedAt).getTime() -
        new Date(left.task.updatedAt).getTime()
    )
}
