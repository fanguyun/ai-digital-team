export const TASK_RUN_STATUSES = [
  'QUEUED',
  'RUNNING',
  'WAITING_CONFIRMATION',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const

export const TASK_RUN_STAGES = [
  'INTAKE',
  'PLANNING',
  'EXECUTION',
  'VERIFICATION',
  'DELIVERY',
] as const

export type TaskRunStatusValue = (typeof TASK_RUN_STATUSES)[number]
export type TaskRunStageValue = (typeof TASK_RUN_STAGES)[number]

export class TaskRuntimeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskRuntimeValidationError'
  }
}

type CurrentTaskState = {
  status: TaskRunStatusValue
  currentStage: TaskRunStageValue
}

type CreateTaskRunInputValue = {
  title: string
  platform: string
  externalReference?: string | null
  primaryAgent: string
  summary?: string | null
  skills?: string[] | null
  evidence?: Record<string, unknown> | null
  inputTokens?: number | null
  outputTokens?: number | null
  cachedTokens?: number | null
  modelId?: string | null
  status?: TaskRunStatusValue | null
  stage?: TaskRunStageValue | null
  idempotencyKey: string
}

type TaskEventInputValue = {
  eventType: string
  status?: TaskRunStatusValue | null
  stage: TaskRunStageValue
  agent: string
  skills?: string[] | null
  summary: string
  evidence?: Record<string, unknown> | null
  inputTokens?: number | null
  outputTokens?: number | null
  cachedTokens?: number | null
  modelId?: string | null
  idempotencyKey: string
}

const TERMINAL_STATUSES = new Set<TaskRunStatusValue>([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
])

const ALLOWED_STATUS_TRANSITIONS: Record<
  Exclude<TaskRunStatusValue, 'COMPLETED' | 'FAILED' | 'CANCELLED'>,
  ReadonlySet<TaskRunStatusValue>
> = {
  QUEUED: new Set(['QUEUED', 'RUNNING', 'FAILED', 'CANCELLED']),
  RUNNING: new Set([
    'RUNNING',
    'WAITING_CONFIRMATION',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ]),
  WAITING_CONFIRMATION: new Set([
    'WAITING_CONFIRMATION',
    'RUNNING',
    'FAILED',
    'CANCELLED',
  ]),
}

const STAGE_INDEX = new Map(
  TASK_RUN_STAGES.map((stage, index) => [stage, index])
)

const requiredText = (value: string, field: string, maxLength: number) => {
  const normalized = value?.trim()

  if (!normalized) {
    throw new TaskRuntimeValidationError(`${field} is required`)
  }

  if (normalized.length > maxLength) {
    throw new TaskRuntimeValidationError(
      `${field} must be at most ${maxLength} characters`
    )
  }

  return normalized
}

const optionalText = (
  value: string | null | undefined,
  field: string,
  maxLength: number
) => {
  if (value == null) return undefined

  const normalized = value.trim()
  if (!normalized) return undefined

  if (normalized.length > maxLength) {
    throw new TaskRuntimeValidationError(
      `${field} must be at most ${maxLength} characters`
    )
  }

  return normalized
}

const normalizeSkills = (skills: string[] | null | undefined) => {
  if (!skills) return []
  if (skills.length > 64) {
    throw new TaskRuntimeValidationError('skills must contain at most 64 items')
  }

  return [...new Set(skills.map((skill) => requiredText(skill, 'skill', 120)))]
}

const optionalTokenCount = (
  value: number | null | undefined,
  field: string
) => {
  if (value == null) return undefined
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new TaskRuntimeValidationError(
      `${field} must be a non-negative 32-bit integer`
    )
  }
  return value
}

export const isTerminalStatus = (status: TaskRunStatusValue) =>
  TERMINAL_STATUSES.has(status)

export const normalizeCreateTaskRunInput = (input: CreateTaskRunInputValue) => {
  const status = input.status ?? 'QUEUED'
  if (isTerminalStatus(status) || status === 'WAITING_CONFIRMATION') {
    throw new TaskRuntimeValidationError(
      'A task can only be created as QUEUED or RUNNING'
    )
  }

  return {
    title: requiredText(input.title, 'title', 200),
    platform: requiredText(input.platform, 'platform', 80),
    externalReference: optionalText(
      input.externalReference,
      'externalReference',
      300
    ),
    primaryAgent: requiredText(input.primaryAgent, 'primaryAgent', 160),
    summary: optionalText(input.summary, 'summary', 1000),
    skills: normalizeSkills(input.skills),
    evidence: input.evidence ?? undefined,
    inputTokens: optionalTokenCount(input.inputTokens, 'inputTokens'),
    outputTokens: optionalTokenCount(input.outputTokens, 'outputTokens'),
    cachedTokens: optionalTokenCount(input.cachedTokens, 'cachedTokens'),
    modelId: optionalText(input.modelId, 'modelId', 160),
    status,
    stage: input.stage ?? 'INTAKE',
    idempotencyKey: requiredText(input.idempotencyKey, 'idempotencyKey', 200),
  }
}

export const normalizeTaskEventInput = (
  current: CurrentTaskState,
  input: TaskEventInputValue
) => {
  if (isTerminalStatus(current.status)) {
    throw new TaskRuntimeValidationError('Task is already in a terminal status')
  }

  const status = input.status ?? current.status
  const allowedStatuses = ALLOWED_STATUS_TRANSITIONS[current.status]
  if (!allowedStatuses.has(status)) {
    throw new TaskRuntimeValidationError(
      `Invalid task status transition: ${current.status} -> ${status}`
    )
  }

  const currentStageIndex = STAGE_INDEX.get(current.currentStage)
  const nextStageIndex = STAGE_INDEX.get(input.stage)
  if (
    currentStageIndex === undefined ||
    nextStageIndex === undefined ||
    nextStageIndex < currentStageIndex
  ) {
    throw new TaskRuntimeValidationError('Task stage cannot move backwards')
  }

  return {
    eventType: requiredText(input.eventType, 'eventType', 80),
    status,
    eventStatus: input.status ?? undefined,
    stage: input.stage,
    agent: requiredText(input.agent, 'agent', 160),
    skills: normalizeSkills(input.skills),
    summary: requiredText(input.summary, 'summary', 1000),
    evidence: input.evidence ?? undefined,
    inputTokens: optionalTokenCount(input.inputTokens, 'inputTokens'),
    outputTokens: optionalTokenCount(input.outputTokens, 'outputTokens'),
    cachedTokens: optionalTokenCount(input.cachedTokens, 'cachedTokens'),
    modelId: optionalText(input.modelId, 'modelId', 160),
    idempotencyKey: requiredText(input.idempotencyKey, 'idempotencyKey', 200),
  }
}
