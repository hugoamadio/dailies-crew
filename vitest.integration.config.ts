import { defineConfig } from 'vitest/config';

// Tests against Postgres ("npm run db:up" first): one file at a time, they share the test database
export default defineConfig({
  test: {
    include: [
      'packages/*/{src,test}/**/*.integration.test.ts',
      'apps/*/{src,test}/**/*.integration.test.ts',
    ],
    environment: 'node',
    globalSetup: ['packages/db/test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
