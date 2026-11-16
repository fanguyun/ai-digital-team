import { logger } from 'src/lib/logger'

const INTERVAL_MS = 30_000

let started = false

/**
 * 后台巡检定时器：不依赖前端查询，也能回收执行、推进队列。
 * 只启动一次；定时器 unref，不阻塞进程退出。
 */
export const startTaskTicker = (
  sweep: () => Promise<unknown>,
  intervalMs = INTERVAL_MS
) => {
  if (started) return
  started = true

  const timer = setInterval(() => {
    void sweep().catch((error) => {
      logger.warn({ error }, 'task ticker sweep failed')
    })
  }, intervalMs)

  ;(timer as unknown as { unref?: () => void }).unref?.()
}
