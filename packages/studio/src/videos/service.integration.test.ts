import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDataDir, topicLineInput } from '../../test/fixtures';
import { testContext } from '../../test/studio';
import { createLine } from '../lines/service';
import { getSettings, setGlobalWarning } from '../settings/service';
import { costsReport, resumeStudio, retryVideo, studioStatus } from './service';

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

describe('retryVideo', () => {
  it('queues a failed video at its stage again, and refuses a running one', async () => {
    const ctx = testContext(db, dataDir);
    const line = await createLine({ db, dataDir }, topicLineInput());
    const video = await db.video.create({
      data: {
        lineId: line.id,
        status: 'failed',
        stage: 'direction',
        failureReason: 'x',
        failureKind: 'unknown',
      },
    });
    expect(await retryVideo(ctx, video.id)).toMatchObject({
      status: 'queued',
      failureReason: null,
    });
    expect(ctx.queue.jobs).toEqual([{ stage: 'direction', videoId: video.id }]);
    await expect(retryVideo(ctx, video.id)).rejects.toThrow(
      'only a failed video can be tried again',
    );
  });
});

describe('resumeStudio', () => {
  it('after a refused key: clears the warning, turns the lines back on, queues the waiting videos', async () => {
    const ctx = testContext(db, dataDir);
    const line = await createLine({ db, dataDir }, topicLineInput());
    await setGlobalWarning(db, 'the API key was refused', new Date());
    await db.productionLine.update({
      where: { id: line.id },
      data: { active: false, pausedReason: 'the API key was refused' },
    });
    const stopped = await db.video.create({
      data: { lineId: line.id, status: 'failed', stage: 'script', failureKind: 'auth' },
    });
    const capped = await db.video.create({
      data: { lineId: line.id, status: 'paused_budget', stage: 'produce' },
    });
    const broken = await db.video.create({
      data: { lineId: line.id, status: 'failed', stage: 'review', failureKind: 'refusal' },
    });

    await expect(resumeStudio(ctx, { lineId: line.id })).rejects.toThrow('Everything is stopped');
    expect(await resumeStudio(ctx)).toEqual({ lines: 1, videos: 2 });

    expect((await getSettings(db)).warning).toBeNull();
    expect(await db.productionLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({
      active: true,
      pausedReason: null,
    });
    expect(ctx.queue.jobs.sort((a, b) => a.stage.localeCompare(b.stage))).toEqual([
      { stage: 'produce', videoId: capped.id },
      { stage: 'script', videoId: stopped.id },
    ]);
    expect((await db.video.findUniqueOrThrow({ where: { id: broken.id } })).status).toBe('failed');
  });

  it('leaves alone a line Hugo paused himself', async () => {
    const ctx = testContext(db, dataDir);
    const line = await createLine({ db, dataDir }, topicLineInput({ active: false }));
    expect(await resumeStudio(ctx)).toEqual({ lines: 0, videos: 0 });
    expect((await db.productionLine.findUniqueOrThrow({ where: { id: line.id } })).active).toBe(
      false,
    );
  });
});

describe('reports', () => {
  it('sums this month per line and per role, and counts the videos by status', async () => {
    const line = await createLine({ db, dataDir }, topicLineInput());
    const now = new Date('2026-10-12T15:00:00Z');
    await db.video.create({
      data: { lineId: line.id, status: 'ready_for_review', createdAt: now },
    });
    await db.costEntry.createMany({
      data: [
        { lineId: line.id, role: 'director', model: 'claude-opus-5-5', usd: 0.5, createdAt: now },
        { lineId: line.id, role: 'voice', model: 'elevenlabs', usd: 0.25, createdAt: now },
        {
          lineId: line.id,
          role: 'director',
          model: 'claude-opus-5-5',
          usd: 9,
          createdAt: new Date('2026-09-10T12:00:00Z'),
        },
      ],
    });
    expect(await costsReport(db, now)).toMatchObject({
      month: '2026-10',
      totalUsd: 0.75,
      videos: 1,
      perVideoUsd: 0.75,
      lines: [{ line: '3D printing tips', usd: 0.75 }],
    });
    expect((await costsReport(db, now, '2026-09')).totalUsd).toBe(9);
    const status = await studioStatus(db, now);
    expect(status).toMatchObject({ monthSpend: 0.75, videos: { ready_for_review: 1 } });
    expect(status.lines[0]).toMatchObject({
      name: '3D printing tips',
      monthSpend: 0.75,
      monthlyCapUsd: 10,
    });
  });
});
