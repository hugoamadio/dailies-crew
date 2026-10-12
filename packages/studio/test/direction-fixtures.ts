import { DEMO_BRAND } from '@dailies-crew/scenes/demo';
import {
  type DirectFacts,
  type DirectorOutput,
  fakeDirection,
  type PlanFrame,
  pieceCards,
} from '../src/crew/director';
import { fakeScript, type Script } from '../src/crew/scriptwriter';
import { briefing, idea, lamp, recipe } from './crew-fixtures';

export const frame: PlanFrame = {
  brand: DEMO_BRAND,
  voice: { provider: 'fake', voiceId: 'demo' },
  language: 'pt-BR',
  musicTrack: null,
  images: lamp.kind === 'product' ? lamp.images : [],
};

/** Five lines: hook, hero, detail, price, cta */
export const script: Script = fakeScript({
  recipe,
  rules: [],
  material: lamp,
  briefing,
  idea,
  instructions: [],
  previousScript: null,
});

export function directFacts(overrides: Partial<DirectFacts> = {}): DirectFacts {
  return {
    recipe,
    rules: [],
    material: lamp,
    briefing,
    idea,
    script,
    frame,
    pieces: pieceCards(),
    instructions: [],
    previousIssues: [],
    ...overrides,
  };
}

/** What the fake director answers for the lamp: a valid plan */
export const goodDirection: DirectorOutput = fakeDirection(directFacts());

/** goodDirection with one scene changed */
export function withScene(
  index: number,
  change: Partial<DirectorOutput['scenes'][number]>,
): DirectorOutput {
  return {
    ...goodDirection,
    scenes: goodDirection.scenes.map((scene, at) =>
      at === index ? { ...scene, ...change } : scene,
    ),
  };
}
