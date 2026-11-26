import { logger } from 'src/lib/logger'

const INTERVAL_MS = 30_000

type Ticker = {
  sweep: () => Promise<unknown>
  timer: ReturnType<typeof setInterval>
}
const registry = globalThis as typeof globalThis & { __pdtTaskTicker?: Ticker }

/**
 * 后台巡检定时器：不依赖前端查询，也能回收执行、推进队列。
 * 只启动一次；定时器 unref，不阻塞进程退出。
 */
export const startTaskTicker = (
  sweep: () => Promise<unknown>,
  intervalMs = INTERVAL_MS
) => {
  if (registry.__pdtTaskTicker) {
    registry.__pdtTaskTicker.sweep = sweep
    return
  }

  const timer = setInterval(() => {
    void registry.__pdtTaskTicker!.sweep().catch((error) => {
      logger.warn({ error }, 'task ticker sweep failed')
    })
  }, intervalMs)
  registry.__pdtTaskTicker = { sweep, timer }

  ;(timer as unknown as { unref?: () => void }).unref?.()
}
