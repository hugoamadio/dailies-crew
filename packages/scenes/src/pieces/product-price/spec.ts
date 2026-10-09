import { ImagePath, type PieceSpec } from '@dailies-crew/plan';
import { z } from 'zod';

const cents = z.number().int().min(1).max(100_000_000);

export const productPriceParams = z
  .strictObject({
    image: ImagePath,
    /** In cents: 8990 = R$ 89,90 */
    price: cents,
    currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
    locale: z
      .string()
      .regex(/^[a-z]{2}-[A-Z]{2}$/, 'must look like "pt-BR"')
      .default('pt-BR'),
    /** The price before the offer, in cents; the counter runs down from it */
    oldPrice: cents.optional(),
    label: z.string().trim().min(1).max(30).optional(),
  })
  .refine((params) => params.oldPrice === undefined || params.oldPrice > params.price, {
    message: 'oldPrice must be higher than price',
    path: ['oldPrice'],
  });
export type ProductPriceParams = z.output<typeof productPriceParams>;

export const productPriceSpec: PieceSpec = {
  id: 'product-price',
  title: 'Product price',
  description:
    'A small product photo and the price counting to its final value: down from the old price (struck through above it) when there is one, up from zero otherwise. An optional label pops in at the end (e.g. "Só hoje"). Use it for offers and to reveal the price.',
  paramsSchema: productPriceParams,
  assetParams: ['image'],
  minSeconds: 2,
  maxSeconds: 8,
  example: {
    image: 'products/lamp.svg',
    price: 8990,
    oldPrice: 12990,
    currency: 'BRL',
    locale: 'pt-BR',
    label: 'Só hoje',
  },
};
