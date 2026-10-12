import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { promptOf, recipe, roles } from '../../test/crew-fixtures';
import { buildRouteRequest, fakeRoute, RouterSchema } from './router';

const facts = (reason: string) => ({
  recipe,
  reason,
  ideaTitle: 'Moon',
  scriptLines: ['Uma linha'],
});

describe('the rejection router', () => {
  it('answers in a schema the API accepts', () => {
    expectApiSchema(RouterSchema);
  });

  it("reads Hugo's reason with the idea and the narration", () => {
    const request = buildRouteRequest(facts('A legenda está pequena'), roles['rejection-router']);
    expect(request).toMatchObject({ model: 'claude-haiku-5-5', effort: 'low' });
    expect(promptOf(request)).toContain("## Hugo's reason\nA legenda está pequena");
  });

  it('has a fake answer that picks a stage from the words of the reason', () => {
    expect(fakeRoute(facts('O roteiro está longo')).stage).toBe('script');
    expect(fakeRoute(facts('A voz ficou robótica')).stage).toBe('produce');
    expect(fakeRoute(facts('A legenda está pequena')).stage).toBe('direction');
  });
});
