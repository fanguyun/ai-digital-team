import { formatReportRange, reportRangeForOffset } from './weekRange'

describe('summary report range', () => {
  const now = new Date('2026-10-16T12:00:00+08:00')

  it('支持按天查看当前和历史日期', () => {
    const current = reportRangeForOffset('day', 0, now)
    const previous = reportRangeForOffset('day', -1, now)
    expect(current.from).toContain('2026-10-15T16:00:00.000Z')
    expect(current.to).toContain('2026-10-16T16:00:00.000Z')
    expect(previous.from).toContain('2026-10-14T16:00:00.000Z')
  })

  it('以周一为一周开始并支持查看上一周', () => {
    const current = reportRangeForOffset('week', 0, now)
    const previous = reportRangeForOffset('week', -1, now)
    expect(current.from).toContain('2026-10-11T16:00:00.000Z')
    expect(current.to).toContain('2026-10-18T16:00:00.000Z')
    expect(previous.from).toContain('2026-10-04T16:00:00.000Z')
  })

  it('支持按自然月查看', () => {
    const current = reportRangeForOffset('month', 0, now)
    const previous = reportRangeForOffset('month', -1, now)
    expect(current.from).toContain('2026-09-30T16:00:00.000Z')
    expect(current.to).toContain('2026-10-31T16:00:00.000Z')
    expect(previous.from).toContain('2026-08-31T16:00:00.000Z')
  })

  it('按维度展示日期或日期范围', () => {
    expect(
      formatReportRange(
        {
          from: '2026-10-11T16:00:00.000Z',
          to: '2026-10-18T16:00:00.000Z',
        },
        'week'
      )
    ).toContain('2026/10/12')
    expect(
      formatReportRange(
        {
          from: '2026-10-15T16:00:00.000Z',
          to: '2026-10-16T16:00:00.000Z',
        },
        'day'
      )
    ).toBe('2026/10/16')
  })
})
