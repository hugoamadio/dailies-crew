import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests only: renders live in the visual and e2e configs, Postgres in the integration config
export default defineConfig({
  resolve: {
    // "server-only" throws outside Next's server build; unit and integration tests run on the server
    alias: {
      'server-only': fileURLToPath(new URL('apps/web/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/{src,test}/**/*.test.{ts,tsx}', 'apps/*/{src,test}/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/*.visual.test.ts',
      '**/*.e2e.test.ts',
      '**/*.integration.test.ts',
    ],
    environment: 'node',
  },
});
