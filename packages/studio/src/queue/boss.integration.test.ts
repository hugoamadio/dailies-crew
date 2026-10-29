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
import { sweepStuckVideos } from './sweep';
import { testContext } from '../../test/studio';

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

describe('sweepStuckVideos', () => {
  async function video(data: Record<string, unknown>) {
    const line = await createLine({ db, dataDir }, topicLineInput());
    return db.video.create({ data: { lineId: line.id, ...data } });
  }

  it('fails a video with no live job, so "crew retry" can free it', async () => {
    const ctx = testContext(db, dataDir, { queue: new BossQueue(boss) });
    const stuck = await video({ status: 'running', stage: 'produce' });
    const result = await sweepStuckVideos(ctx, boss);
    expect(result).toEqual({ requeued: [], failed: [stuck.id] });
    expect(await db.video.findUniqueOrThrow({ where: { id: stuck.id } })).toMatchObject({
      status: 'failed',
      failureKind: 'interrupted',
    });
  });

  it('queues the stage again when it was done but its result was never applied', async () => {
    const ctx = testContext(db, dataDir, { queue: new BossQueue(boss) });
    const stuck = await video({ status: 'running', stage: 'script', round: 1 });
    await db.stageRun.create({
      data: {
        videoId: stuck.id,
        stage: 'script',
        round: 1,
        attempt: 1,
        status: 'done',
        output: { outcome: { kind: 'next' } },
      },
    });
    const result = await sweepStuckVideos(ctx, boss);
    expect(result).toEqual({ requeued: [stuck.id], failed: [] });
    expect((await boss.findJobs(STAGE_QUEUES.script)).map((job) => job.data)).toEqual([
      { videoId: stuck.id },
    ]);
    expect((await db.video.findUniqueOrThrow({ where: { id: stuck.id } })).status).toBe('running');
    // the job it queued is alive: a second sweep leaves it alone
    expect(await sweepStuckVideos(ctx, boss)).toEqual({ requeued: [], failed: [] });
  });

  it('leaves alone a video with a waiting or running job, and those not in production', async () => {
    const ctx = testContext(db, dataDir, { queue: new BossQueue(boss) });
    const waiting = await video({ status: 'queued', stage: 'prepare' });
    await new BossQueue(boss).enqueue('prepare', waiting.id);
    const active = await video({ status: 'running', stage: 'ideas' });
    await new BossQueue(boss).enqueue('ideas', active.id);
    const fetched = await boss.fetch(STAGE_QUEUES.ideas);
    expect(fetched).toHaveLength(1);
    const failed = await video({ status: 'failed', stage: 'produce' });
    const ready = await video({ status: 'ready_for_review', stage: 'social' });

    expect(await sweepStuckVideos(ctx, boss)).toEqual({ requeued: [], failed: [] });
    for (const [each, status] of [
      [waiting, 'queued'],
      [active, 'running'],
      [failed, 'failed'],
      [ready, 'ready_for_review'],
    ] as const) {
      expect((await db.video.findUniqueOrThrow({ where: { id: each.id } })).status).toBe(status);
    }
  });
});
