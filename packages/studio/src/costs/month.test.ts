import { describe, expect, it } from 'vitest';
import { monthRange, monthStart } from './month';

describe('monthStart', () => {
  it('is midnight of the first day in São Paulo (UTC-3)', () => {
    expect(monthStart(new Date('2026-10-12T15:00:00Z'), 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-01T03:00:00.000Z',
    );
  });

  it('still counts the evening of the last day as that month, though UTC is already in the next', () => {
    // 2026-10-01T01:30Z is 22:30 on September 30 in São Paulo
    expect(monthStart(new Date('2026-10-01T01:30:00Z'), 'America/Sao_Paulo').toISOString()).toBe(
      '2026-09-01T03:00:00.000Z',
    );
  });

  it('follows daylight saving time', () => {
    // New York is UTC-4 on April 1 (summer time)
    expect(monthStart(new Date('2026-04-15T12:00:00Z'), 'America/New_York').toISOString()).toBe(
      '2026-04-01T04:00:00.000Z',
    );
  });
});

describe('monthStart boundary', () => {
  it('flips exactly at midnight in São Paulo', () => {
    const before = monthStart(new Date('2026-10-01T02:59:59.999Z'), 'America/Sao_Paulo');
    const at = monthStart(new Date('2026-10-01T03:00:00.000Z'), 'America/Sao_Paulo');
    expect(before.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(at.toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });
});

describe('monthRange', () => {
  it('spans one month, December included', () => {
    const range = monthRange('2026-12', 'America/Sao_Paulo');
    expect(range.start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(range.end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('refuses a malformed month', () => {
    expect(() => monthRange('2026-13', 'UTC')).toThrow('"2026-13" is not a month like 2026-10');
  });
});
