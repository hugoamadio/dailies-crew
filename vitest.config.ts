import { defineConfig } from 'vitest/config';

// Unit tests only: renders live in the visual and e2e configs
export default defineConfig({
  test: {
    include: ['packages/*/{src,test}/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/*.visual.test.ts', '**/*.e2e.test.ts'],
    environment: 'node',
  },
});
