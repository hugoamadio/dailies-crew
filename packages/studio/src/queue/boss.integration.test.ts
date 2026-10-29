import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { PgBoss } from 'pg-boss';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, inject } from 'vitest';
import { productLineInput, tempDataDir, topicLineInput } from '../../test/fixtures';
import { createLine, pauseLine, setLineActive, updateLine } from '../lines/service';
import { STAGES } from '../pipeline/stages';
import {
  BossQueue,
  EXPIRE_SECONDS,
  ensureQueues,
  HEARTBEAT_SECONDS,
  STAGE_QUEUES,
  TICK_QUEUE,
} from './boss';
import { cronFor, syncSchedules } from './scheduler';

const db = testDb();
const boss = new PgBoss({
  connectionString: inject('testDatabaseUrl'),
  schema: 'pgboss_test',
  supervise: false,
  schedule: false,
});
let dataDir: string;

beforeAll(async () => {
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS pgboss_test CASCADE');
  boss.on('error', (error) => console.error(error));
  await boss.start();
  await ensureQueues(boss);
});
beforeEach(async () => {
  await resetDb(db);
  for (const name of [...Object.values(STAGE_QUEUES), TICK_QUEUE]) await boss.deleteAllJobs(name);
  for (const schedule of await boss.getSchedules(TICK_QUEUE))
    await boss.unschedule(TICK_QUEUE, schedule.key);
  dataDir = await tempDataDir();
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});
afterAll(async () => {
  await boss.stop({ graceful: false });
  await db.$disconnect();
});

describe('the queues', () => {
  it('exist for every stage with 3 retries, backoff, a heartbeat and the stage expiry', async () => {
    const queues = await boss.getQueues();
    for (const stage of STAGES) {
      expect(queues.find((queue) => queue.name === STAGE_QUEUES[stage])).toMatchObject({
        retryLimit: 3,
        retryBackoff: true,
        expireInSeconds: EXPIRE_SECONDS[stage],
        heartbeatSeconds: HEARTBEAT_SECONDS,
      });
    }
    const options = async () =>
      (await boss.getQueues())
        .map((queue) => ({
          name: queue.name,
          retryLimit: queue.retryLimit,
          retryDelay: queue.retryDelay,
          retryBackoff: queue.retryBackoff,
          retryDelayMax: queue.retryDelayMax,
          expireInSeconds: queue.expireInSeconds,
          heartbeatSeconds: queue.heartbeatSeconds,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const before = await options();
    expect(before).toHaveLength(STAGES.length + 1);
    await ensureQueues(boss);
    expect(await options()).toEqual(before);
  });

  it('commits a stage job with the transaction that queues it, and drops it on rollback', async () => {
    const queue = new BossQueue(boss);
    const line = await createLine({ db, dataDir }, topicLineInput());
    const video = await db.video.create({ data: { lineId: line.id } });

    await db.$transaction(async (tx) => {
      await queue.enqueue('prepare', video.id, tx);
    });
    await expect(
      db.$transaction(async (tx) => {
        await queue.enqueue('ideas', video.id, tx);
        throw new Error('rolled back');
      }),
    ).rejects.toThrow('rolled back');

    expect((await boss.findJobs(STAGE_QUEUES.prepare)).map((job) => job.data)).toEqual([
      { videoId: video.id },
    ]);
    expect(await boss.findJobs(STAGE_QUEUES.ideas)).toEqual([]);
  });
});

describe('syncSchedules', () => {
  it('schedules every active line at its hour in the settings time zone, and removes the others', async () => {
    const morning = await createLine({ db, dataDir }, productLineInput({ hour: 9 }));
    const evening = await createLine({ db, dataDir }, topicLineInput({ hour: 18 }));
    await syncSchedules(boss, db);
    const schedules = await boss.getSchedules(TICK_QUEUE);
    expect(
      schedules.map((schedule) => [schedule.key, schedule.cron, schedule.timezone]).sort(),
    ).toEqual(
      [
        [morning.id, '0 9 * * *', 'America/Sao_Paulo'],
        [evening.id, '0 18 * * *', 'America/Sao_Paulo'],
      ].sort(),
    );
    expect(schedules.find((schedule) => schedule.key === morning.id)?.data).toEqual({
      lineId: morning.id,
    });

    await setLineActive(db, morning.id, false);
    await updateLine({ db, dataDir }, evening.id, { hour: 7 });
    expect(await syncSchedules(boss, db)).toEqual({
      scheduled: [evening.id],
      removed: [morning.id],
    });
    expect((await boss.getSchedules(TICK_QUEUE)).map((schedule) => schedule.cron)).toEqual([
      cronFor(7),
    ]);
  });

  it('keeps the schedule of a line the system paused for its budget, not of one Hugo paused', async () => {
    const capped = await createLine({ db, dataDir }, topicLineInput({ name: 'Capped' }));
    await pauseLine(db, capped.id, 'reached its monthly cap');
    const mine = await createLine({ db, dataDir }, productLineInput({ name: 'Mine' }));
    await syncSchedules(boss, db);
    await setLineActive(db, mine.id, false);
    const result = await syncSchedules(boss, db);
    expect(result).toEqual({ scheduled: [capped.id], removed: [mine.id] });
    expect((await boss.getSchedules(TICK_QUEUE)).map((schedule) => schedule.key)).toEqual([
      capped.id,
    ]);
  });
});
