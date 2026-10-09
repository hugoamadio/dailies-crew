import { describe, expect, it } from 'vitest';
import { demoResolvedPlan } from './demo';

describe('demo plan', () => {
  it('validates and resolves with the fake voice timings', () => {
    const plan = demoResolvedPlan();
    expect(plan.durationInFrames).toBe(730);
    expect(plan.scenes.map((scene) => [scene.id, scene.from])).toEqual([
      ['hook', 0],
      ['hero', 103],
      ['detail', 254],
      ['offer', 383],
      ['price', 428],
      ['cta', 591],
    ]);
    expect(plan.voice).toEqual([]);
    expect(plan.captions.words.length).toBe(49);
  });
});
