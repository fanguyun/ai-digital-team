export type ReportDimension = 'day' | 'week' | 'month'

export const reportRangeForOffset = (
  dimension: ReportDimension,
  offset: number,
  now = new Date()
) => {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  if (dimension === 'day') {
    start.setDate(start.getDate() + offset)
  } else if (dimension === 'week') {
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1 + offset * 7)
  } else {
    start.setDate(1)
    start.setMonth(start.getMonth() + offset)
  }

  const end = new Date(start)
  if (dimension === 'day') end.setDate(end.getDate() + 1)
  if (dimension === 'week') end.setDate(end.getDate() + 7)
  if (dimension === 'month') end.setMonth(end.getMonth() + 1)

  return { from: start.toISOString(), to: end.toISOString() }
}
export const formatReportRange = (
  { from, to }: { from: string; to: string },
  dimension: ReportDimension
) => {
  const end = new Date(to)
  end.setDate(end.getDate() - 1)
  const format = (value: string | Date) =>
    new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  if (dimension === 'day') return format(from)
  return `${format(from)} — ${format(end)}`
}
