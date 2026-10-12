import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getSettings } from '../settings/service';
import { checkBudget, recordLlmCost, recordVoiceCost, spendBetween } from './service';

const db = testDb();
beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await db.$disconnect();
});

async function makeLine(name: string, monthlyCapUsd: number) {
  return db.productionLine.create({
    data: {
      name,
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
      monthlyCapUsd,
    },
  });
}

describe('cost service', () => {
  it('records a Claude call and adds it to the video total', async () => {
    const settings = await getSettings(db);
    const line = await makeLine('A', 10);
    const video = await db.video.create({ data: { lineId: line.id } });
    const usd = await recordLlmCost(db, settings, {
      lineId: line.id,
      videoId: video.id,
      stage: 'direction',
      role: 'director',
      requestedModel: 'claude-opus-5-5',
      model: 'claude-opus-5-5',
      usage: { inputTokens: 10_000, outputTokens: 2_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    });
    expect(usd).toBe(0.08);
    expect(await db.costEntry.findFirstOrThrow()).toMatchObject({
      role: 'director',
      model: 'claude-opus-5-5',
      inputTokens: 10_000,
      outputTokens: 2_000,
      usd: 0.08,
    });
    expect((await db.video.findUniqueOrThrow({ where: { id: video.id } })).costUsd).toBe(0.08);
  });

  it('records the voice per thousand characters', async () => {
    const settings = await getSettings(db);
    const line = await makeLine('A', 10);
    const video = await db.video.create({ data: { lineId: line.id } });
    const usd = await recordVoiceCost(db, settings, {
      lineId: line.id,
      videoId: video.id,
      provider: 'elevenlabs',
      characters: 1000,
    });
    expect(usd).toBe(0.3);
    expect(await db.costEntry.findFirstOrThrow()).toMatchObject({
      stage: 'produce',
      role: 'voice',
      model: 'elevenlabs',
      voiceCharacters: 1000,
    });
  });

  it('checks this month only, per line and globally', async () => {
    const settings = await getSettings(db);
    const a = await makeLine('A', 1);
    const b = await makeLine('B', 100);
    const now = new Date('2026-10-12T15:00:00Z');
    const entry = (lineId: string, usd: number, createdAt: Date) => ({
      lineId,
      role: 'director',
      model: 'claude-opus-5-5',
      usd,
      createdAt,
    });
    await db.costEntry.createMany({
      data: [
        entry(a.id, 0.6, new Date('2026-10-02T12:00:00Z')),
        entry(a.id, 5, new Date('2026-09-30T12:00:00Z')), // last month
        entry(b.id, 0.5, new Date('2026-10-05T12:00:00Z')),
      ],
    });
    expect(await spendBetween(db, { since: new Date('2026-10-01T03:00:00Z'), lineId: a.id })).toBe(
      0.6,
    );
    expect(await checkBudget(db, settings, a, now)).toEqual({ ok: true });

    await db.costEntry.create({ data: entry(a.id, 0.4, new Date('2026-10-10T12:00:00Z')) });
    expect(await checkBudget(db, settings, a, now)).toEqual({
      ok: false,
      reason: 'line "A" reached its monthly cap of 1.00 USD (1.00 USD spent this month)',
    });
    expect(await checkBudget(db, settings, b, now)).toEqual({ ok: true });
  });
});
