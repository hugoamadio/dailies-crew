import { ROLE_NAMES, StudioError } from '@dailies-crew/studio';
import { num, text } from './read';
import { PRICE_KEYS } from './settings-prices';

const MODEL_PRICE = /^prices\.models\.(.+)\.(input|output|cacheRead|cacheWrite)$/;

/** The settings form as the patch updateSettings takes (every field of the form is sent) */
export function settingsFromForm(
  form: FormData,
  modelExists = 'A model with this id already exists',
): Record<string, unknown> {
  const models: Record<string, Record<string, number | undefined>> = {};
  for (const key of form.keys()) {
    const match = MODEL_PRICE.exec(key);
    if (match) (models[match[1]!] ??= {})[match[2]!] = num(form, key);
  }
  const added = text(form, 'newModel.name');
  if (added) {
    // a new row named like a listed model would silently replace that model's prices
    if (Object.hasOwn(models, added)) {
      throw new StudioError(modelExists, [{ path: 'newModel.name', message: modelExists }]);
    }
    models[added] = Object.fromEntries(
      PRICE_KEYS.map((key) => [key, num(form, `newModel.${key}`)]),
    );
  }
  return {
    defaultHour: num(form, 'defaultHour'),
    timezone: text(form, 'timezone'),
    globalMonthlyCapUsd: num(form, 'globalMonthlyCapUsd'),
    roles: Object.fromEntries(
      ROLE_NAMES.map((role) => [
        role,
        { model: text(form, `roles.${role}.model`), effort: text(form, `roles.${role}.effort`) },
      ]),
    ),
    prices: {
      models,
      voicePer1kChars: {
        elevenlabs: num(form, 'prices.voicePer1kChars.elevenlabs'),
        fake: num(form, 'prices.voicePer1kChars.fake'),
      },
    },
  };
}
