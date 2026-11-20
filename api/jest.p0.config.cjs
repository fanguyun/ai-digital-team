const path = require('node:path')

const preset = require('@cedarjs/testing/config/jest/api/jest-preset').default

module.exports = {
  ...preset,
  displayName: 'p0-integration',
  globalSetup: path.join(__dirname, 'test/p0-global-setup.cjs'),
  testMatch: ['<rootDir>/api/src/services/tasks/tasks*.test.ts'],
}
