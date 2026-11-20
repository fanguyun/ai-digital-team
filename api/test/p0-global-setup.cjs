const process = require('node:process')
const { URL } = require('node:url')

module.exports = async () => {
  const databaseUrl = new URL(process.env.TEST_DATABASE_URL || '')
  if (
    databaseUrl.protocol !== 'postgresql:' ||
    databaseUrl.hostname !== '127.0.0.1' ||
    databaseUrl.port !== '55439' ||
    databaseUrl.pathname !== '/pdt_p0_test' ||
    databaseUrl.search ||
    process.env.SKIP_DB_PUSH === '1'
  ) {
    throw new Error(
      'P0 tests only reset postgresql://127.0.0.1:55439/pdt_p0_test; set TEST_DATABASE_URL explicitly'
    )
  }
  process.env.DATABASE_URL = databaseUrl.toString()
  const preset = require('@cedarjs/testing/config/jest/api/jest-preset').default
  const setup = require(preset.globalSetup).default
  await setup()
}
