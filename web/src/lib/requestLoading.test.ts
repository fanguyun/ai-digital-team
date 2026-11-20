import {
  finishRequest,
  getPendingRequestCount,
  isSubscriptionOperation,
  resetRequestLoading,
  startRequest,
  subscribeRequestLoading,
} from './requestLoading'

describe('request loading tracker', () => {
  beforeEach(() => {
    resetRequestLoading()
  })

  it('counts in-flight requests and never goes below zero', () => {
    expect(getPendingRequestCount()).toBe(0)

    startRequest()
    startRequest()
    expect(getPendingRequestCount()).toBe(2)

    finishRequest()
    expect(getPendingRequestCount()).toBe(1)

    finishRequest()
    finishRequest()
    expect(getPendingRequestCount()).toBe(0)
  })

  it('notifies subscribers until they unsubscribe', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeRequestLoading(listener)

    startRequest()
    finishRequest()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    startRequest()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('treats subscriptions differently from one-shot operations', () => {
    expect(
      isSubscriptionOperation({
        query: {
          definitions: [
            { kind: 'OperationDefinition', operation: 'subscription' },
          ],
        },
      })
    ).toBe(true)
    expect(
      isSubscriptionOperation({
        query: {
          definitions: [{ kind: 'OperationDefinition', operation: 'query' }],
        },
      })
    ).toBe(false)
    expect(isSubscriptionOperation({ query: { definitions: [] } })).toBe(false)
  })
})
