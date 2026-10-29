import { ProductInputSchema } from '@dailies-crew/studio';
import { describe, expect, it } from 'vitest';
import { productFromForm, productPatchFromForm } from './product';

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

describe('productFromForm', () => {
  it('turns money into cents and empty optional fields into null', () => {
    const input = productFromForm(
      form([
        ['name', 'Luminária Lua'],
        ['description', 'A moon lamp printed in 3D.'],
        ['priceCents', '89,90'],
        ['oldPriceCents', ''],
        ['currency', 'BRL'],
        ['category', ''],
        ['link', 'https://example.com/lua'],
        ['active', 'on'],
      ]),
    );
    expect(ProductInputSchema.parse(input)).toEqual({
      name: 'Luminária Lua',
      description: 'A moon lamp printed in 3D.',
      priceCents: 8990,
      oldPriceCents: null,
      currency: 'BRL',
      category: null,
      link: 'https://example.com/lua',
      active: true,
    });
    expect(productPatchFromForm(form([['priceCents', '10']]))).not.toHaveProperty('active');
  });
});
