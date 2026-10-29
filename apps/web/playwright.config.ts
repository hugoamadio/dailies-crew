import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_DATA_DIR, E2E_DIST_DIR, E2E_PORT, repoRoot, testDatabaseUrl } from './e2e/env';

try {
  process.loadEnvFile(path.join(repoRoot, '.env'));
} catch {
  // no .env file: the environment alone is used
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set: copy .env.example to .env and run npm run db:up');
}

const baseURL = `http://127.0.0.1:${E2E_PORT}`;

/**
 * NEVER run this together with "npm run test:integration": both empty and seed dailies_test.
 *
 * Browser smoke tests of the panel ("npm run test:web"): a production build on port 3310 against
 * dailies_test with seeded data and the fake AI, driven by Playwright's own headless Chromium.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  outputDir: path.join(repoRoot, 'out', 'web-e2e-results'),
  use: { baseURL, trace: 'retain-on-failure', locale: 'en-US' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx tsx e2e/prepare-db.ts && npx next build && npx next start -H 127.0.0.1 -p ${E2E_PORT}`,
    cwd: import.meta.dirname,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      DATABASE_URL: testDatabaseUrl(process.env.DATABASE_URL),
      DAILIES_DATA_DIR: E2E_DATA_DIR,
      DAILIES_FAKE_AI: '1',
      DAILIES_WEB_DIST_DIR: E2E_DIST_DIR,
      NEXT_TELEMETRY_DISABLED: '1',
      // never Hugo's real keys (the .env above is loaded into this process)
      ANTHROPIC_API_KEY: 'test-anthropic-key-not-real',
      ELEVENLABS_API_KEY: 'test-elevenlabs-key-not-real',
    },
  },
});
