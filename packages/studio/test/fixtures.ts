import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_BRAND } from '@dailies-crew/scenes/demo';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** The example's photo and logo (Phase 1A) */
export const LAMP_SVG = path.join(repoRoot, 'examples/feiraria-lamp/assets/products/lamp.svg');
export const LOGO_SVG = path.join(repoRoot, 'examples/feiraria-lamp/assets/brand/logo.svg');

/** A fresh data folder in the system temp folder; remove it with fs.rm after the test */
export async function tempDataDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'dailies-data-'));
}

const { logo: _logo, ...brandWithoutLogo } = DEMO_BRAND;

export function productLineInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Store products',
    kind: 'product',
    material: { select: 'all' },
    perDay: 3,
    hour: 9,
    language: 'pt-BR',
    objective: 'sell the product: take people to the link in the bio',
    audience: 'people who like design and 3D printed decoration',
    tone: 'energetic and warm',
    brand: brandWithoutLogo,
    voice: { provider: 'fake', voiceId: 'demo' },
    monthlyCapUsd: 10,
    ...overrides,
  };
}

export function topicLineInput(overrides: Record<string, unknown> = {}) {
  return {
    ...productLineInput(),
    name: '3D printing tips',
    kind: 'topic',
    material: { subject: 'Tips to get better 3D prints at home', avoid: 'brand names' },
    perDay: 1,
    ...overrides,
  };
}

export function productInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Luminária Lua',
    description: 'A moon lamp printed in 3D, layer by layer, that lights up in 3 colors.',
    priceCents: 8990,
    oldPriceCents: 12990,
    currency: 'BRL',
    category: 'lamps',
    link: 'https://example.com/lua',
    ...overrides,
  };
}
