import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LAMP_SVG,
  productInput,
  productLineInput,
  tempDataDir,
  topicLineInput,
} from '../../test/fixtures';
import { testContext } from '../../test/studio';
import { createLine, setLineActive } from '../lines/service';
import { createProduct } from '../products/service';
import { runLineTick } from './tick';

const db = testDb();
let dataDir: string;
beforeEach(async () => {
  await resetDb(db);
  dataDir = await tempDataDir();
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});
afterAll(async () => {
  await db.$disconnect();
});

describe('runLineTick', () => {
  it('queues one video per product of the day, products without a video first', async () => {
    const ctx = testContext(db, dataDir);
    const line = await createLine({ db, dataDir }, productLineInput({ perDay: 2 }));
    const a = await createProduct({ db, dataDir }, productInput({ name: 'A' }), [LAMP_SVG]);
    const b = await createProduct({ db, dataDir }, productInput({ name: 'B' }), [LAMP_SVG]);

    const result = await runLineTick(ctx, line.id);

    expect(result.created).toHaveLength(2);
    const videos = await db.video.findMany({ orderBy: { createdAt: 'asc' } });
    expect(videos.map((video) => video.productId).sort()).toEqual([a.id, b.id].sort());
    expect(videos.every((video) => video.status === 'queued' && video.stage === 'prepare')).toBe(
      true,
    );
    expect(ctx.queue.jobs).toEqual(
      result.created.map((videoId) => ({ stage: 'prepare', videoId })),
    );
  });

  it('makes the number asked for by run-now, and one video per slot for a topic line', async () => {
    const ctx = testContext(db, dataDir);
    const line = await createLine({ db, dataDir }, topicLineInput());
    expect((await runLineTick(ctx, line.id, { count: 3 })).created).toHaveLength(3);
    expect(await db.video.count({ where: { productId: null } })).toBe(3);
  });

  it('warns on the line instead of inventing material', async () => {
    const ctx = testContext(db, dataDir);
    const line = await createLine({ db, dataDir }, productLineInput());
    expect(await runLineTick(ctx, line.id)).toEqual({
      created: [],
      skipped: 'Nothing to show: no active product exists',
    });
    expect((await db.productionLine.findUniqueOrThrow({ where: { id: line.id } })).warning).toBe(
      'Nothing to show: no active product exists',
    );
    // the warning goes away with the next run that makes videos
    await createProduct({ db, dataDir }, productInput(), [LAMP_SVG]);
    await runLineTick(ctx, line.id);
    expect(
      (await db.productionLine.findUniqueOrThrow({ where: { id: line.id } })).warning,
    ).toBeNull();
  });

  it('makes nothing for a paused line, a line over its cap, or a daily run delivered twice', async () => {
    const ctx = testContext(db, dataDir);
    const line = await createLine({ db, dataDir }, topicLineInput());
    expect((await runLineTick(ctx, line.id, { tickJobId: 'job-1' })).created).toHaveLength(1);
    expect(await runLineTick(ctx, line.id, { tickJobId: 'job-1' })).toEqual({
      created: [],
      skipped: 'this daily run already made its videos',
    });

    await setLineActive(db, line.id, false);
    expect((await runLineTick(ctx, line.id)).skipped).toBe('line "3D printing tips" is paused');

    const capped = await createLine(
      { db, dataDir },
      topicLineInput({ name: 'Capped', monthlyCapUsd: 0 }),
    );
    expect((await runLineTick(ctx, capped.id)).skipped).toContain('reached its monthly cap');
    expect((await db.productionLine.findUniqueOrThrow({ where: { id: capped.id } })).active).toBe(
      false,
    );
    expect(await db.video.count()).toBe(1);
  });
});
