import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_PLAN, demoResolvedPlan } from './demo';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

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

describe('examples/feiraria-lamp', () => {
  it('is the demo plan', () => {
    const example = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'examples/feiraria-lamp/plan.json'), 'utf8'),
    );
    expect(example).toEqual(DEMO_PLAN);
  });
});
