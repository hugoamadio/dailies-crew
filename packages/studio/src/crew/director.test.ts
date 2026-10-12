import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { promptOf, roles } from '../../test/crew-fixtures';
import {
  directFacts,
  frame,
  goodDirection,
  script,
  withScene,
} from '../../test/direction-fixtures';
import { FakeLlm } from '../llm/fake';
import {
  buildDirectRequest,
  checkDirection,
  type DirectFacts,
  DirectorOutputSchema,
  directWithRetries,
  fakeDirection,
  toPlanInput,
} from './director';

describe('the director', () => {
  it('answers in a schema the API accepts (params as a JSON string)', () => {
    expectApiSchema(DirectorOutputSchema);
  });

  it('reads the piece cards and the photos it may use', () => {
    const prompt = promptOf(buildDirectRequest(directFacts(), roles.director));
    expect(prompt).toContain('"id": "product-hero"');
    expect(prompt).toContain(`- ${frame.images[0]}`);
  });
});

describe('toPlanInput', () => {
  it('takes brand, voice, language and music from the line, and scenes from the director', () => {
    const { plan, issues } = toPlanInput(goodDirection, script, {
      ...frame,
      musicTrack: 'music/calm.mp3',
    });
    expect(issues).toEqual([]);
    expect(plan.brand).toEqual(frame.brand);
    expect(plan.voice).toEqual({
      provider: 'fake',
      voiceId: 'demo',
      language: 'pt-BR',
      lines: script.lines.map(({ id, text }) => ({ id, text })),
    });
    expect(plan.music).toEqual({ track: 'music/calm.mp3' });
    expect(plan.scenes[0]).toMatchObject({
      piece: 'hook-question',
      timing: { kind: 'line', lineId: 'hook' },
    });
    expect(plan.scenes.at(-1)).not.toHaveProperty('transitionOut');
  });

  it('reports params that are not a JSON object and a scene with both or no timing', () => {
    const broken = withScene(1, { paramsJson: '{"image": ', seconds: 2 });
    expect(toPlanInput(broken, script, frame).issues).toEqual([
      '- scenes.1.paramsJson: not valid JSON',
      '- scenes.1: give either lineId or seconds',
    ]);
  });
});

describe('checkDirection', () => {
  it('accepts the fake director plan for a product', () => {
    const result = checkDirection(goodDirection, script, frame);
    expect(result.ok).toBe(true);
  });

  it('names a param the piece does not accept', () => {
    const result = checkDirection(
      withScene(0, { paramsJson: JSON.stringify({ question: 'Sua mesa?', colour: 'red' }) }),
      script,
      frame,
    );
    expect(result).toEqual({
      ok: false,
      issues: [expect.stringMatching(/^- scenes\.0\.params: /)],
    });
  });

  it('refuses a photo that was not given (an invented path)', () => {
    const hero = goodDirection.scenes.findIndex((scene) => scene.piece === 'product-hero');
    const result = checkDirection(
      withScene(hero, {
        paramsJson: JSON.stringify({ image: 'products/other/x.png', name: 'Lua' }),
      }),
      script,
      frame,
    );
    expect(result).toEqual({
      ok: false,
      issues: ['- (images): "products/other/x.png" is not one of the photos you may use'],
    });
  });

  it('catches a voice line too long for its piece before any voice is paid for', () => {
    const longScript = {
      ...script,
      lines: script.lines.map((line) =>
        line.id === 'hook' ? { ...line, text: Array(30).fill('palavra').join(' ') } : line,
      ),
    };
    const result = checkDirection(goodDirection, longScript, frame);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.join('\n')).toMatch(
      /piece "hook-question" lasts at most 6 s/,
    );
  });
});

describe('directWithRetries', () => {
  it('sends the issues back to the director and keeps every attempt', async () => {
    const llm = new FakeLlm({ director: (input) => fakeDirection(input as DirectFacts) }).script(
      'director',
      withScene(0, { paramsJson: '[]' }),
    );
    const asked: string[][] = [];
    const outcome = await directWithRetries(
      async (previousIssues) => {
        asked.push(previousIssues);
        const request = buildDirectRequest(directFacts({ previousIssues }), roles.director);
        return (await llm.generate(request)).data;
      },
      (output) => checkDirection(output, script, frame),
    );
    expect(outcome.ok).toBe(true);
    expect(asked).toEqual([[], ['- scenes.0.paramsJson: must be a JSON object']]);
    expect(outcome.attempts).toEqual([
      { issues: ['- scenes.0.paramsJson: must be a JSON object'] },
      { issues: [] },
    ]);
    const retryPrompt = promptOf(llm.calls[1]!);
    expect(retryPrompt).toContain('Your previous plan was refused');
  });

  it('gives up after two retries with the last issues', async () => {
    const bad = withScene(0, { paramsJson: '[]' });
    let calls = 0;
    const outcome = await directWithRetries(
      async () => {
        calls += 1;
        return bad;
      },
      (output) => checkDirection(output, script, frame),
    );
    expect(calls).toBe(3);
    expect(outcome).toMatchObject({
      ok: false,
      issues: ['- scenes.0.paramsJson: must be a JSON object'],
    });
    expect(outcome.attempts).toHaveLength(3);
  });
});
