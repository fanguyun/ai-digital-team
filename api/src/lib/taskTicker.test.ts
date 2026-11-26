import { startTaskTicker } from './taskTicker'

it('热更新保留一个巡检定时器，并替换为最新调度逻辑', async () => {
  jest.useFakeTimers()
  const registry = globalThis as typeof globalThis & {
    __pdtTaskTicker?: { timer: ReturnType<typeof setInterval> }
  }
  const previous = registry.__pdtTaskTicker
  delete registry.__pdtTaskTicker
  try {
    const oldSweep = jest.fn().mockResolvedValue(undefined)
    const newSweep = jest.fn().mockResolvedValue(undefined)
    startTaskTicker(oldSweep, 1000)
    startTaskTicker(newSweep, 1000)
    jest.advanceTimersByTime(1000)
    await Promise.resolve()
    expect(oldSweep).not.toHaveBeenCalled()
    expect(newSweep).toHaveBeenCalledTimes(1)
  } finally {
    clearInterval(registry.__pdtTaskTicker?.timer)
    registry.__pdtTaskTicker = previous
    jest.useRealTimers()
  }
})
