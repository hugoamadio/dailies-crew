import type { SettingsValues } from './schema';

/**
 * Defaults from the spec (section 5). Prices in USD per million tokens, as published on
 * 2026-10-12; check https://platform.claude.com/docs/en/about-claude/pricing before real use.
 * Cache writes cost 1.25 × input (5-minute cache).
 */
export const DEFAULT_SETTINGS: SettingsValues = {
  roles: {
    preparer: { model: 'claude-haiku-5-5', effort: 'low' },
    creator: { model: 'claude-sonnet-5-5', effort: 'medium' },
    judge: { model: 'claude-sonnet-5-5', effort: 'low' },
    scriptwriter: { model: 'claude-sonnet-5-5', effort: 'medium' },
    director: { model: 'claude-opus-5-5', effort: 'high' },
    reviewer: { model: 'claude-opus-5-5', effort: 'medium' },
    social: { model: 'claude-sonnet-5-5', effort: 'low' },
    'rejection-router': { model: 'claude-haiku-5-5', effort: 'low' },
  },
  prices: {
    models: {
      'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
      'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
      'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
    },
    // ElevenLabs bills per character by plan; 0.30 USD per 1000 is an editable estimate
    voicePer1kChars: { elevenlabs: 0.3, fake: 0 },
  },
  globalMonthlyCapUsd: 50,
  defaultHour: 9,
  timezone: 'America/Sao_Paulo',
};
