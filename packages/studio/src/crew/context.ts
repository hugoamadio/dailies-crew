import type { Product } from '@dailies-crew/db';
import type { Line } from '../lines/schema';

/** The part of a line every role reads */
export interface Recipe {
  name: string;
  kind: 'product' | 'brand' | 'topic';
  objective: string;
  audience: string;
  tone: string;
  /** BCP 47: every word the viewer reads or hears is in this language */
  language: string;
}

/** What one video is about */
export type Material =
  | {
      kind: 'product';
      name: string;
      description: string;
      priceCents: number;
      oldPriceCents: number | null;
      currency: 'BRL' | 'USD' | 'EUR';
      category: string | null;
      link: string | null;
      /** Relative to data/assets; the first one is the main photo */
      images: string[];
    }
  | { kind: 'brand'; about: string; images: string[]; links: string[] }
  | { kind: 'topic'; subject: string; avoid: string };

export function recipeOf(line: Line): Recipe {
  return {
    name: line.name,
    kind: line.kind,
    objective: line.objective,
    audience: line.audience,
    tone: line.tone,
    language: line.language,
  };
}

export function materialOf(line: Line, product: Product | null): Material {
  if (line.kind === 'brand') return { kind: 'brand', ...line.material };
  if (line.kind === 'topic') return { kind: 'topic', ...line.material };
  if (!product) throw new Error(`A video of product line "${line.name}" has no product`);
  return {
    kind: 'product',
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    oldPriceCents: product.oldPriceCents,
    currency: product.currency as 'BRL' | 'USD' | 'EUR',
    category: product.category,
    link: product.link,
    images: product.images,
  };
}

/** The name the crews call the subject by */
export function subjectOf(material: Material): string {
  if (material.kind === 'product') return material.name;
  if (material.kind === 'topic') return material.subject;
  return material.about.split(/[.!?]/)[0]!.trim();
}

export function formatPrice(cents: number, currency: string, language: string): string {
  const locale = /^[a-z]{2}-[A-Z]{2}$/.test(language) ? language : 'pt-BR';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export function recipeSection(recipe: Recipe): string {
  return [
    `## Production line: ${recipe.name} (${recipe.kind})`,
    `- Objective: ${recipe.objective}`,
    `- Audience: ${recipe.audience}`,
    `- Tone: ${recipe.tone}`,
    `- Language of everything the viewer reads or hears: ${recipe.language}`,
  ].join('\n');
}

export function rulesSection(rules: readonly string[]): string {
  if (rules.length === 0) return '## Learned rules\n(none yet)';
  return [
    "## Learned rules (from Hugo's rejections; always follow them)",
    ...rules.map((rule) => `- ${rule}`),
  ].join('\n');
}

export function materialSection(material: Material, language: string): string {
  if (material.kind === 'product') {
    const price = formatPrice(material.priceCents, material.currency, language);
    const old = material.oldPriceCents
      ? ` (was ${formatPrice(material.oldPriceCents, material.currency, language)})`
      : '';
    return [
      `## Product: ${material.name}`,
      material.description,
      `- Price: ${price}${old}`,
      ...(material.category ? [`- Category: ${material.category}`] : []),
      ...(material.link ? [`- Link: ${material.link}`] : []),
      `- Photos: ${material.images.length}`,
    ].join('\n');
  }
  if (material.kind === 'brand') {
    return [
      '## The brand',
      material.about,
      ...(material.links.length ? [`- Links: ${material.links.join(', ')}`] : []),
      `- Photos: ${material.images.length}`,
    ].join('\n');
  }
  return [
    `## Topic: ${material.subject}`,
    ...(material.avoid ? [`- Stay away from: ${material.avoid}`] : []),
  ].join('\n');
}

/** Instructions of the current round for one stage (from a review or from Hugo) */
export function instructionsSection(instructions: readonly string[]): string {
  if (instructions.length === 0) return '';
  return [
    '## Change requests for this new version (they come first)',
    ...instructions.map((instruction) => `- ${instruction}`),
  ].join('\n');
}

export function joinSections(...sections: string[]): string {
  return sections.filter((section) => section.trim() !== '').join('\n\n');
}

/** The first `max` words of a text, for the fake answers */
export function firstWords(text: string, max: number): string {
  return text.trim().split(/\s+/).slice(0, max).join(' ');
}

/** Cuts at a word boundary to fit `max` characters */
export function clip(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : clean.slice(0, max)).replace(/[,;:.!?-]+$/, '');
}

/** The stages a review or Hugo can send a video back to */
export const REWORK_STAGES = ['script', 'direction', 'produce'] as const;
export type ReworkStage = (typeof REWORK_STAGES)[number];

/** A change request for a stage of the next round */
export interface Instruction {
  stage: ReworkStage;
  instruction: string;
  source: 'review' | 'hugo';
}
