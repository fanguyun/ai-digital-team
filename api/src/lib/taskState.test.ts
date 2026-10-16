import {
  normalizeCreateTaskRunInput,
  normalizeTaskEventInput,
} from './taskState'

describe('task runtime state machine', () => {
  const runningTask = {
    status: 'RUNNING' as const,
    currentStage: 'EXECUTION' as const,
  }

  it.each([
    ['QUEUED', 'RUNNING'],
    ['QUEUED', 'CANCELLED'],
    ['RUNNING', 'WAITING_CONFIRMATION'],
    ['RUNNING', 'COMPLETED'],
    ['WAITING_CONFIRMATION', 'RUNNING'],
    ['WAITING_CONFIRMATION', 'FAILED'],
  ] as const)('allows %s to transition to %s', (currentStatus, status) => {
    expect(
      normalizeTaskEventInput(
        { status: currentStatus, currentStage: 'EXECUTION' },
        {
          eventType: 'status.changed',
          status,
          stage: status === 'COMPLETED' ? 'DELIVERY' : 'EXECUTION',
          agent: 'software-engineer-agent',
          summary: '状态已更新',
          idempotencyKey: `${currentStatus}-${status}`,
        }
      ).status
    ).toBe(status)
  })

  it('rejects an illegal status transition', () => {
    expect(() =>
      normalizeTaskEventInput(
        { status: 'QUEUED', currentStage: 'INTAKE' },
        {
          eventType: 'status.changed',
          status: 'COMPLETED',
          stage: 'DELIVERY',
          agent: 'main-agent',
          summary: '不能跳过执行直接完成',
          idempotencyKey: 'illegal-transition',
        }
      )
    ).toThrow('Invalid task status transition')
  })

  it.each(['COMPLETED', 'FAILED', 'CANCELLED'] as const)(
    'protects terminal status %s from later events',
    (status) => {
      expect(() =>
        normalizeTaskEventInput(
          { status, currentStage: 'DELIVERY' },
          {
            eventType: 'late.event',
            stage: 'DELIVERY',
            agent: 'software-engineer-agent',
            summary: '终态后不允许追加事件',
            idempotencyKey: `terminal-${status}`,
          }
        )
      ).toThrow('Task is already in a terminal status')
    }
  )

  it('allows the stage to stay unchanged or move forward', () => {
    expect(
      normalizeTaskEventInput(runningTask, {
        eventType: 'verification.started',
        stage: 'VERIFICATION',
        agent: 'qa-security-engineer-agent',
        summary: '开始验证',
        idempotencyKey: 'stage-forward',
      }).stage
    ).toBe('VERIFICATION')
  })

  it('rejects stage regression', () => {
    expect(() =>
      normalizeTaskEventInput(runningTask, {
        eventType: 'planning.reopened',
        stage: 'PLANNING',
        agent: 'product-solution-agent',
        summary: '不允许回退阶段',
        idempotencyKey: 'stage-regression',
      })
    ).toThrow('Task stage cannot move backwards')
  })

  it('normalizes create input and trims user text', () => {
    expect(
      normalizeCreateTaskRunInput({
        title: '  CedarJS 迁移  ',
        platform: ' codex ',
        primaryAgent: ' software-engineer-agent ',
        summary: ' 迁移开始 ',
        status: 'RUNNING',
        stage: 'PLANNING',
        idempotencyKey: ' create-1 ',
      })
    ).toMatchObject({
      title: 'CedarJS 迁移',
      platform: 'codex',
      primaryAgent: 'software-engineer-agent',
      summary: '迁移开始',
      status: 'RUNNING',
      stage: 'PLANNING',
      idempotencyKey: 'create-1',
    })
  })

  it('normalizes token usage and model metadata', () => {
    expect(
      normalizeTaskEventInput(runningTask, {
        eventType: 'usage.recorded',
        stage: 'EXECUTION',
        agent: 'software-engineer-agent',
        summary: '记录模型用量',
        inputTokens: 1200,
        outputTokens: 340,
        cachedTokens: 800,
        modelId: ' gpt-6.1-sol ',
        idempotencyKey: 'usage-recorded',
      })
    ).toMatchObject({
      inputTokens: 1200,
      outputTokens: 340,
      cachedTokens: 800,
      modelId: 'gpt-6.1-sol',
    })
  })

  it('rejects invalid token counts', () => {
    expect(() =>
      normalizeTaskEventInput(runningTask, {
        eventType: 'usage.recorded',
        stage: 'EXECUTION',
        agent: 'software-engineer-agent',
        summary: '非法 Token',
        inputTokens: -1,
        idempotencyKey: 'usage-invalid',
      })
    ).toThrow('inputTokens must be a non-negative 32-bit integer')
  })

  it('rejects empty and oversized summaries', () => {
    expect(() =>
      normalizeTaskEventInput(runningTask, {
        eventType: 'progress',
        stage: 'EXECUTION',
        agent: 'software-engineer-agent',
        summary: ' ',
        idempotencyKey: 'empty-summary',
      })
    ).toThrow('summary is required')

    expect(() =>
      normalizeTaskEventInput(runningTask, {
        eventType: 'progress',
        stage: 'EXECUTION',
        agent: 'software-engineer-agent',
        summary: 'x'.repeat(1001),
        idempotencyKey: 'long-summary',
      })
    ).toThrow('summary must be at most 1000 characters')
  })

  it('requires a bounded idempotency key', () => {
    expect(() =>
      normalizeTaskEventInput(runningTask, {
        eventType: 'progress',
        stage: 'EXECUTION',
        agent: 'software-engineer-agent',
        summary: '有效摘要',
        idempotencyKey: ' ',
      })
    ).toThrow('idempotencyKey is required')

    expect(() =>
      normalizeTaskEventInput(runningTask, {
        eventType: 'progress',
        stage: 'EXECUTION',
        agent: 'software-engineer-agent',
        summary: '有效摘要',
        idempotencyKey: 'x'.repeat(201),
      })
    ).toThrow('idempotencyKey must be at most 200 characters')
  })
})
