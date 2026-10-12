import { z } from 'zod';

const cents = z.number().int().min(1).max(100_000_000);

export const ProductInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(40),
    description: z.string().trim().min(1).max(2000),
    /** In cents: 8990 = R$ 89,90 */
    priceCents: cents,
    /** The price before the offer, in cents */
    oldPriceCents: cents.nullable().default(null),
    /** What the product-price piece formats */
    currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
    category: z.string().trim().min(1).max(60).nullable().default(null),
    link: z.url().nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine(
    (product) => product.oldPriceCents === null || product.oldPriceCents > product.priceCents,
    {
      message: 'oldPriceCents must be higher than priceCents',
      path: ['oldPriceCents'],
    },
  );

export type ProductInput = z.input<typeof ProductInputSchema>;
