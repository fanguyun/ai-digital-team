import type { CedarRealtimeOptions } from '@cedarjs/realtime'

import subscriptions from 'src/subscriptions/**/*.{js,ts}'

export const realtime: CedarRealtimeOptions = {
  subscriptions: {
    subscriptions,
    store: 'in-memory',
  },
}
