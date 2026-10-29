import { testDb } from '@dailies-crew/db/test';
import { PgBoss } from 'pg-boss';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { WORKER_APPLICATION_NAME, workerOnline } from './worker-state';

const db = testDb();

/** Postgres lists a closed connection for a moment after the client hangs up: up to 5 s */
async function settled(expected: boolean): Promise<boolean> {
  let online = await workerOnline(db);
  for (let tries = 0; online !== expected && tries < 50; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    online = await workerOnline(db);
  }
  return online;
}

afterAll(async () => {
  await db.$disconnect();
});

describe('workerOnline', () => {
  it('is true while a pg-boss with the worker application name is connected', async () => {
    // another integration file may have left a worker connection listed for a few seconds
    expect(await settled(false)).toBe(false);
    const boss = new PgBoss({
      connectionString: inject('testDatabaseUrl'),
      application_name: WORKER_APPLICATION_NAME,
      schema: 'pgboss_worker_state',
      supervise: false,
      schedule: false,
    });
    await boss.start();
    try {
      expect(await workerOnline(db)).toBe(true);
    } finally {
      await boss.stop({ graceful: false });
      await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS pgboss_worker_state CASCADE');
    }
    expect(await settled(false)).toBe(false);
  });
});
