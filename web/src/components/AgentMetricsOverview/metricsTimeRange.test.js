import { resolveMetricsRange } from './metricsTimeRange'

const now = new Date('2026-10-15T04:00:00.000Z')

describe('metrics time range', () => {
  it('uses Shanghai calendar days for the presets', () => {
    expect(resolveMetricsRange({ preset: 'all', now })).toBeNull()
    expect(resolveMetricsRange({ preset: 'today', now })).toEqual({
      from: new Date('2026-10-15T00:00:00+08:00'),
      to: new Date('2026-10-16T00:00:00+08:00'),
    })
    expect(resolveMetricsRange({ preset: '7d', now }).from).toEqual(
      new Date('2026-10-09T00:00:00+08:00')
    )
    expect(resolveMetricsRange({ preset: '14d', now }).from).toEqual(
      new Date('2026-10-02T00:00:00+08:00')
    )
    expect(resolveMetricsRange({ preset: '1m', now }).from).toEqual(
      new Date('2026-09-15T00:00:00+08:00')
    )
    expect(resolveMetricsRange({ preset: '3m', now }).from).toEqual(
      new Date('2026-07-15T00:00:00+08:00')
    )
  })

  it('treats a custom range as inclusive Shanghai dates', () => {
    expect(
      resolveMetricsRange({
        preset: 'custom',
        customFrom: '2026-10-01',
        customTo: '2026-10-03',
        now,
      })
    ).toEqual({
      from: new Date('2026-10-01T00:00:00+08:00'),
      to: new Date('2026-10-04T00:00:00+08:00'),
    })
    expect(
      resolveMetricsRange({
        preset: 'custom',
        customFrom: '2026-10-03',
        customTo: '2026-10-01',
        now,
      })
    ).toEqual({ invalid: true })
    expect(
      resolveMetricsRange({ preset: 'custom', customFrom: '2026-10-01', now })
    ).toEqual({ incomplete: true })
  })
})
