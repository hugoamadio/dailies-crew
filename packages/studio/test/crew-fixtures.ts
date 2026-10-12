import type { Material, Recipe } from '../src/crew/context';
import type { IdeaDraft } from '../src/crew/creator';
import type { Briefing } from '../src/crew/preparer';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

export const roles = DEFAULT_SETTINGS.roles;

export const recipe: Recipe = {
  name: 'Store products',
  kind: 'product',
  objective: 'sell the product',
  audience: 'people who like design',
  tone: 'energetic',
  language: 'pt-BR',
};

export const lamp: Material = {
  kind: 'product',
  name: 'Luminária Lua',
  description: 'A moon lamp printed in 3D, layer by layer, that lights up in 3 colors.',
  priceCents: 8990,
  oldPriceCents: 12990,
  currency: 'BRL',
  category: 'lamps',
  link: null,
  images: ['products/p1/1-lamp.svg'],
};

export const briefing: Briefing = {
  summary: 'A video about the moon lamp for people who like design.',
  keyFacts: ['Luminária Lua', 'R$ 89,90'],
  mustAvoid: [],
};

export const idea: IdeaDraft = {
  title: 'The moon on your desk',
  hook: 'Sua mesa merece uma lua só dela?',
  angle: 'A dreamy object for the desk',
  structure: ['Hook', 'Show the lamp', 'Price', 'Call to action'],
  cta: 'Link na bio',
};

/** The text of a request's first content block */
export function promptOf(request: { content: readonly unknown[] }): string {
  return (request.content[0] as { text: string }).text;
}
