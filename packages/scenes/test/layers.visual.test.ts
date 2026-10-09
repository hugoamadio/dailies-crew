import { describe, it } from 'vitest';
import { DEMO_BRAND } from '../src/demo';
import { expectMarginsEmpty, expectPieceSnapshot } from './visual';

const SOLID = { kind: 'solid' } as const;
const NO_LIGHT = { sweep: false, vignette: 0 } as const;

describe('kinetic title and the layers', () => {
  it('settled on the default gradient', () => expectPieceSnapshot('kinetic-title', 'kinetic-title', { frame: 45 }));
  it('mid-entrance', () => expectPieceSnapshot('kinetic-title-entering', 'kinetic-title', { frame: 8 }));
  it.each([
    ['solid', { kind: 'solid' }],
    ['particles', { kind: 'particles', density: 'high' }],
    ['grain', { kind: 'grain' }],
  ] as const)('on the %s background', async (name, background) => {
    await expectPieceSnapshot(`background-${name}`, 'kinetic-title', { frame: 45, background });
  });
  it('handheld camera', () =>
    expectPieceSnapshot('camera-handheld', 'kinetic-title', {
      frame: 40,
      camera: { move: 'handheld', intensity: 'strong' },
    }));
  it('strong push-in with motion blur', () =>
    expectPieceSnapshot('camera-push-in-strong', 'kinetic-title', {
      frame: 60,
      camera: { move: 'push-in', intensity: 'strong' },
    }));
  it('rack focus while still blurred', () =>
    expectPieceSnapshot('camera-rack-focus', 'kinetic-title', {
      frame: 4,
      camera: { move: 'rack-focus', intensity: 'medium' },
    }));
  it('light sweep and a strong vignette', () =>
    expectPieceSnapshot('light-sweep', 'kinetic-title', { frame: 45, light: { sweep: true, vignette: 0.9 } }));
  it('strong push-in keeps the title inside the content area at its peak', async () => {
    const file = await expectPieceSnapshot('camera-push-in-strong-peak', 'kinetic-title', {
      frame: 89,
      background: SOLID,
      light: NO_LIGHT,
      camera: { move: 'push-in', intensity: 'strong' },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it.each(['left', 'right'] as const)('strong pans keep the title inside the content area at the end of the move (%s)', async (side) => {
    const file = await expectPieceSnapshot(`camera-pan-${side}-strong-end`, 'kinetic-title', {
      frame: 89,
      background: SOLID,
      light: NO_LIGHT,
      camera: { move: side === 'left' ? 'pan-left' : 'pan-right', intensity: 'strong' },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
});
