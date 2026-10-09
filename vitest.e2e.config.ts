import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/{src,test}/**/*.e2e.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
