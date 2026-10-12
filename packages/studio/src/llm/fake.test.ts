import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { LlmError } from './errors';
import { FakeLlm } from './fake';

const Answer = z.strictObject({ greeting: z.string().min(3) });
const request = (facts: unknown) => ({
  role: 'social' as const,
  model: 'claude-sonnet-5-5',
  effort: 'low' as const,
  system: 's',
  content: [],
  schema: Answer,
  maxTokens: 100,
  facts,
});

describe('FakeLlm', () => {
  it('answers from the facts, for free, and records the call', async () => {
    const fake = new FakeLlm({
      social: (facts) => ({ greeting: `Olá ${(facts as { name: string }).name}` }),
    });
    const result = await fake.generate(request({ name: 'Lua' }));
    expect(result).toEqual({
      data: { greeting: 'Olá Lua' },
      model: 'claude-sonnet-5-5',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    });
    expect(fake.calls).toHaveLength(1);
  });

  it('uses scripted answers and errors first, and checks every answer against the schema', async () => {
    const auth = new LlmError('auth', 'refused', false);
    const fake = new FakeLlm({ social: () => ({ greeting: 'default' }) }).script(
      'social',
      { greeting: 'no' },
      auth,
    );
    await expect(fake.generate(request({}))).rejects.toThrow('does not fit its schema');
    await expect(fake.generate(request({}))).rejects.toBe(auth);
    expect((await fake.generate(request({}))).data.greeting).toBe('default');
  });

  it('says when a role has no answer', async () => {
    await expect(new FakeLlm().generate(request({}))).rejects.toThrow(
      'The fake AI has no answer for role social',
    );
  });
});
