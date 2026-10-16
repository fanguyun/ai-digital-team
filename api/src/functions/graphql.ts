import { createGraphQLHandler } from '@cedarjs/graphql-server'

import directives from 'src/directives/**/*.{js,ts}'
import sdls from 'src/graphql/**/*.sdl.{js,ts}'
import services from 'src/services/**/*.{js,ts}'

import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { realtime } from 'src/lib/realtime'
import { userFromContext } from 'src/lib/sessions'

const realtimeOptions = process.env.NODE_ENV === 'test' ? {} : { realtime }

export const handler = createGraphQLHandler({
  loggerConfig: { logger, options: {} },
  directives,
  context: async ({ context }) => ({
    currentUser: await userFromContext(context),
  }),
  ...realtimeOptions,
  sdls,
  services,
  onException: () => {
    db.$disconnect()
  },
})
