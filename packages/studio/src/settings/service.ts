import { type Db, Prisma, type Settings } from '@dailies-crew/db';
import { parseInput } from '../errors';
import { DEFAULT_SETTINGS } from './defaults';
import {
  SettingsPatchSchema,
  SettingsSchema,
  type SettingsValues,
  type StudioSettings,
} from './schema';

function fromRow(row: Settings): StudioSettings {
  const values = SettingsSchema.parse({
    // a role added in a later version gets its default
    roles: { ...DEFAULT_SETTINGS.roles, ...(row.roles as object) },
    prices: row.prices,
    globalMonthlyCapUsd: row.globalMonthlyCapUsd,
    defaultHour: row.defaultHour,
    timezone: row.timezone,
  });
  return { ...values, warning: row.warning, warningAt: row.warningAt };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * The settings row, created with the defaults on first use. Two first reads at once (the panel
 * loads a page and its layout together) both try to create it: the loser reads the winner's row.
 */
export async function getSettings(db: Db): Promise<StudioSettings> {
  const row = await db.settings
    .upsert({ where: { id: 1 }, create: { id: 1, ...DEFAULT_SETTINGS }, update: {} })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) return db.settings.findUniqueOrThrow({ where: { id: 1 } });
      throw error;
    });
  return fromRow(row);
}

/** Merges the patch (roles and prices key by key) and saves it if the result is valid */
export async function updateSettings(db: Db, patch: unknown): Promise<StudioSettings> {
  const parsed = parseInput(SettingsPatchSchema, patch, 'settings');
  const current = await getSettings(db);
  const next: SettingsValues = parseInput(
    SettingsSchema,
    {
      roles: { ...current.roles, ...parsed.roles },
      prices: {
        models: { ...current.prices.models, ...parsed.prices?.models },
        voicePer1kChars: { ...current.prices.voicePer1kChars, ...parsed.prices?.voicePer1kChars },
      },
      globalMonthlyCapUsd: parsed.globalMonthlyCapUsd ?? current.globalMonthlyCapUsd,
      defaultHour: parsed.defaultHour ?? current.defaultHour,
      timezone: parsed.timezone ?? current.timezone,
    },
    'settings',
  );
  const row = await db.settings.update({ where: { id: 1 }, data: next });
  return fromRow(row);
}

export async function setGlobalWarning(db: Db, warning: string, now: Date): Promise<void> {
  await getSettings(db);
  await db.settings.update({ where: { id: 1 }, data: { warning, warningAt: now } });
}

export async function clearGlobalWarning(db: Db): Promise<void> {
  await getSettings(db);
  await db.settings.update({ where: { id: 1 }, data: { warning: null, warningAt: null } });
}
