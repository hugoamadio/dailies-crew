import { LineInputSchema } from '@dailies-crew/studio';
import { describe, expect, it } from 'vitest';
import { lineFromForm, linePatchFromForm } from './line';
import { cents, num } from './read';

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

const LINE_FIELDS: [string, string][] = [
  ['name', 'Store products'],
  ['perDay', '3'],
  ['hour', '9'],
  ['language', 'pt-BR'],
  ['objective', 'sell the product'],
  ['audience', 'people who like design'],
  ['tone', 'energetic'],
  ['brand.colors.background', '#101014'],
  ['brand.colors.surface', '#1c1c22'],
  ['brand.colors.text', '#ffffff'],
  ['brand.colors.primary', '#7c3aed'],
  ['brand.colors.accent', '#f59e0b'],
  ['brand.headingFont', 'Poppins'],
  ['brand.bodyFont', 'Inter'],
  ['brand.personality', 'energetic'],
  ['voice.provider', 'fake'],
  ['voice.voiceId', 'demo'],
  ['musicTrack', ''],
  ['monthlyCapUsd', '10'],
];

describe('reading numbers and money', () => {
  it('takes a comma or a dot, and tells empty from wrong', () => {
    const data = form([
      ['a', '89,90'],
      ['b', ''],
      ['c', '12abc'],
      ['d', '7'],
      ['e', '1.234'],
    ]);
    expect(cents(data, 'a')).toBe(8990);
    expect(cents(data, 'b')).toBeUndefined();
    expect(cents(data, 'c')).toBeNaN();
    expect(cents(data, 'd')).toBe(700);
    expect(cents(data, 'e')).toBeNaN();
    expect(num(data, 'a')).toBe(89.9);
    expect(num(data, 'b')).toBeUndefined();
    expect(num(data, 'c')).toBeNaN();
  });
});

describe('lineFromForm', () => {
  it('builds a product line the studio accepts, with the chosen products', () => {
    const input = lineFromForm(
      form([
        ...LINE_FIELDS,
        ['kind', 'product'],
        ['material.select', 'chosen'],
        ['material.productIds', '0190f5d6-1c2b-7a00-8000-000000000001'],
        ['material.productIds', '0190f5d6-1c2b-7a00-8000-000000000002'],
        ['active', 'on'],
      ]),
    );
    const parsed = LineInputSchema.parse(input);
    expect(parsed).toMatchObject({
      kind: 'product',
      material: { select: 'chosen', productIds: expect.arrayContaining([expect.any(String)]) },
      perDay: 3,
      musicTrack: null,
      active: true,
      voice: { provider: 'fake', voiceId: 'demo' },
    });
    expect(parsed.brand.logo).toBeUndefined();
  });

  it('reads the brand and topic materials, keeping the current logo and brand photos', () => {
    const brand = lineFromForm(
      form([
        ...LINE_FIELDS,
        ['kind', 'brand'],
        ['brand.logo', 'lines/x/logo.svg'],
        ['material.about', 'A small studio that prints lamps in 3D, layer by layer.'],
        ['material.links', 'https://example.com\n\n https://example.com/shop '],
        ['material.images', 'lines/x/brand-1.png'],
      ]),
    );
    expect(brand).toMatchObject({
      active: false,
      brand: { logo: 'lines/x/logo.svg' },
      material: {
        images: ['lines/x/brand-1.png'],
        links: ['https://example.com', 'https://example.com/shop'],
      },
    });
    const topic = linePatchFromForm(
      form([
        ...LINE_FIELDS,
        ['kind', 'topic'],
        ['material.subject', 'Tips'],
        ['material.avoid', ''],
      ]),
    );
    expect(topic).not.toHaveProperty('kind');
    expect(topic).not.toHaveProperty('active');
    expect(topic.material).toEqual({ subject: 'Tips', avoid: '' });
  });

  it('leaves a wrong number for the schema to name', () => {
    const result = LineInputSchema.safeParse(
      lineFromForm(
        form([
          ...LINE_FIELDS.filter(([name]) => name !== 'perDay'),
          ['perDay', 'x'],
          ['kind', 'topic'],
        ]),
      ),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('perDay');
  });
});
