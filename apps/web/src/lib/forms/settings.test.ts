import { DEFAULT_SETTINGS, SettingsPatchSchema } from '@dailies-crew/studio';
import { describe, expect, it } from 'vitest';
import { settingsFromForm } from './settings';

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

describe('settingsFromForm', () => {
  it('reads every role, every model price and a new model', () => {
    const entries: [string, string][] = [
      ['defaultHour', '8'],
      ['timezone', 'America/Sao_Paulo'],
      ['globalMonthlyCapUsd', '75'],
      ['prices.voicePer1kChars.elevenlabs', '0.3'],
      ['prices.voicePer1kChars.fake', '0'],
      ['newModel.name', 'claude-fable-5-1'],
      ['newModel.input', '1'],
      ['newModel.output', '5'],
      ['newModel.cacheRead', '0.1'],
      ['newModel.cacheWrite', '1.25'],
    ];
    for (const [role, config] of Object.entries(DEFAULT_SETTINGS.roles)) {
      entries.push([`roles.${role}.model`, config.model], [`roles.${role}.effort`, config.effort]);
    }
    for (const [model, price] of Object.entries(DEFAULT_SETTINGS.prices.models)) {
      for (const [key, value] of Object.entries(price)) {
        entries.push([`prices.models.${model}.${key}`, String(value)]);
      }
    }
    const patch = SettingsPatchSchema.parse(settingsFromForm(form(entries)));
    expect(patch.roles).toEqual(DEFAULT_SETTINGS.roles);
    expect(patch.prices?.models).toEqual({
      ...DEFAULT_SETTINGS.prices.models,
      'claude-fable-5-1': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
    });
    expect(patch).toMatchObject({ defaultHour: 8, globalMonthlyCapUsd: 75 });
  });
});
