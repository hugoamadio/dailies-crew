import { describe, expect, it } from 'vitest';
import { productPriceParams } from './spec';

describe('product-price params', () => {
  it('fills the currency and locale', () => {
    expect(productPriceParams.parse({ image: 'a.png', price: 8990 })).toMatchObject({
      currency: 'BRL',
      locale: 'pt-BR',
    });
  });
  it('refuses an old price that is not higher', () => {
    const result = productPriceParams.safeParse({ image: 'a.png', price: 8990, oldPrice: 8990 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['oldPrice']);
  });
});
