import { ImagePath, type PieceSpec } from '@dailies-crew/plan';
import { z } from 'zod';

export const productHeroParams = z.strictObject({
  image: ImagePath,
  name: z.string().trim().min(1).max(40),
  tagline: z.string().trim().min(1).max(60).optional(),
});
export type ProductHeroParams = z.output<typeof productHeroParams>;

export const productHeroSpec: PieceSpec = {
  id: 'product-hero',
  title: 'Product hero',
  description:
    'The product photo floating gently above its own soft shadow, with the product name below and an optional tagline. The photo is always shown whole (any proportion). Use it to present the product; a transparent-background photo looks best.',
  paramsSchema: productHeroParams,
  assetParams: ['image'],
  minSeconds: 1.5,
  maxSeconds: 10,
  example: {
    image: 'products/lamp.svg',
    name: 'Luminária Lua',
    tagline: 'Impressa em 3D, acende em 3 cores',
  },
};
