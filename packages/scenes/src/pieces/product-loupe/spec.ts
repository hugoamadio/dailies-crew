import { ImagePath, type PieceSpec } from '@dailies-crew/plan';
import { z } from 'zod';

export const productLoupeParams = z.object({
  image: ImagePath,
  /** The detail to magnify, as a fraction of the photo box (0,0 = top left) */
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  zoom: z.number().min(1.5).max(4).default(2.5),
  label: z.string().trim().min(1).max(40),
});
export type ProductLoupeParams = z.output<typeof productLoupeParams>;

export const productLoupeSpec: PieceSpec = {
  id: 'product-loupe',
  title: 'Product loupe',
  description:
    'The product photo with a round magnifying glass that glides to a detail and enlarges it, and a short label below (e.g. "Acabamento liso"). Use it to show finish, texture or a feature the viewer would miss.',
  paramsSchema: productLoupeParams,
  assetParams: ['image'],
  minSeconds: 2,
  maxSeconds: 8,
  example: {
    image: 'products/lamp.svg',
    focus: { x: 0.5, y: 0.3 },
    zoom: 2.5,
    label: 'Acabamento liso',
  },
};
