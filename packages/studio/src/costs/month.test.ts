import { describe, expect, it } from 'vitest';
import { monthRange, monthStart, nextDailyRun, zonedDayStart } from './month';

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

describe('zonedDayStart', () => {
  it('is midnight of the day São Paulo sees, even when UTC is already tomorrow', () => {
    // 2026-10-13T01:30Z is 22:30 on October 12 in São Paulo
    expect(zonedDayStart(new Date('2026-10-13T01:30:00Z'), 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-12T03:00:00.000Z',
    );
  });
});

describe('nextDailyRun', () => {
  it('is later today when the hour has not come yet, tomorrow otherwise', () => {
    const morning = new Date('2026-10-12T11:00:00Z'); // 08:00 in São Paulo
    expect(nextDailyRun(9, 'America/Sao_Paulo', morning).toISOString()).toBe(
      '2026-10-12T12:00:00.000Z',
    );
    expect(nextDailyRun(8, 'America/Sao_Paulo', morning).toISOString()).toBe(
      '2026-10-13T11:00:00.000Z',
    );
  });

  it('crosses the end of the month and follows daylight saving time', () => {
    expect(
      nextDailyRun(9, 'America/Sao_Paulo', new Date('2026-10-31T20:00:00Z')).toISOString(),
    ).toBe('2026-11-01T12:00:00.000Z');
    // New York leaves summer time on November 1, 2026: 9:00 is 13:00Z before, 14:00Z after
    expect(
      nextDailyRun(9, 'America/New_York', new Date('2026-10-31T20:00:00Z')).toISOString(),
    ).toBe('2026-11-01T14:00:00.000Z');
  });
});
