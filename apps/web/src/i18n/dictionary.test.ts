import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ptBR } from './pt-BR';

/** Every key path with its text: "nav.today" → "Today" */
function flatten(value: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') out.set(name, child);
    else for (const [inner, text] of flatten(child, name)) out.set(inner, text);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the dictionaries', () => {
  const english = flatten(en);
  const portuguese = flatten(ptBR);

  it('have the same keys, none empty', () => {
    expect([...portuguese.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [key, text] of [...english, ...portuguese]) expect(text.trim(), key).not.toBe('');
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, text] of english) {
      expect(placeholders(portuguese.get(key)!), key).toEqual(placeholders(text));
    }
  });
});
