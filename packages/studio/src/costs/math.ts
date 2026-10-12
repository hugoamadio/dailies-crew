import type { ModelPrice, Prices } from '../settings/schema';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

/** Rounded to the micro-dollar, so sums stay readable */
export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Cost of one Claude call; prices are USD per million tokens */
export function llmUsd(usage: TokenUsage, price: ModelPrice): number {
  return roundUsd(
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
      1_000_000,
  );
}

/** Cost of a voice synthesis; the price is USD per 1000 characters */
export function voiceUsd(characters: number, pricePer1k: number): number {
  return roundUsd((characters * pricePer1k) / 1000);
}

/**
 * The price of the model that answered. A server-side fallback can answer with a model missing
 * from the table: the requested model's price is used then (settings always price every role's
 * model).
 */
export function priceFor(
  prices: Prices,
  answeredModel: string,
  requestedModel: string,
): ModelPrice {
  const price = prices.models[answeredModel] ?? prices.models[requestedModel];
  if (!price) throw new Error(`The settings have no price for model "${requestedModel}"`);
  return price;
}

export type BudgetVerdict = { ok: true } | { ok: false; reason: string };

/** Spending is checked before every paid stage: reaching a cap stops the line */
export function budgetVerdict(input: {
  lineName: string;
  lineSpend: number;
  lineCap: number;
  globalSpend: number;
  globalCap: number;
}): BudgetVerdict {
  if (input.globalSpend >= input.globalCap) {
    return {
      ok: false,
      reason: `the global monthly cap of ${input.globalCap.toFixed(2)} USD is reached (${input.globalSpend.toFixed(2)} USD spent this month)`,
    };
  }
  if (input.lineSpend >= input.lineCap) {
    return {
      ok: false,
      reason: `line "${input.lineName}" reached its monthly cap of ${input.lineCap.toFixed(2)} USD (${input.lineSpend.toFixed(2)} USD spent this month)`,
    };
  }
  return { ok: true };
}
