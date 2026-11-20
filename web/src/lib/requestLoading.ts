import { ApolloLink, Observable } from '@apollo/client'

type Listener = () => void

type OperationLike = {
  query: {
    definitions: ReadonlyArray<{ kind: string; operation?: string }>
  }
}

export const isSubscriptionOperation = (operation: OperationLike) =>
  operation.query.definitions.some(
    (definition) =>
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
  )

let pendingRequests = 0
let notifyScheduled = false
const listeners = new Set<Listener>()

/**
 * 通知延后到微任务：Apollo 可能在 React 渲染期间就发起请求，
 * 同步通知会让 store 订阅者在别人渲染时 setState。
 */
const notify = () => {
  if (notifyScheduled) return
  notifyScheduled = true
  queueMicrotask(() => {
    notifyScheduled = false
    for (const listener of listeners) listener()
  })
}

/** 页面顶部全局 loading 条的数据源：正在进行的 GraphQL 请求数 */
export const startRequest = () => {
  pendingRequests += 1
  notify()
}

export const finishRequest = () => {
  pendingRequests = Math.max(0, pendingRequests - 1)
  notify()
}

export const getPendingRequestCount = () => pendingRequests

export const subscribeRequestLoading = (listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 仅测试用：把计数归零，避免用例之间互相影响 */
export const resetRequestLoading = () => {
  pendingRequests = 0
  notify()
}

/**
 * 每个 GraphQL 操作前后打点。
 * 订阅（SSE）不会结束，必须跳过，否则顶部 loading 会一直亮着。
 */
export const requestLoadingLink = new ApolloLink((operation, forward) => {
  if (isSubscriptionOperation(operation as never)) return forward(operation)

  startRequest()
  let settled = false
  const settle = () => {
    if (settled) return
    settled = true
    finishRequest()
  }

  return new Observable((observer) => {
    const subscription = forward(operation).subscribe({
      next: (value) => observer.next(value),
      error: (error) => {
        settle()
        observer.error(error)
      },
      complete: () => {
        settle()
        observer.complete()
      },
    })

    return () => {
      settle()
      subscription.unsubscribe()
    }
  })
})
