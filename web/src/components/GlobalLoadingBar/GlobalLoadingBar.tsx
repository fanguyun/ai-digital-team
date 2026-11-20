import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  getPendingRequestCount,
  subscribeRequestLoading,
} from 'src/lib/requestLoading'

/** 请求很快时也至少显示这么久，避免 loading 条一闪而过 */
const MIN_VISIBLE_MS = 260

/** 页面顶部的全局 loading 条：只要有 GraphQL 请求在飞就显示 */
const GlobalLoadingBar = () => {
  const pending = useSyncExternalStore(
    subscribeRequestLoading,
    getPendingRequestCount,
    () => 0
  )
  const active = pending > 0
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) {
      setVisible(true)
      return
    }
    const timer = window.setTimeout(() => setVisible(false), MIN_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  return (
    <div
      className={`global-loading-bar${visible ? ' active' : ''}`}
      role="progressbar"
      aria-label="正在加载"
      aria-hidden={!visible}
      aria-busy={active}
    >
      <span />
    </div>
  )
}

export default GlobalLoadingBar
