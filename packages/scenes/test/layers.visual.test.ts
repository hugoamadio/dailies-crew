import { describe, it } from 'vitest';
import { expectPieceSnapshot } from './visual';

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
});
