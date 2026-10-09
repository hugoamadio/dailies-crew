import { describe, it } from 'vitest';
import { DEMO_BRAND } from '../src/demo';
import { expectMarginsEmpty, expectPieceSnapshot } from './visual';

describe('closing', () => {
  it('logo, call to action and handle', async () => {
    const file = await expectPieceSnapshot('cta-end', 'cta-end', {
      frame: 45,
      background: { kind: 'solid' },
      light: { sweep: false, vignette: 0 },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('without a logo in the brand', async () => {
    const { logo: _logo, ...brand } = DEMO_BRAND;
    await expectPieceSnapshot('cta-end-no-logo', 'cta-end', { frame: 45, brand });
  });
  it('the longest call to action and handle fit at the end of the shortest scene', async () => {
    const file = await expectPieceSnapshot('cta-end-longest-min', 'cta-end', {
      frame: 44,
      seconds: 1.5,
      params: {
        cta: 'Comente EU QUERO e receba o link agora!',
        handle: '@feiraria.oficial.loja.de.impressao3d',
      },
      background: { kind: 'solid' },
      light: { sweep: false, vignette: 0 },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
});
