import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { lamp, promptOf, recipe, roles } from '../../test/crew-fixtures';
import { FakeLlm } from '../llm/fake';
import { BriefingSchema, buildPrepareRequest, fakeBriefing, type PrepareFacts } from './preparer';

const facts: PrepareFacts = {
  recipe,
  rules: ['Never show the price first'],
  material: lamp,
  recentIdeas: [{ title: 'Moon at night', hook: 'Dark room?' }],
  rejections: ['A legenda estava pequena'],
};

describe('the preparer', () => {
  it('answers in a schema the API accepts', () => {
    expectApiSchema(BriefingSchema);
  });

  it('reads the line, the product, the rules, the used ideas and the rejections', () => {
    const request = buildPrepareRequest(facts, roles.preparer);
    expect(request).toMatchObject({ role: 'preparer', model: 'claude-haiku-5-5', effort: 'low' });
    const prompt = promptOf(request);
    for (const part of [
      '## Product: Luminária Lua',
      '- Never show the price first',
      '- Moon at night: Dark room?',
      '- A legenda estava pequena',
    ]) {
      expect(prompt).toContain(part);
    }
  });

  it('has a fake answer that fits its schema and names the product', async () => {
    const llm = new FakeLlm({ preparer: (input) => fakeBriefing(input as PrepareFacts) });
    const { data } = await llm.generate(buildPrepareRequest(facts, roles.preparer));
    expect(data.keyFacts[0]).toBe('Luminária Lua');
    expect(data.mustAvoid).toContain('Never show the price first');
  });
});
