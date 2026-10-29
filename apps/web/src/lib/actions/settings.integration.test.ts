import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { getSettings, StudioError } from '@dailies-crew/studio';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDataDir } from '../../../../../packages/studio/test/fixtures';
import { formOf, t, testPanel } from '../../test/panel';
import { loadSettings } from '../loaders/settings';
import { failure } from './result';
import { saveSettings } from './settings';

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

/** The settings form exactly as the page fills it, with some fields changed */
async function settingsForm(changes: Record<string, string>) {
  const { values } = await loadSettings(db, {});
  const fields: Record<string, string> = {
    defaultHour: String(values.defaultHour),
    timezone: values.timezone,
    globalMonthlyCapUsd: String(values.globalMonthlyCapUsd),
    'prices.voicePer1kChars.elevenlabs': String(values.prices.voicePer1kChars.elevenlabs),
    'prices.voicePer1kChars.fake': String(values.prices.voicePer1kChars.fake),
    'newModel.name': '',
  };
  for (const [role, config] of Object.entries(values.roles)) {
    fields[`roles.${role}.model`] = config.model;
    fields[`roles.${role}.effort`] = config.effort;
  }
  for (const [model, price] of Object.entries(values.prices.models)) {
    for (const [key, value] of Object.entries(price))
      fields[`prices.models.${model}.${key}`] = String(value);
  }
  return formOf({ ...fields, ...changes });
}

describe('settings', () => {
  it('saves the form and syncs the schedules (a new time zone moves the daily runs)', async () => {
    const panel = testPanel(db, dataDir);
    const state = await saveSettings(
      panel,
      await settingsForm({
        timezone: 'Europe/Lisbon',
        globalMonthlyCapUsd: '80',
        'roles.director.effort': 'max',
        'prices.models.claude-opus-5-5.output': '25',
      }),
      t,
    );
    expect(state).toEqual({
      status: 'ok',
      message: 'Settings saved; the daily schedules follow them.',
    });
    expect(panel.syncs).toBe(1);
    const settings = await getSettings(db);
    expect(settings).toMatchObject({ timezone: 'Europe/Lisbon', globalMonthlyCapUsd: 80 });
    expect(settings.roles.director.effort).toBe('max');
    expect(settings.prices.models['claude-opus-5-5']?.output).toBe(25);
  });

  it('keeps a stored zone the browser list does not know', async () => {
    const panel = testPanel(db, dataDir);
    await saveSettings(panel, await settingsForm({ timezone: 'UTC' }), t);
    expect((await getSettings(db)).timezone).toBe('UTC');
    await saveSettings(panel, await settingsForm({ timezone: 'Asia/Kolkata' }), t);
    expect((await getSettings(db)).timezone).toBe('Asia/Kolkata');
  });

  it('saves nothing and names the field when a value is wrong', async () => {
    const panel = testPanel(db, dataDir);
    const error = await saveSettings(
      panel,
      await settingsForm({ defaultHour: '25', 'prices.models.claude-haiku-5-5.input': 'cheap' }),
      t,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StudioError);
    const state = failure(error, 'unexpected');
    expect(state.status === 'error' && Object.keys(state.fields).sort()).toEqual([
      'defaultHour',
      'prices.models.claude-haiku-5-5.input',
    ]);
    expect((await getSettings(db)).defaultHour).toBe(9);
    expect(panel.syncs).toBe(0);
  });

  it('adds a model with its prices and lets a role use it', async () => {
    const panel = testPanel(db, dataDir);
    await saveSettings(
      panel,
      await settingsForm({
        'newModel.name': 'claude-fable-5-1',
        'newModel.input': '1',
        'newModel.output': '5',
        'newModel.cacheRead': '0.1',
        'newModel.cacheWrite': '1.25',
        'roles.social.model': 'claude-fable-5-1',
      }),
      t,
    );
    expect((await getSettings(db)).roles.social.model).toBe('claude-fable-5-1');
  });

  it('says whether each key is configured, never what it is', async () => {
    const data = await loadSettings(db, {
      ANTHROPIC_API_KEY: 'sk-ant-secret',
      DAILIES_FAKE_AI: '1',
    });
    expect(data.keys).toEqual({
      anthropic: true,
      elevenlabs: false,
      fakeAi: true,
      realVoice: false,
    });
    expect(JSON.stringify(data)).not.toContain('sk-ant-secret');
    expect(data.timezones).toContain('America/Sao_Paulo');
  });
});
