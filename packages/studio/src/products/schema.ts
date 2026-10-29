import { z } from 'zod';

const cents = z.number().int().min(1).max(100_000_000);

/** What the product-price piece formats */
export const CURRENCIES = ['BRL', 'USD', 'EUR'] as const;

const fields = {
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(2000),
  /** In cents: 8990 = R$ 89,90 */
  priceCents: cents,
  /** The price before the offer, in cents */
  oldPriceCents: cents.nullable(),
  currency: z.enum(CURRENCIES),
  category: z.string().trim().min(1).max(60).nullable(),
  link: z.url().nullable(),
};

const OLD_PRICE_RULE = {
  message: 'oldPriceCents must be higher than priceCents',
  path: ['oldPriceCents'],
};

export const ProductInputSchema = z
  .strictObject({
    ...fields,
    oldPriceCents: fields.oldPriceCents.default(null),
    currency: fields.currency.default('BRL'),
    category: fields.category.default(null),
    link: fields.link.default(null),
    active: z.boolean().default(true),
  })
  .refine(
    (product) => product.oldPriceCents === null || product.oldPriceCents > product.priceCents,
    OLD_PRICE_RULE,
  );

/** What the panel's edit form sends: any field but "active" (setProductActive does that) */
export const ProductPatchSchema = z.strictObject({
  name: fields.name.optional(),
  description: fields.description.optional(),
  priceCents: fields.priceCents.optional(),
  oldPriceCents: fields.oldPriceCents.optional(),
  currency: fields.currency.optional(),
  category: fields.category.optional(),
  link: fields.link.optional(),
});

export type ProductInput = z.input<typeof ProductInputSchema>;
export type ProductPatch = z.input<typeof ProductPatchSchema>;
