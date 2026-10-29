import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { createLine, setLineActive } from '@dailies-crew/studio';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDataDir, topicLineInput } from '../../../../../packages/studio/test/fixtures';
import { loadToday } from './today';

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

// 10:00 in São Paulo on October 12; "today" started at 03:00Z
const NOW = new Date('2026-10-12T13:00:00Z');
const at = (iso: string) => new Date(iso);

describe('loadToday', () => {
  it('groups today and every unfinished video, telling waiting videos from failed ones', async () => {
    const line = await createLine({ db, dataDir }, topicLineInput({ hour: 9 }));
    const video = (data: Record<string, unknown>) =>
      db.video.create({ data: { lineId: line.id, ...data } }).then((row) => row.id);
    const running = await video({
      status: 'running',
      stage: 'script',
      createdAt: at('2026-10-12T12:00:00Z'),
    });
    const oldQueued = await video({ status: 'queued', createdAt: at('2026-10-10T12:00:00Z') });
    const ready = await video({
      status: 'ready_for_review',
      stage: 'social',
      createdAt: at('2026-10-11T12:00:00Z'),
    });
    const needsYou = await video({ status: 'needs_you', stage: 'review' });
    const keyStop = await video({ status: 'failed', failureKind: 'auth', stage: 'script' });
    const capStop = await video({ status: 'paused_budget', stage: 'produce' });
    const broken = await video({
      status: 'failed',
      failureKind: 'interrupted',
      failureReason: 'stopped',
    });
    const approvedToday = await video({
      status: 'approved',
      createdAt: at('2026-10-12T04:00:00Z'),
    });
    await video({ status: 'approved', createdAt: at('2026-10-11T12:00:00Z') });
    await video({
      status: 'failed',
      failureKind: 'unknown',
      createdAt: at('2026-09-01T12:00:00Z'),
      updatedAt: at('2026-09-01T12:00:00Z'),
    });

    const today = await loadToday(db, NOW);
    const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();
    expect(ids(today.groups.inProduction)).toEqual([running, oldQueued].sort());
    expect(ids(today.groups.ready)).toEqual([ready]);
    expect(ids(today.groups.needsYou)).toEqual([needsYou]);
    expect(today.groups.waiting.map((row) => [row.id, row.why]).sort()).toEqual(
      [
        [keyStop, 'key'],
        [capStop, 'cap'],
      ].sort(),
    );
    expect(ids(today.groups.failed)).toEqual([broken]);
    expect(ids(today.groups.decided)).toEqual([approvedToday]);
    expect(today.groups.ready[0]).toMatchObject({ title: line.name, lineName: line.name });
    expect(today.live).toBe(true);
  });

  it('keeps a video made yesterday and decided today, and a waiting video of any age', async () => {
    const line = await createLine({ db, dataDir }, topicLineInput({ hour: 9 }));
    const old = at('2026-09-01T12:00:00Z');
    const video = (data: Record<string, unknown>) =>
      db.video.create({ data: { lineId: line.id, ...data } }).then((row) => row.id);
    const decidedToday = await video({
      status: 'approved',
      createdAt: at('2026-10-11T12:00:00Z'),
      decidedAt: at('2026-10-12T11:00:00Z'),
    });
    await video({
      status: 'approved',
      createdAt: at('2026-10-11T12:00:00Z'),
      decidedAt: at('2026-10-11T13:00:00Z'),
    });
    const oldWaiting = await video({
      status: 'failed',
      failureKind: 'credit',
      createdAt: old,
      updatedAt: old,
    });
    await video({ status: 'failed', failureKind: 'unknown', createdAt: old, updatedAt: old });

    const today = await loadToday(db, NOW);
    expect(today.groups.decided.map((row) => row.id)).toEqual([decidedToday]);
    expect(today.groups.waiting.map((row) => row.id)).toEqual([oldWaiting]);
    expect(today.groups.failed).toEqual([]);
  });

  it('gives the month spending and the next run of each line that is on', async () => {
    const morning = await createLine({ db, dataDir }, topicLineInput({ name: 'Morning', hour: 9 }));
    await createLine({ db, dataDir }, topicLineInput({ name: 'Evening', hour: 20 }));
    const off = await createLine({ db, dataDir }, topicLineInput({ name: 'Off', hour: 11 }));
    await setLineActive(db, off.id, false);
    await db.costEntry.create({
      data: {
        lineId: morning.id,
        role: 'director',
        model: 'claude-opus-5-5',
        usd: 1.25,
        createdAt: NOW,
      },
    });

    const today = await loadToday(db, NOW);
    expect(today.monthSpend).toBe(1.25);
    expect(today.globalCapUsd).toBe(50);
    expect(today.month).toEqual({ year: 2026, month: 10 });
    expect(today.nextRuns.map((run) => [run.name, run.at.toISOString()])).toEqual([
      ['Evening', '2026-10-12T23:00:00.000Z'],
      ['Morning', '2026-10-13T12:00:00.000Z'],
    ]);
    expect(today.lines.find((line) => line.id === morning.id)?.monthSpend).toBe(1.25);
    expect(today.live).toBe(false);
  });
});
