import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@jobs/(.*)$': '<rootDir>/src/jobs/$1',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
  },
  setupFilesAfterEnv: [],
};

export default config;
