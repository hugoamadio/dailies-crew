import { StudioError } from '../errors';
import { AnthropicLlm } from './anthropic';
import type { LlmClient } from './types';

export * from './anthropic';
export * from './errors';
export * from './fake';
export * from './parse';
export * from './types';

/**
 * DAILIES_FAKE_AI=1 selects the fake AI; otherwise Claude with ANTHROPIC_API_KEY, and a missing
 * key is an error at startup rather than at the first video.
 */
export function createLlm(
  env: Record<string, string | undefined>,
  createFake: () => LlmClient,
): LlmClient {
  if (env.DAILIES_FAKE_AI === '1') return createFake();
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new StudioError(
      'ANTHROPIC_API_KEY is not set: put it in the .env file, or set DAILIES_FAKE_AI=1 to use the fake AI',
    );
  }
  return new AnthropicLlm({ apiKey });
}
