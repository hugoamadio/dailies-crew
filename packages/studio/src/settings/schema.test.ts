import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { SettingsSchema } from './schema';

describe('SettingsSchema', () => {
  it('accepts the defaults', () => {
    expect(SettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('refuses a role model without a price', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      roles: { ...DEFAULT_SETTINGS.roles, director: { model: 'claude-fable-5-1', effort: 'high' } },
    };
    const result = SettingsSchema.safeParse(settings);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'model "claude-fable-5-1" (role director) has no price',
    );
  });

  it('refuses an unknown time zone and an unknown effort', () => {
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, timezone: 'Mars/Base' }).success).toBe(
      false,
    );
    const roles = {
      ...DEFAULT_SETTINGS.roles,
      judge: { model: 'claude-sonnet-5-5', effort: 'huge' },
    };
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, roles }).success).toBe(false);
  });
});
