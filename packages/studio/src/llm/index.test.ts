import { describe, expect, it } from 'vitest';
import { AnthropicLlm } from './anthropic';
import { FakeLlm } from './fake';
import { createLlm } from './index';

describe('createLlm', () => {
  const fake = () => new FakeLlm();

  it('picks the fake AI with DAILIES_FAKE_AI=1, even without a key', () => {
    expect(createLlm({ DAILIES_FAKE_AI: '1' }, fake)).toBeInstanceOf(FakeLlm);
  });

  it('picks Claude with a key and refuses to start without one', () => {
    expect(createLlm({ ANTHROPIC_API_KEY: 'k' }, fake)).toBeInstanceOf(AnthropicLlm);
    expect(() => createLlm({}, fake)).toThrow('ANTHROPIC_API_KEY is not set');
  });
});
