const cedarApiPreset = require('@cedarjs/testing/config/jest/api/jest-preset').default

module.exports = {
  ...cedarApiPreset,
  displayName: 'api-unit',
  globalSetup: undefined,
  setupFilesAfterEnv: [],
  testMatch: [
    '<rootDir>/api/src/lib/**/*.test.ts',
    '<rootDir>/api/src/directives/**/*.test.ts',
    '<rootDir>/api/src/subscriptions/**/*.test.ts',
  ],
}
