import { type Db, Prisma } from '@dailies-crew/db';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { clearGlobalWarning, getSettings, setGlobalWarning, updateSettings } from './service';

const db = testDb();
beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await db.$disconnect();
});

describe('settings service', () => {
  it('creates the defaults on first read', async () => {
    const settings = await getSettings(db);
    expect(settings).toMatchObject(DEFAULT_SETTINGS);
    expect(settings.warning).toBeNull();
    expect(await db.settings.count()).toBe(1);
  });

  it('reads the row another process just created when its own create loses the race', async () => {
    await getSettings(db);
    // as if a second process had created the row between this upsert's read and its insert
    const racing = {
      settings: {
        upsert: () =>
          Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          ),
        findUniqueOrThrow: (args: { where: { id: number } }) => db.settings.findUniqueOrThrow(args),
      },
    } as unknown as Db;
    expect(await getSettings(racing)).toMatchObject(DEFAULT_SETTINGS);
  });

  it('merges a patch role by role and price by price', async () => {
    const settings = await updateSettings(db, {
      roles: { director: { model: 'claude-sonnet-5-5', effort: 'high' } },
      prices: {
        models: { 'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 } },
      },
      globalMonthlyCapUsd: 80,
    });
    expect(settings.roles.director).toEqual({ model: 'claude-sonnet-5-5', effort: 'high' });
    expect(settings.roles.preparer).toEqual(DEFAULT_SETTINGS.roles.preparer);
    expect(Object.keys(settings.prices.models)).toContain('claude-opus-4-8');
    expect(settings.prices.models['claude-opus-5-5']).toEqual(
      DEFAULT_SETTINGS.prices.models['claude-opus-5-5'],
    );
    expect((await getSettings(db)).globalMonthlyCapUsd).toBe(80);
  });

  it('saves nothing when the result would be invalid', async () => {
    await expect(
      updateSettings(db, { roles: { director: { model: 'claude-new', effort: 'high' } } }),
    ).rejects.toThrow('model "claude-new" (role director) has no price');
    expect((await getSettings(db)).roles.director).toEqual(DEFAULT_SETTINGS.roles.director);
  });

  it('sets and clears the global warning', async () => {
    const now = new Date('2026-10-12T15:00:00Z');
    await setGlobalWarning(db, 'The Claude API refused the key', now);
    expect(await getSettings(db)).toMatchObject({
      warning: 'The Claude API refused the key',
      warningAt: now,
    });
    await clearGlobalWarning(db);
    expect((await getSettings(db)).warning).toBeNull();
  });
});
