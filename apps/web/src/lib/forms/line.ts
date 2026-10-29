import { all, checked, lines, num, text } from './read';

/** The five brand colors; the line form (a client component) imports it too */
export const COLORS = ['background', 'surface', 'text', 'primary', 'accent'] as const;

function material(form: FormData, kind: string): Record<string, unknown> {
  if (kind === 'product') {
    const select = text(form, 'material.select');
    if (select === 'category') return { select, category: text(form, 'material.category') };
    if (select === 'chosen') return { select, productIds: all(form, 'material.productIds') };
    return { select: 'all' };
  }
  if (kind === 'brand') {
    return {
      about: text(form, 'material.about'),
      // the brand photos are not edited by the panel: the current ones come back as hidden fields
      images: all(form, 'material.images'),
      links: lines(form, 'material.links'),
    };
  }
  return { subject: text(form, 'material.subject'), avoid: text(form, 'material.avoid') };
}

/** The line form as the studio's line input (createLine); "active" only exists on creation */
export function lineFromForm(form: FormData): Record<string, unknown> {
  return { ...linePatchFromForm(form), kind: text(form, 'kind'), active: checked(form, 'active') };
}

/**
 * The same form as the changes updateLine takes: everything but the kind (fixed) and "active"
 * (the on/pause switch). The kind still comes in a hidden field to read the right material.
 */
export function linePatchFromForm(form: FormData): Record<string, unknown> {
  const kind = text(form, 'kind');
  const logo = text(form, 'brand.logo');
  return {
    name: text(form, 'name'),
    material: material(form, kind),
    perDay: num(form, 'perDay'),
    hour: num(form, 'hour'),
    language: text(form, 'language'),
    objective: text(form, 'objective'),
    audience: text(form, 'audience'),
    tone: text(form, 'tone'),
    brand: {
      colors: Object.fromEntries(
        COLORS.map((color) => [color, text(form, `brand.colors.${color}`)]),
      ),
      headingFont: text(form, 'brand.headingFont'),
      bodyFont: text(form, 'brand.bodyFont'),
      personality: text(form, 'brand.personality'),
      ...(logo ? { logo } : {}),
    },
    voice: { provider: text(form, 'voice.provider'), voiceId: text(form, 'voice.voiceId') },
    musicTrack: text(form, 'musicTrack') || null,
    monthlyCapUsd: num(form, 'monthlyCapUsd'),
  };
}
