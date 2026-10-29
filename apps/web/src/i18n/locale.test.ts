import { describe, expect, it } from 'vitest';
import { fill, pickLocale } from './locale';

describe('pickLocale', () => {
  it('takes the cookie first, then the browser languages, then English', () => {
    expect(pickLocale('pt-BR', 'en-US,en;q=0.9')).toBe('pt-BR');
    expect(pickLocale(undefined, 'pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt-BR');
    expect(pickLocale(undefined, 'pt-PT')).toBe('pt-BR');
    expect(pickLocale(undefined, 'fr-FR,en;q=0.5')).toBe('en');
    expect(pickLocale('de', 'de-DE')).toBe('en');
    expect(pickLocale(undefined, null)).toBe('en');
  });
});

describe('fill', () => {
  it('puts the values in and leaves unknown placeholders alone', () => {
    expect(fill('{count} videos for {line}', { count: 3, line: 'Lamps' })).toBe(
      '3 videos for Lamps',
    );
    expect(fill('{missing}', {})).toBe('{missing}');
  });
});
