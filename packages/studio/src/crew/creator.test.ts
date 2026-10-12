import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { briefing, idea, lamp, promptOf, recipe, roles } from '../../test/crew-fixtures';
import { FakeLlm } from '../llm/fake';
import { buildCreateRequest, type CreateFacts, CreatorOutputSchema, fakeIdeas } from './creator';

const facts: CreateFacts = {
  style: 'emotional',
  recipe,
  rules: [],
  material: lamp,
  briefing,
  usedIdeas: ['The moon on your desk'],
};

describe('a creator', () => {
  it('answers in a schema the API accepts, with exactly two ideas', () => {
    expectApiSchema(CreatorOutputSchema);
    expect(CreatorOutputSchema.safeParse({ ideas: [idea] }).success).toBe(false);
    expect(CreatorOutputSchema.safeParse({ ideas: [idea, idea] }).success).toBe(true);
  });

  it('gets its style and the ideas it must not repeat', () => {
    const request = buildCreateRequest(facts, roles.creator);
    expect(request.system).toContain('Your style is EMOTIONAL');
    expect(promptOf(request)).toContain('- The moon on your desk');
  });

  it('has fake ideas that fit the schema and mention the product', async () => {
    const llm = new FakeLlm({ creator: (input) => fakeIdeas(input as CreateFacts) });
    const { data } = await llm.generate(buildCreateRequest(facts, roles.creator));
    expect(data.ideas.every((each) => each.hook.includes('Luminária Lua'))).toBe(true);
  });
});
