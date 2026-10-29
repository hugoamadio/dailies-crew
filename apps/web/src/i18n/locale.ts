/** The panel's languages (spec section 2: English and Portuguese from day one) */
export const LOCALES = ['en', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

/** Where the language switch keeps the choice (one year) */
export const LOCALE_COOKIE = 'dailies-locale';

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/** The cookie wins; then the browser's first language we have; English otherwise */
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part) => part.split(';')[0]!.trim().toLowerCase())
    .filter(Boolean);
  for (const tag of wanted) {
    if (tag === 'pt' || tag.startsWith('pt-')) return 'pt-BR';
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
  }
  return 'en';
}

/** Fills "{name}" placeholders: fill('{count} videos', { count: 3 }) */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
