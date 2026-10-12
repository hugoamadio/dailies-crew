import { afterAll, describe, expect, it } from 'vitest';
import { testDb } from '@dailies-crew/db/test';
import { runCli } from './cli';
import { createRuntime } from './runtime';

const db = testDb();
afterAll(async () => {
  await db.$disconnect();
});

describe('createRuntime without a key', () => {
  it('opens without the queue, runs a read-only command and closes', async () => {
    const env = { DATABASE_URL: process.env.DATABASE_URL };
    expect(env.DATABASE_URL).toBeTruthy();
    const out: string[] = [];
    const err: string[] = [];
    const code = await runCli(
      ['status'],
      { out: (line) => out.push(line), err: (line) => err.push(line) },
      env,
      ({ queue }) => createRuntime(env, { queue, worker: false, lazyLlm: true }),
    );
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(out.join('\n')).toContain('Videos:');
  });
});
