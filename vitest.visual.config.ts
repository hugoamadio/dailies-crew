import { defineConfig } from 'vitest/config';

// Renders real frames with Remotion: one file at a time, generous timeouts (the first run bundles
// the scenes and downloads Chrome Headless Shell)
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.visual.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 600_000,
  },
});
