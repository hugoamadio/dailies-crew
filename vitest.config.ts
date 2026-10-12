import { defineConfig } from 'vitest/config';

// Unit tests only: renders live in the visual and e2e configs, Postgres in the integration config
export default defineConfig({
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
