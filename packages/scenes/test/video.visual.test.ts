import type { ResolvedPlan, ResolvedScene, TransitionKind } from '@dailies-crew/plan';
import { describe, it } from 'vitest';
import { DEMO_BRAND, demoResolvedPlan } from '../src/demo';
import { expectSideMarginsEmpty, expectSnapshot, renderComposition } from './visual';

const title = (
  id: string,
  lines: string[],
  from: number,
  durationInFrames: number,
): ResolvedScene => ({
  id,
  piece: 'kinetic-title',
  params: { lines, align: 'center', highlight: 0 },
  camera: { move: 'static', intensity: 'medium' },
  light: { sweep: false, vignette: 0.35 },
  background: { kind: 'gradient', angle: id === 'before' ? 160 : 20 },
  from,
  durationInFrames,
  transitionOut: null,
});

/** Two titles, "Antes" then "Depois", joined by one 12-frame transition at frame 60 */
function twoScenes(kind: TransitionKind): ResolvedPlan {
  const before = title('before', ['Antes'], 0, 72);
  before.transitionOut = { kind, direction: 'left', frames: 12 };
  return {
    version: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 150,
    brand: DEMO_BRAND,
    captions: { enabled: false, position: 'lower', words: [] },
    scenes: [before, title('after', ['Depois'], 60, 90)],
    voice: [],
    music: null,
  };
}

describe('the video composition', () => {
  it.each(['fade', 'slide', 'wipe', 'iris', 'push', 'whip', 'zoom-punch'] as const)(
    'transition %s halfway through',
    async (kind) => {
      const name = `transition-${kind}`;
      await expectSnapshot(
        name,
        await renderComposition('DailiesVideo', { plan: twoScenes(kind) }, 66, name),
      );
    },
  );

  it('captions on the demo, while "Luminária" is spoken', async () => {
    const name = 'video-captions';
    await expectSnapshot(
      name,
      await renderComposition('DailiesVideo', { plan: demoResolvedPlan() }, 150, name),
    );
  });

  it('a long caption page wraps inside the safe area', async () => {
    const texts = ['Luminária', ' Lua,', ' impressa', ' em', ' 3D', ' camada', ' por', ' camada.'];
    const words = texts.map((text, index) => ({
      text,
      startMs: index * 100,
      endMs: index * 100 + 90,
      timestampMs: null,
      confidence: null,
      ...(index === texts.length - 1 ? { pageBreakAfter: true } : {}),
    }));
    const plan: ResolvedPlan = {
      version: 1,
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 60,
      brand: DEMO_BRAND,
      captions: { enabled: true, position: 'lower', words },
      scenes: [
        {
          id: 'only',
          piece: 'kinetic-title',
          params: { lines: ['Legenda'], align: 'center', highlight: 0 },
          camera: { move: 'static', intensity: 'medium' },
          light: { sweep: false, vignette: 0 },
          background: { kind: 'solid' },
          from: 0,
          durationInFrames: 60,
          transitionOut: null,
        },
      ],
      voice: [],
      music: null,
    };
    const name = 'captions-long-page';
    const file = await renderComposition('DailiesVideo', { plan }, 15, name);
    await expectSnapshot(name, file);
    await expectSideMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
});
