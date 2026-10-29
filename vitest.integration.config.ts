import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests against Postgres ("npm run db:up" first): one file at a time, they share the test database
export default defineConfig({
  resolve: {
    // "server-only" throws outside Next's server build; unit and integration tests run on the server
    alias: {
      'server-only': fileURLToPath(new URL('apps/web/test/server-only-stub.ts', import.meta.url)),
    },
  },
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
