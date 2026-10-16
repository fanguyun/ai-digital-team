import { groupTaskRuns, normalizedActivityTitle } from './activityGroups'

const task = (
  id: string,
  title: string,
  status: string,
  updatedAt: string,
  externalReference: string
) => ({
  id,
  title,
  platform: 'codex',
  externalReference,
  primaryAgent: 'main-agent',
  summary: 'Codex · ai-digital-team',
  status,
  updatedAt,
})

describe('activity groups', () => {
  it('groups normalized duplicate titles from the same imported session', () => {
    const groups = groupTaskRuns([
      task(
        '1',
        '修复运行记录',
        'COMPLETED',
        '2026-10-15T01:00:00Z',
        'codex-task:session:1'
      ),
      task(
        '2',
        '修复运行记录。',
        'COMPLETED',
        '2026-10-15T02:00:00Z',
        'codex-task:session:2'
      ),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((item) => item.id)).toEqual(['2', '1'])
    expect(normalizedActivityTitle(' 修复运行记录。')).toBe('修复运行记录')
  })

  it('keeps the same title separate across sources and prioritizes active work', () => {
    const groups = groupTaskRuns([
      task(
        'completed',
        '同一任务',
        'COMPLETED',
        '2026-10-15T03:00:00Z',
        'codex-task:a:1'
      ),
      task(
        'running',
        '同一任务',
        'RUNNING',
        '2026-10-15T01:00:00Z',
        'codex-task:a:2'
      ),
      task(
        'other',
        '同一任务',
        'COMPLETED',
        '2026-10-15T04:00:00Z',
        'codex-task:b:1'
      ),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.find((group) => group.items.length === 2)?.task.id).toBe(
      'running'
    )
  })
})
