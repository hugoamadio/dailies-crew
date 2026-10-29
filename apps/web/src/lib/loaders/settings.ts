import 'server-only';
import type { Db } from '@dailies-crew/db';
import { EFFORTS, getSettings, ROLE_NAMES } from '@dailies-crew/studio';
import { keyStatus } from '../keys';

/** The settings page: the values, the key status (never a key) and the choices */
export async function loadSettings(db: Db, env: Record<string, string | undefined>) {
  const settings = await getSettings(db);
  return {
    values: {
      roles: settings.roles,
      prices: settings.prices,
      globalMonthlyCapUsd: settings.globalMonthlyCapUsd,
      defaultHour: settings.defaultHour,
      timezone: settings.timezone,
    },
    keys: keyStatus(env),
    roleNames: [...ROLE_NAMES],
    efforts: [...EFFORTS],
    timezones: Intl.supportedValuesOf('timeZone'),
  };
}

export type LoadedSettings = Awaited<ReturnType<typeof loadSettings>>;
