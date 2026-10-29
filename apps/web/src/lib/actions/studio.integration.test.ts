import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { createLine, getSettings, setGlobalWarning } from '@dailies-crew/studio';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDataDir, topicLineInput } from '../../../../../packages/studio/test/fixtures';
import { t, testPanel } from '../../test/panel';
import { resumeAll, retry } from './studio';

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

describe('resume and try again', () => {
  it('"Resume" clears the warning, turns the stopped lines on and queues the waiting videos', async () => {
    const panel = testPanel(db, dataDir);
    const line = await createLine(panel.ctx, topicLineInput());
    await setGlobalWarning(db, 'the API key was refused', new Date());
    await db.productionLine.update({
      where: { id: line.id },
      data: { active: false, pausedReason: 'the API key was refused' },
    });
    const waiting = await db.video.create({
      data: { lineId: line.id, status: 'failed', failureKind: 'auth', stage: 'script' },
    });
    expect(await resumeAll(panel, t)).toEqual({
      status: 'ok',
      message: 'Resumed: 1 lines on, 1 videos queued again.',
    });
    expect((await getSettings(db)).warning).toBeNull();
    expect(panel.ctx.queue.jobs).toEqual([{ stage: 'script', videoId: waiting.id }]);
    expect(panel.syncs).toBe(1);
  });

  it('"Try again" queues a failed video at its stage', async () => {
    const panel = testPanel(db, dataDir);
    const line = await createLine(panel.ctx, topicLineInput());
    const video = await db.video.create({
      data: { lineId: line.id, status: 'failed', failureKind: 'interrupted', stage: 'produce' },
    });
    expect(await retry(panel, video.id, t)).toEqual({
      status: 'ok',
      message: 'Queued again at Voice and render.',
    });
    expect(panel.ctx.queue.jobs).toEqual([{ stage: 'produce', videoId: video.id }]);
  });
});
