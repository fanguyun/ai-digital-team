export const METRICS_TIME_ZONE = 'Asia/Shanghai'

export const METRICS_RANGE_PRESETS = [
  { id: 'all', label: '全部' },
  { id: 'today', label: '今天' },
  { id: '7d', label: '7天' },
  { id: '14d', label: '14天' },
  { id: '1m', label: '1个月' },
  { id: '3m', label: '3个月' },
  { id: 'custom', label: '自定义' },
]

const pad = (value) => String(value).padStart(2, '0')

const shanghaiDateParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: METRICS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const read = (type) => Number(parts.find((part) => part.type === type).value)
  return { year: read('year'), month: read('month'), day: read('day') }
}

const addDays = (parts, days) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

const addMonths = (parts, months) => {
  const monthIndex = parts.month - 1 + months
  const year = parts.year + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return {
    year,
    month: month + 1,
    day: Math.min(parts.day, lastDay),
  }
}

const shanghaiStart = (parts) =>
  new Date(
    `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T00:00:00+08:00`
  )

const datePartsFromInput = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

export const resolveMetricsRange = ({
  preset = 'all',
  customFrom = '',
  customTo = '',
  now = new Date(),
} = {}) => {
  if (preset === 'all') return null

  const today = shanghaiDateParts(now)
  const end = shanghaiStart(addDays(today, 1))
  if (preset === 'custom') {
    const fromParts = datePartsFromInput(customFrom)
    const toParts = datePartsFromInput(customTo)
    if (!fromParts || !toParts) return { incomplete: true }
    const from = shanghaiStart(fromParts)
    const to = shanghaiStart(addDays(toParts, 1))
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return { invalid: true }
    }
    return { from, to }
  }

  const start =
    preset === 'today'
      ? today
      : preset === '7d'
        ? addDays(today, -6)
        : preset === '14d'
          ? addDays(today, -13)
          : preset === '1m'
            ? addMonths(today, -1)
            : preset === '3m'
              ? addMonths(today, -3)
              : null
  if (!start) return null
  return { from: shanghaiStart(start), to: end }
}
