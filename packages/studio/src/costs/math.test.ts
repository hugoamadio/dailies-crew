import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { budgetVerdict, llmUsd, priceFor, voiceUsd } from './math';

const { prices } = DEFAULT_SETTINGS;

describe('llmUsd', () => {
  it('prices every kind of token per million', () => {
    const usage = {
      inputTokens: 10_000,
      outputTokens: 2_000,
      cacheReadTokens: 50_000,
      cacheWriteTokens: 4_000,
    };
    // 10k × 4 + 2k × 20 + 50k × 0.2 + 4k × 5 = 40k + 40k + 10k + 20k = 110k micro-dollars
    expect(llmUsd(usage, prices.models['claude-opus-5-5']!)).toBe(0.11);
  });

  it('rounds to the micro-dollar', () => {
    const usage = { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(llmUsd(usage, prices.models['claude-haiku-5-5']!)).toBe(0);
  });
});

describe('voiceUsd', () => {
  it('prices characters per thousand', () => {
    expect(voiceUsd(1500, 0.3)).toBe(0.45);
    expect(voiceUsd(1500, 0)).toBe(0);
  });
});

describe('priceFor', () => {
  it('uses the answering model, or the requested one when a fallback model has no price', () => {
    expect(priceFor(prices, 'claude-sonnet-5-5', 'claude-opus-5-5').input).toBe(2);
    expect(priceFor(prices, 'claude-opus-4-8', 'claude-opus-5-5').input).toBe(4);
  });

  it('names a model without a price', () => {
    expect(() => priceFor(prices, 'x', 'claude-unknown')).toThrow(
      'The settings have no price for model "claude-unknown"',
    );
  });
});

describe('budgetVerdict', () => {
  const base = { lineName: 'Products', lineCap: 10, globalCap: 50 };

  it('lets a line under both caps run', () => {
    expect(budgetVerdict({ ...base, lineSpend: 9.99, globalSpend: 20 })).toEqual({ ok: true });
  });

  it('stops a line that reached its own cap', () => {
    expect(budgetVerdict({ ...base, lineSpend: 10, globalSpend: 20 })).toEqual({
      ok: false,
      reason: 'line "Products" reached its monthly cap of 10.00 USD (10.00 USD spent this month)',
    });
  });

  it('stops every line once the global cap is reached', () => {
    expect(budgetVerdict({ ...base, lineSpend: 0, globalSpend: 50.5 })).toEqual({
      ok: false,
      reason: 'the global monthly cap of 50.00 USD is reached (50.50 USD spent this month)',
    });
  });

  it('treats a cap of zero as "spend nothing"', () => {
    expect(budgetVerdict({ ...base, lineCap: 0, lineSpend: 0, globalSpend: 0 }).ok).toBe(false);
  });
});
