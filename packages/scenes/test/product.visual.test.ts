import { describe, it } from 'vitest';
import { DEMO_BRAND } from '../src/demo';
import { expectMarginsEmpty, expectPieceSnapshot } from './visual';

const quiet = { background: { kind: 'solid' }, light: { sweep: false, vignette: 0 } } as const;

describe('product pieces', () => {
  it('hero settled', async () => {
    await expectPieceSnapshot('product-hero', 'product-hero', { frame: 45 });
  });
  it('hero with a very tall photo stays whole and inside the content area', async () => {
    const file = await expectPieceSnapshot('product-hero-tall', 'product-hero', {
      frame: 45,
      params: {
        image: 'products/vase-tall.svg',
        name: 'Vaso Onda',
        tagline: 'Alto, fino e impresso de uma vez',
      },
      ...quiet,
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('price counting down from the old price', async () => {
    await expectPieceSnapshot('product-price-counting', 'product-price', { frame: 15 });
  });
  it('price settled with its label, inside the content area', async () => {
    const file = await expectPieceSnapshot('product-price', 'product-price', {
      frame: 75,
      ...quiet,
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('price counting down from a much longer old price stays inside the content area', async () => {
    const file = await expectPieceSnapshot('product-price-wide-old', 'product-price', {
      frame: 8,
      params: { image: 'products/lamp.svg', price: 8990, oldPrice: 1299000, label: 'Só hoje' },
      ...quiet,
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('loupe on the detail', async () => {
    const file = await expectPieceSnapshot('product-loupe', 'product-loupe', {
      frame: 70,
      ...quiet,
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('loupe aimed at a corner stays inside the frame', async () => {
    const file = await expectPieceSnapshot('product-loupe-corner', 'product-loupe', {
      frame: 70,
      params: { image: 'products/lamp.svg', focus: { x: 1, y: 0 }, label: 'Canto' },
      ...quiet,
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
});
