import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testDb } from './test-db';

const db = testDb();
beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await db.$disconnect();
});

describe('the database schema', () => {
  it('creates a line with a UUID v7 id and UTC timestamps', async () => {
    const before = Date.now();
    const line = await db.productionLine.create({
      data: {
        name: 'Products',
        kind: 'product',
        material: { select: 'all' },
        perDay: 3,
        hour: 9,
        language: 'pt-BR',
        objective: 'sell',
        audience: 'people who like 3D printing',
        tone: 'energetic',
        brand: {},
        voiceProvider: 'fake',
        voiceId: 'demo',
        monthlyCapUsd: 10,
      },
    });
    expect(line.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(line.createdAt.getTime()).toBeGreaterThanOrEqual(before - 5_000);
    expect(line.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 5_000);
  });

  it('keeps one StageRun per video, stage, round and attempt', async () => {
    const line = await db.productionLine.create({
      data: {
        name: 'Topic',
        kind: 'topic',
        material: {},
        perDay: 1,
        hour: 9,
        language: 'pt-BR',
        objective: 'teach',
        audience: 'makers',
        tone: 'calm',
        brand: {},
        voiceProvider: 'fake',
        voiceId: 'demo',
        monthlyCapUsd: 10,
      },
    });
    const video = await db.video.create({ data: { lineId: line.id } });
    expect(video).toMatchObject({ status: 'queued', stage: 'prepare', round: 0, costUsd: 0 });
    const run = {
      videoId: video.id,
      stage: 'prepare' as const,
      round: 0,
      attempt: 1,
      status: 'done' as const,
    };
    await db.stageRun.create({ data: run });
    await expect(db.stageRun.create({ data: run })).rejects.toThrow();
  });
});
