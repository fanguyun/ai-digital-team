import {
  buildStageSections,
  evidenceEntries,
  finalAssistantMessage,
  firstUserMessage,
  stageEvents,
  stageMetrics,
  stageWindow,
  type StageDetailRun,
  type StageTask,
  type StageTrace,
} from './stageDetailData'

const run = (overrides: Partial<StageDetailRun> = {}): StageDetailRun => ({
  id: 'run-1',
  title: '运行记录阶段详情',
  primaryAgent: 'software-engineer-agent',
  status: 'COMPLETED',
  currentStage: 'DELIVERY',
  startedAt: '2026-11-18T02:00:00.000Z',
  updatedAt: '2026-11-18T02:30:00.000Z',
  completedAt: '2026-11-18T02:30:00.000Z',
  events: [
    {
      id: 'e1',
      sequence: 1,
      stage: 'EXECUTION',
      agent: 'software-engineer-agent',
      summary: '派发到 codex',
      createdAt: '2026-11-18T02:01:00.000Z',
      inputTokens: 100,
      outputTokens: 20,
      modelId: 'gpt-5',
    },
    {
      id: 'e2',
      sequence: 2,
      stage: 'EXECUTION',
      agent: 'qa-security-engineer-agent',
      summary: '补充验证',
      createdAt: '2026-11-18T02:10:00.000Z',
      inputTokens: 50,
      outputTokens: null,
    },
    {
      id: 'e3',
      sequence: 3,
      stage: 'VERIFICATION',
      agent: 'qa-security-engineer-agent',
      summary: '验证通过',
      evidence: { path: 'reports/qa.json', command: 'yarn test' },
      createdAt: '2026-11-18T02:20:00.000Z',
    },
    {
      id: 'e4',
      sequence: 4,
      stage: 'DELIVERY',
      agent: 'software-engineer-agent',
      summary: '交付完成',
      createdAt: '2026-11-18T02:29:00.000Z',
    },
  ],
  ...overrides,
})

const task = (overrides: Partial<StageTask> = {}): StageTask => ({
  id: 'task-1',
  title: '阶段详情',
  brief: '点击阶段查看需求、方案、执行与交付。',
  acceptance: '五个阶段都能打开且有空态',
  planPath: 'docs/plans/task-1.md',
  planNote: '范围缩小到运行记录页',
  reviewNote: '验证通过',
  artifacts: [
    { id: 'a1', kind: 'report', path: 'docs/reports/qa.md', label: 'qa.md' },
    { id: 'a2', kind: 'file', path: 'web/src/index.css', label: 'index.css' },
  ],
  ...overrides,
})

const trace = (overrides: Partial<StageTrace> = {}): StageTrace => ({
  turn: 2,
  source: 'dsh',
  truncated: false,
  messages: [
    {
      role: 'user',
      content: '把运行记录做成可点的阶段详情',
      createdAt: '2026-11-18T02:01:00.000Z',
    },
    {
      role: 'assistant',
      content: '已经补上阶段抽屉，并从会话里读取执行过程。',
      createdAt: '2026-11-18T02:29:00.000Z',
    },
  ],
  tools: [
    {
      name: 'bash',
      detail: 'yarn test:web',
      result: 'PASS',
      resultTruncated: false,
      redacted: false,
      createdAt: '2026-11-18T02:20:00.000Z',
    },
  ],
  ...overrides,
})

const kinds = (sections: ReturnType<typeof buildStageSections>) =>
  sections.map((section) => section.kind)

describe('stage detail data', () => {
  it('flattens nested evidence into readable strings', () => {
    expect(
      evidenceEntries({ path: 'a.md', checks: ['lint', { test: 'jest' }] })
    ).toEqual(['a.md', 'lint', 'jest'])
    expect(evidenceEntries(null)).toEqual([])
  })

  it('filters and sorts events by stage', () => {
    expect(stageEvents(run(), 'EXECUTION').map((event) => event.id)).toEqual([
      'e1',
      'e2',
    ])
    expect(stageWindow(run(), 'EXECUTION')).toEqual({
      start: '2026-11-18T02:01:00.000Z',
      end: '2026-11-18T02:10:00.000Z',
    })
    expect(stageWindow(run(), 'INTAKE').start).toBe(run().startedAt)
  })

  it('aggregates tokens per stage and reports missing values as null', () => {
    const metrics = stageMetrics(run(), 'EXECUTION')
    expect(metrics.inputTokens).toBe(150)
    expect(metrics.outputTokens).toBe(20)
    expect(metrics.cachedTokens).toBeNull()
    expect(metrics.models).toEqual(['gpt-5'])
    expect(metrics.agents).toEqual([
      'software-engineer-agent',
      'qa-security-engineer-agent',
    ])
  })

  it('builds intake from the linked task', () => {
    const sections = buildStageSections({
      stage: 'INTAKE',
      run: run(),
      task: task(),
    })
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({
      kind: 'keyvals',
      source: '任务记录',
    })
    expect(sections[0].kind === 'keyvals' && sections[0].items).toEqual([
      { label: '任务标题', value: '阶段详情' },
      { label: '需求', value: '点击阶段查看需求、方案、执行与交付。' },
      { label: '验收标准', value: '五个阶段都能打开且有空态' },
    ])
  })

  it('falls back to the first user message when the run has no task', () => {
    const sections = buildStageSections({
      stage: 'INTAKE',
      run: run(),
      trace: trace(),
    })
    expect(sections[0]).toMatchObject({
      kind: 'markdown',
      source: '会话记录',
      body: '把运行记录做成可点的阶段详情',
    })
  })

  it('explains the empty intake state', () => {
    const sections = buildStageSections({
      stage: 'INTAKE',
      run: run(),
      trace: trace({ messages: [], source: 'none' }),
    })
    expect(sections[0].kind).toBe('empty')
    expect(sections[0].kind === 'empty' && sections[0].body).toContain(
      '没有关联任务'
    )
  })

  it('shows the plan file and the latest revision note', () => {
    const sections = buildStageSections({
      stage: 'PLANNING',
      run: run(),
      task: task(),
      plan: { content: '# 方案\n内容' },
    })
    expect(kinds(sections)).toEqual(['markdown', 'text'])
    expect(sections[0].title).toContain('docs/plans/task-1.md')
    expect(sections[1]).toMatchObject({ source: '任务记录' })
  })

  it('reports a missing plan file instead of throwing', () => {
    const sections = buildStageSections({
      stage: 'PLANNING',
      run: run(),
      task: task(),
      plan: { error: '文件不存在' },
    })
    expect(sections[0]).toMatchObject({ kind: 'empty' })
    expect(sections[0].kind === 'empty' && sections[0].body).toContain(
      '文件不存在'
    )
  })

  it('falls back to stage events when there is no plan at all', () => {
    const sections = buildStageSections({
      stage: 'PLANNING',
      run: run({
        events: [
          {
            id: 'p1',
            sequence: 1,
            stage: 'PLANNING',
            agent: 'product-solution-agent',
            summary: '产出方案草稿',
            createdAt: '2026-11-18T02:02:00.000Z',
          },
        ],
      }),
      task: task({ planPath: null, planNote: null }),
    })
    expect(sections[0]).toMatchObject({ kind: 'list', source: '任务记录' })
  })

  it('builds execution messages and tool trace', () => {
    const sections = buildStageSections({
      stage: 'EXECUTION',
      run: run(),
      trace: trace({ truncated: true }),
    })
    expect(kinds(sections)).toEqual(['messages', 'tools'])
    expect(sections[0].kind === 'messages' && sections[0].truncated).toBe(true)
    expect(sections[1].kind === 'tools' && sections[1].tools).toHaveLength(1)
  })

  it('explains the empty execution state', () => {
    const sections = buildStageSections({
      stage: 'EXECUTION',
      run: run(),
      trace: trace({ messages: [], tools: [], source: 'none' }),
    })
    expect(sections[0].kind === 'empty' && sections[0].body).toContain(
      '没有关联可读的会话记录'
    )
  })

  it('builds verification from evidence, review note and reports', () => {
    const sections = buildStageSections({
      stage: 'VERIFICATION',
      run: run(),
      task: task(),
    })
    expect(kinds(sections)).toEqual(['list', 'text', 'artifacts'])
    expect(sections[0].kind === 'list' && sections[0].items).toEqual([
      '#3 · reports/qa.json',
      '#3 · yarn test',
    ])
    expect(
      sections[2].kind === 'artifacts' &&
        sections[2].items.map((item) => item.id)
    ).toEqual(['a1'])
  })

  it('builds delivery from artifacts and the closing message', () => {
    const sections = buildStageSections({
      stage: 'DELIVERY',
      run: run(),
      task: task(),
      trace: trace(),
    })
    expect(kinds(sections)).toEqual(['artifacts', 'markdown'])
    expect(sections[0].kind === 'artifacts' && sections[0].items).toHaveLength(
      2
    )
    expect(sections[1].kind === 'markdown' && sections[1].body).toContain(
      '阶段抽屉'
    )
  })

  it('explains the empty delivery state for synced runs', () => {
    const sections = buildStageSections({
      stage: 'DELIVERY',
      run: run(),
      trace: trace({ messages: [] }),
    })
    expect(sections[0].kind).toBe('empty')
    expect(sections[0].kind === 'empty' && sections[0].body).toContain(
      '产物清单'
    )
  })

  it('picks the first user message and the last assistant message', () => {
    const value = trace({
      messages: [
        {
          role: 'user',
          content: '需求一',
          createdAt: '2026-11-18T02:01:00.000Z',
        },
        {
          role: 'user',
          content: '需求二',
          createdAt: '2026-11-18T02:02:00.000Z',
        },
        {
          role: 'assistant',
          content: '结论二',
          createdAt: '2026-11-18T02:03:00.000Z',
        },
      ],
    })
    expect(firstUserMessage(value)?.content).toBe('需求一')
    expect(finalAssistantMessage(value)?.content).toBe('结论二')
    expect(finalAssistantMessage(trace({ messages: [] }))).toBeNull()
  })
})
