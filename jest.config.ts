import type { Config } from 'jest'

const config: Config = {
  preset:              'ts-jest',
  testEnvironment:     'node',
  moduleNameMapper:    { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch:           ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/lib/**/*.ts', '!src/lib/**/__tests__/**'],
  coverageThreshold:   { global: { lines: 70 } },
}

export default config
