export type TokenCoverage = 'NONE' | 'PARTIAL' | 'COMPLETE'

type TokenEvent = {
  inputTokens?: number | null
  outputTokens?: number | null
  cachedTokens?: number | null
}
type DetailEvent = TokenEvent & {
  agent: string
  skills: string[]
}
export const uniqueValues = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))]

const summarizeDimension = (
  events: TokenEvent[],
  key: keyof TokenEvent
): { value: number; coverage: TokenCoverage } => {
  const tracked = events.filter((event) => event[key] != null)
  return {
    value: tracked.reduce((total, event) => total + (event[key] ?? 0), 0),
    coverage:
      tracked.length === 0
        ? 'NONE'
        : tracked.length === events.length
          ? 'COMPLETE'
          : 'PARTIAL',
  }
}

export const summarizeTaskTokens = (events: TokenEvent[]) => {
  const input = summarizeDimension(events, 'inputTokens')
  const output = summarizeDimension(events, 'outputTokens')
  const cached = summarizeDimension(events, 'cachedTokens')
  const trackedTotals = events.filter(
    (event) => event.inputTokens != null && event.outputTokens != null
  )

  return {
    input,
    output,
    cached,
    total: {
      value: input.value + output.value,
      coverage:
        trackedTotals.length === 0
          ? ('NONE' as const)
          : trackedTotals.length === events.length
            ? ('COMPLETE' as const)
            : ('PARTIAL' as const),
    },
  }
}

export const taskParticipants = (
  primaryAgent: string,
  events: DetailEvent[]
) => uniqueValues([primaryAgent, ...events.map((event) => event.agent)])

export const taskSkills = (events: DetailEvent[]) =>
  uniqueValues(events.flatMap((event) => event.skills))

export const formatTokenValue = (
  value: number,
  coverage: TokenCoverage
) => {
  if (coverage === 'NONE') return '未采集'
  const formatted = new Intl.NumberFormat('zh-CN').format(value)
  return coverage === 'PARTIAL' ? `${formatted}（部分）` : formatted
}
