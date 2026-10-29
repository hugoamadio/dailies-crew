import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TEST_DATABASE = 'dailies_test';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** dailies_test next to the database of the root .env: the one place that URL is computed */
export function testDatabaseUrl(databaseUrl: string): string {
  return withDatabase(databaseUrl, TEST_DATABASE);
}

/**
 * Creates the dailies_test database next to the dev one (DATABASE_URL of the root .env) and
 * applies every migration to it; returns its URL. The panel's Playwright tests call it too.
 */
export async function prepareTestDatabase(): Promise<string> {
  try {
    process.loadEnvFile(path.join(repoRoot, '.env'));
  } catch {
    // no .env file: the environment alone is used
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set: copy .env.example to .env and run npm run db:up');
  }
  const admin = new pg.Client({ connectionString: withDatabase(url, 'postgres') });
  await admin.connect();
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DATABASE,
    ]);
    if (found.rowCount === 0) await admin.query(`CREATE DATABASE ${TEST_DATABASE}`);
  } finally {
    await admin.end();
  }
  const testUrl = testDatabaseUrl(url);
  try {
    execFileSync(
      'npx',
      ['prisma', 'migrate', 'deploy', '--config', 'packages/db/prisma7.config.ts'],
      { cwd: repoRoot, env: { ...process.env, DATABASE_URL: testUrl }, stdio: 'pipe' },
    );
  } catch (error) {
    const output = (error as { stderr?: Buffer }).stderr?.toString() ?? String(error);
    throw new Error(`prisma migrate deploy failed on ${TEST_DATABASE}:\n${output}`);
  }
  return testUrl;
}

/** Vitest's global setup for the integration tests */
export default async function setup(project: TestProject): Promise<void> {
  project.provide('testDatabaseUrl', await prepareTestDatabase());
}
