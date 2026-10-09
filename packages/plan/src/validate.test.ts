import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  catalogFromSpecs,
  collectAssetPaths,
  ImagePath,
  type PieceSpec,
  type PlanInput,
  validatePlan,
} from './index';

const titleSpec: PieceSpec = {
  id: 'title',
  title: 'Title',
  description: 'A line of text',
  paramsSchema: z.object({ text: z.string().min(1), size: z.number().default(10) }),
  assetParams: [],
  minSeconds: 1,
  maxSeconds: 6,
  example: { text: 'Hi' },
};
const photoSpec: PieceSpec = {
  id: 'photo',
  title: 'Photo',
  description: 'A product photo',
  paramsSchema: z.object({ image: ImagePath }),
  assetParams: ['image'],
  minSeconds: 1,
  maxSeconds: 10,
  example: { image: 'products/lamp.png' },
};
const catalog = catalogFromSpecs([titleSpec, photoSpec]);

function basePlan(): PlanInput {
  return {
    version: 1,
    brand: {
      colors: {
        background: '#101010',
        surface: '#202020',
        text: '#ffffff',
        primary: '#333333',
        accent: '#ffc83d',
      },
      headingFont: 'Montserrat',
      bodyFont: 'Inter',
    },
    voice: {
      provider: 'fake',
      voiceId: 'narrator',
      language: 'pt-BR',
      lines: [{ id: 'one', text: 'Olá mundo' }],
    },
    scenes: [
      {
        id: 'a',
        piece: 'title',
        params: { text: 'Oi' },
        timing: { kind: 'line', lineId: 'one' },
        transitionOut: { kind: 'fade' },
      },
      {
        id: 'b',
        piece: 'photo',
        params: { image: 'products/lamp.png' },
        timing: { kind: 'seconds', seconds: 2 },
      },
    ],
  };
}

function issuesOf(raw: unknown) {
  const result = validatePlan(raw, catalog);
  if (result.ok) throw new Error('expected the plan to be refused');
  return result.issues;
}

describe('validatePlan', () => {
  it('accepts a good plan and fills every default', () => {
    const result = validatePlan(basePlan(), catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first, second] = result.value.scenes;
    expect(first?.camera).toEqual({ move: 'static', intensity: 'medium' });
    expect(first?.light).toEqual({ sweep: false, vignette: 0.35 });
    expect(first?.background).toEqual({ kind: 'gradient', angle: 160 });
    expect(first?.transitionOut).toEqual({ kind: 'fade', seconds: 0.4, direction: 'left' });
    expect(first?.params).toEqual({ text: 'Oi', size: 10 });
    expect(second?.transitionOut).toBeUndefined();
    expect(result.value.captions).toEqual({ enabled: true, position: 'lower' });
    expect(result.value.brand.personality).toBe('energetic');
  });

  it('names an unknown piece', () => {
    const plan = basePlan();
    plan.scenes[0]!.piece = 'nope';
    expect(issuesOf(plan)).toEqual([{ path: 'scenes.0.piece', message: 'unknown piece "nope"' }]);
  });

  it('checks the params of each piece with its own schema', () => {
    const plan = basePlan();
    plan.scenes[0]!.params = { text: '' };
    expect(issuesOf(plan).map((issue) => issue.path)).toEqual(['scenes.0.params.text']);
  });

  it('refuses duplicate scene ids', () => {
    const plan = basePlan();
    plan.scenes[1]!.id = 'a';
    expect(issuesOf(plan)).toContainEqual({ path: 'scenes.1.id', message: 'duplicate scene id "a"' });
  });

  it('refuses a scene tied to a missing line, and a line no scene uses', () => {
    const plan = basePlan();
    plan.scenes[0]!.timing = { kind: 'line', lineId: 'two' };
    expect(issuesOf(plan)).toEqual([
      { path: 'scenes.0.timing.lineId', message: 'no voice line "two"' },
      { path: 'voice.lines', message: 'line "one" is not used by any scene' },
    ]);
  });

  it('refuses a line used by two scenes', () => {
    const plan = basePlan();
    plan.scenes[1]!.timing = { kind: 'line', lineId: 'one' };
    expect(issuesOf(plan)).toContainEqual({
      path: 'voice.lines',
      message: 'line "one" is used by 2 scenes',
    });
  });

  it('refuses a transition out of the last scene', () => {
    const plan = basePlan();
    plan.scenes[1]!.transitionOut = { kind: 'fade' };
    expect(issuesOf(plan)).toEqual([
      { path: 'scenes.1.transitionOut', message: 'the last scene cannot have a transition out' },
    ]);
  });

  it('keeps a seconds-timed scene inside the limits of its piece', () => {
    const plan = basePlan();
    plan.scenes[1]!.timing = { kind: 'seconds', seconds: 12 };
    expect(issuesOf(plan)).toEqual([
      { path: 'scenes.1.timing.seconds', message: 'piece "photo" lasts between 1 and 10 seconds' },
    ]);
  });

  it.each(['../secret.png', '/etc/x.png', 'a/../../b.png', 'C:\\x.png', 'products//lamp.png', 'products/lamp.exe'])(
    'refuses the asset path %s',
    (image) => {
      const plan = basePlan();
      plan.scenes[1]!.params = { image };
      expect(issuesOf(plan).map((issue) => issue.path)).toEqual(['scenes.1.params.image']);
    },
  );

  it('refuses a short color', () => {
    const plan = basePlan();
    plan.brand.colors.text = '#fff';
    expect(issuesOf(plan)).toEqual([
      { path: 'brand.colors.text', message: 'must be a #rrggbb color' },
    ]);
  });
});

describe('collectAssetPaths', () => {
  it('lists the logo, the music and the asset params once, sorted', () => {
    const plan = basePlan();
    plan.brand.logo = 'brand/logo.svg';
    plan.music = { track: 'music/upbeat.mp3' };
    const result = validatePlan(plan, catalog);
    if (!result.ok) throw new Error('expected a valid plan');
    expect(collectAssetPaths(result.value, catalog)).toEqual([
      'brand/logo.svg',
      'music/upbeat.mp3',
      'products/lamp.png',
    ]);
  });
});
