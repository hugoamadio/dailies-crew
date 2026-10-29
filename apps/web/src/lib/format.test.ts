import { describe, expect, it } from 'vitest';
import { formatter } from './format';

const NBSP = ' ';

describe('formatter', () => {
  it('writes dollars in each language, with 4 decimals under one cent', () => {
    const en = formatter('en', 'America/Sao_Paulo');
    const pt = formatter('pt-BR', 'America/Sao_Paulo');
    expect(en.usd(1.5)).toBe('$1.50');
    expect(en.usd(0.0042)).toBe('$0.0042');
    expect(en.usd(0)).toBe('$0.00');
    expect(pt.usd(12.345)).toBe(`US$${NBSP}12,35`);
    expect(pt.price(8990, 'BRL')).toBe(`R$${NBSP}89,90`);
  });

  it('shows dates in the settings time zone', () => {
    const at = new Date('2026-10-13T01:30:00Z'); // 22:30 on October 12 in São Paulo
    expect(formatter('pt-BR', 'America/Sao_Paulo').dateTime(at)).toBe('12/10/2026, 22:30');
    expect(formatter('en', 'UTC').time(at)).toBe('1:30 AM');
  });

  it('writes a length as minutes and seconds', () => {
    expect(formatter('en', 'UTC').seconds(42.4)).toBe('0:42');
    expect(formatter('en', 'UTC').seconds(61)).toBe('1:01');
  });
});
