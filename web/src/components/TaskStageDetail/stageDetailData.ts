import type {
  WorkflowStageName,
  WorkflowStatus,
} from 'src/components/TaskRuntimeDashboard/workflowFlow'

export type StageDetailEvent = {
  id: string
  sequence: number
  eventType?: string
  status?: WorkflowStatus | null
  stage: WorkflowStageName
  agent: string
  skills?: string[]
  summary: string
  evidence?: unknown
  inputTokens?: number | null
  outputTokens?: number | null
  cachedTokens?: number | null
  modelId?: string | null
  createdAt: string
}

export type StageDetailRun = {
  id: string
  title: string
  primaryAgent: string
  status: WorkflowStatus
  currentStage: WorkflowStageName
  startedAt: string
  updatedAt: string
  completedAt?: string | null
  events: StageDetailEvent[]
}

export type StageTaskArtifact = {
  id: string
  kind: string
  path: string
  label: string
}

export type StageTask = {
  id: string
  title: string
  brief: string
  acceptance: string
  planPath?: string | null
  planNote?: string | null
  reviewNote?: string | null
  reviewedAt?: string | null
  completedAt?: string | null
  artifacts: StageTaskArtifact[]
}

export type StageTraceMessage = {
  role: string
  content: string
  createdAt: string
  step?: number | null
}

export type StageTraceTool = {
  name: string
  detail: string
  result: string
  resultTruncated: boolean
  redacted: boolean
  createdAt: string
  step?: number | null
}

export type StageTrace = {
  turn?: number | null
  source: string
  truncated: boolean
  messages: StageTraceMessage[]
  tools: StageTraceTool[]
}

export type StageSection =
  | {
      key: string
      title: string
      source: string
      kind: 'keyvals'
      items: Array<{ label: string; value: string }>
    }
  | {
      key: string
      title: string
      source: string
      kind: 'markdown'
      body: string
    }
  | { key: string; title: string; source: string; kind: 'text'; body: string }
  | {
      key: string
      title: string
      source: string
      kind: 'messages'
      messages: StageTraceMessage[]
      truncated: boolean
    }
  | {
      key: string
      title: string
      source: string
      kind: 'tools'
      tools: StageTraceTool[]
      truncated: boolean
    }
  | {
      key: string
      title: string
      source: string
      kind: 'list'
      items: string[]
    }
  | {
      key: string
      title: string
      source: string
      kind: 'artifacts'
      items: StageTaskArtifact[]
    }
  | { key: string; title: string; source: string; kind: 'empty'; body: string }

export type PlanSource = {
  content?: string | null
  error?: string | null
}

export type BuildStageSectionsInput = {
  stage: WorkflowStageName
  run: StageDetailRun
  task?: StageTask | null
  trace?: StageTrace | null
  plan?: PlanSource | null
}

/** 把任意 evidence 结构摊平成可读字符串（旧的字符串/数组/对象形态都要兼容） */
export const evidenceEntries = (evidence: unknown): string[] => {
  if (evidence == null) return []
  if (typeof evidence === 'string') return [evidence]
  if (Array.isArray(evidence)) return evidence.flatMap(evidenceEntries)
  if (typeof evidence !== 'object') return [String(evidence)]

  const values = Object.values(evidence)
  if (values.length === 0) return []
  return values.flatMap(evidenceEntries)
}

export const stageEvents = (run: StageDetailRun, stage: WorkflowStageName) =>
  [...run.events]
    .filter((event) => event.stage === stage)
    .sort((left, right) => left.sequence - right.sequence)

export const stageWindow = (run: StageDetailRun, stage: WorkflowStageName) => {
  const events = stageEvents(run, stage)
  const start = events[0]?.createdAt ?? run.startedAt
  const end =
    events.at(-1)?.createdAt ??
    (run.completedAt || (run.status === 'RUNNING' ? null : run.updatedAt))
  return { start, end }
}

export const firstUserMessage = (trace?: StageTrace | null) =>
  trace?.messages.find(
    (message) => message.role === 'user' && message.content.trim()
  ) ?? null

export const finalAssistantMessage = (trace?: StageTrace | null) => {
  const messages = trace?.messages ?? []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'assistant' && message.content.trim()) return message
  }
  return null
}

const summarizeEvidence = (events: StageDetailEvent[]) =>
  events.flatMap((event) =>
    evidenceEntries(event.evidence).map(
      (value) => `#${event.sequence} · ${value}`
    )
  )

const reportArtifacts = (task?: StageTask | null) =>
  (task?.artifacts ?? []).filter((artifact) => artifact.kind === 'report')

/**
 * 阶段详情的内容装配：每个阶段只呈现「这个阶段最该看的东西」。
 * 纯函数：输入都是已取到的数据，输出给抽屉渲染，方便单测。
 */
export const buildStageSections = ({
  stage,
  run,
  task,
  trace,
  plan,
}: BuildStageSectionsInput): StageSection[] => {
  const events = stageEvents(run, stage)

  if (stage === 'INTAKE') {
    if (task) {
      return [
        {
          key: 'intake-brief',
          title: '需求详情',
          source: '任务记录',
          kind: 'keyvals',
          items: [
            { label: '任务标题', value: task.title },
            { label: '需求', value: task.brief || '未填写' },
            { label: '验收标准', value: task.acceptance || '未填写' },
          ],
        },
      ]
    }

    const message = firstUserMessage(trace)
    if (message) {
      return [
        {
          key: 'intake-message',
          title: '需求详情',
          source: '会话记录',
          kind: 'markdown',
          body: message.content,
        },
      ]
    }

    return [
      {
        key: 'intake-empty',
        title: '需求详情',
        source: '未记录',
        kind: 'empty',
        body:
          trace?.source === 'none'
            ? '这条运行没有关联任务，也读不到会话记录，需求原文不可用。'
            : '这一轮的会话记录里没有可读的需求原文。',
      },
    ]
  }

  if (stage === 'PLANNING') {
    const sections: StageSection[] = []

    if (task?.planPath) {
      if (plan?.content) {
        sections.push({
          key: 'plan-file',
          title: `方案文件 · ${task.planPath}`,
          source: '本地文件',
          kind: 'markdown',
          body: plan.content,
        })
      } else if (plan?.error) {
        sections.push({
          key: 'plan-error',
          title: '方案文件',
          source: '本地文件',
          kind: 'empty',
          body: `${task.planPath}：${plan.error}`,
        })
      }
    }

    if (task?.planNote) {
      sections.push({
        key: 'plan-note',
        title: '最新修正意见',
        source: '任务记录',
        kind: 'text',
        body: task.planNote,
      })
    }

    if (!sections.length) {
      if (events.length) {
        sections.push({
          key: 'plan-events',
          title: '方案阶段记录',
          source: '任务记录',
          kind: 'list',
          items: events.map((event) => `#${event.sequence} · ${event.summary}`),
        })
      } else {
        sections.push({
          key: 'plan-empty',
          title: '方案详情',
          source: '未记录',
          kind: 'empty',
          body: '这一轮没有独立的方案产物；需求见「需求进入」，执行过程见「执行实现」。',
        })
      }
    }

    return sections
  }

  if (stage === 'EXECUTION') {
    const sections: StageSection[] = []

    if (trace?.messages.length) {
      sections.push({
        key: 'execution-messages',
        title: '会话记录',
        source: '会话记录',
        kind: 'messages',
        messages: trace.messages,
        truncated: trace.truncated,
      })
    }

    if (trace?.tools.length) {
      sections.push({
        key: 'execution-tools',
        title: '工具调用',
        source: '会话记录',
        kind: 'tools',
        tools: trace.tools,
        truncated: trace.truncated,
      })
    }

    if (!sections.length) {
      sections.push({
        key: 'execution-empty',
        title: '执行过程',
        source: '未记录',
        kind: 'empty',
        body:
          trace?.source === 'none'
            ? '这次运行没有关联可读的会话记录（可能是命令行直接上报的运行）。'
            : '这一轮的会话记录里没有可读的执行内容。',
      })
    }

    return sections
  }

  if (stage === 'VERIFICATION') {
    const sections: StageSection[] = []
    const evidence = summarizeEvidence(events)

    if (evidence.length) {
      sections.push({
        key: 'verification-evidence',
        title: '验证证据',
        source: '任务记录',
        kind: 'list',
        items: evidence,
      })
    }

    if (task?.reviewNote) {
      sections.push({
        key: 'verification-review',
        title: '复核结论',
        source: '任务记录',
        kind: 'text',
        body: task.reviewNote,
      })
    }

    const reports = reportArtifacts(task)
    if (reports.length) {
      sections.push({
        key: 'verification-reports',
        title: '报告类产物',
        source: '任务记录',
        kind: 'artifacts',
        items: reports,
      })
    }

    if (!sections.length) {
      sections.push({
        key: 'verification-empty',
        title: '验证确认',
        source: '未记录',
        kind: 'empty',
        body: '这次执行没有回写验证证据；执行细节见「执行实现」。',
      })
    }

    return sections
  }

  const sections: StageSection[] = []
  const artifacts = task?.artifacts ?? []

  if (artifacts.length) {
    sections.push({
      key: 'delivery-artifacts',
      title: '交付产物',
      source: '任务记录',
      kind: 'artifacts',
      items: artifacts,
    })
  }

  const closing = finalAssistantMessage(trace)
  if (closing) {
    sections.push({
      key: 'delivery-summary',
      title: '收尾说明',
      source: '会话记录',
      kind: 'markdown',
      body: closing.content,
    })
  }

  if (!sections.length) {
    sections.push({
      key: 'delivery-empty',
      title: '结果交付',
      source: '未记录',
      kind: 'empty',
      body: task
        ? '这条任务还没有登记产物，交付内容可在「执行实现」查看。'
        : '会话同步的运行没有产物清单，交付内容以「执行实现」的收尾消息为准。',
    })
  }

  return sections
}

/** 阶段详情头部要用的统计：Token 只统计该阶段事件，缺失标未采集 */
export const stageMetrics = (run: StageDetailRun, stage: WorkflowStageName) => {
  const events = stageEvents(run, stage)
  const { start, end } = stageWindow(run, stage)

  return {
    events,
    start,
    end,
    agents: [...new Set(events.map((event) => event.agent).filter(Boolean))],
    models: [
      ...new Set(
        events
          .map((event) => event.modelId)
          .filter((value): value is string => Boolean(value))
      ),
    ],
    inputTokens: events.some((event) => event.inputTokens != null)
      ? events.reduce((total, event) => total + (event.inputTokens ?? 0), 0)
      : null,
    outputTokens: events.some((event) => event.outputTokens != null)
      ? events.reduce((total, event) => total + (event.outputTokens ?? 0), 0)
      : null,
    cachedTokens: events.some((event) => event.cachedTokens != null)
      ? events.reduce((total, event) => total + (event.cachedTokens ?? 0), 0)
      : null,
  }
}
