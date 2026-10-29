import { resetDb, testDb } from '@dailies-crew/db/test';
import { createLine } from '@dailies-crew/studio';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { topicLineInput } from '../../../../packages/studio/test/fixtures';
import { createPanel, PANEL_APPLICATION_NAME } from './panel';

const db = testDb();
const SCHEMA = 'pgboss_panel_test';
beforeEach(async () => {
  await resetDb(db);
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
});
afterAll(async () => {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await db.$disconnect();
});

describe('createPanel', () => {
  it('sends stage jobs and syncs the schedules through pg-boss, without being a worker', async () => {
    const panel = await createPanel(
      { DATABASE_URL: inject('testDatabaseUrl'), DAILIES_FAKE_AI: '1' },
      { bossSchema: SCHEMA, log: () => undefined },
    );
    try {
      const line = await createLine(panel.ctx, topicLineInput({ hour: 7 }));
      const video = await db.video.create({ data: { lineId: line.id } });
      await panel.ctx.queue.enqueue('prepare', video.id);
      await panel.syncSchedules();
      const jobs = await db.$queryRawUnsafe<{ name: string; data: { videoId: string } }[]>(
        `SELECT name, data FROM ${SCHEMA}.job WHERE name = 'stage.prepare'`,
      );
      expect(jobs).toEqual([{ name: 'stage.prepare', data: { videoId: video.id } }]);
      const schedules = await db.$queryRawUnsafe<{ key: string; cron: string }[]>(
        `SELECT key, cron FROM ${SCHEMA}.schedule`,
      );
      expect(schedules).toEqual([{ key: line.id, cron: '0 7 * * *' }]);
      const connections = await db.$queryRawUnsafe<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND application_name = $1`,
        PANEL_APPLICATION_NAME,
      );
      expect(connections[0]!.count).toBeGreaterThan(0);
      expect(panel.ctx.llm.name).toBe('fake');
    } finally {
      await panel.close();
    }
  });
});
