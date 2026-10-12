import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { briefing, idea, lamp, promptOf, recipe, roles } from '../../test/crew-fixtures';
import { script } from '../../test/direction-fixtures';
import { FakeLlm } from '../llm/fake';
import { buildScriptRequest, fakeScript, type ScriptFacts, ScriptSchema } from './scriptwriter';

const facts: ScriptFacts = {
  recipe,
  rules: ['Never show the price first'],
  material: lamp,
  briefing,
  idea,
  instructions: ['(fidelity) Say the right price'],
  previousScript: script,
};

describe('the scriptwriter', () => {
  it('answers in a schema the API accepts', () => {
    expectApiSchema(ScriptSchema);
  });

  it('refuses repeated line ids and a narration too short or too long', () => {
    const [first] = script.lines;
    const twice = { ...script, lines: [first, first, first] };
    expect(ScriptSchema.safeParse(twice).error?.issues[0]?.message).toBe('line ids must be unique');
    const short = {
      ...script,
      lines: script.lines.map((line) => ({ ...line, estimatedSeconds: 1 })),
    };
    expect(ScriptSchema.safeParse(short).error?.issues[0]?.message).toBe(
      'the narration lasts about 5.0 s; it must last 12 to 55 s',
    );
  });

  it('reworks the previous script with the change requests of the round', () => {
    const prompt = promptOf(buildScriptRequest(facts, roles.scriptwriter));
    expect(prompt).toContain('- (fidelity) Say the right price');
    expect(prompt).toContain('The previous version of the script');
    expect(prompt).toContain('- Never show the price first');
  });

  it('has a fake script that fits the schema: hook, three product lines, call to action', async () => {
    const llm = new FakeLlm({ scriptwriter: (input) => fakeScript(input as ScriptFacts) });
    const { data } = await llm.generate(buildScriptRequest(facts, roles.scriptwriter));
    expect(data.lines.map((line) => line.id)).toEqual(['hook', 'hero', 'detail', 'price', 'cta']);
  });
});
