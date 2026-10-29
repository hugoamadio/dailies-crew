import { describe, expect, it } from 'vitest';
import { timezoneOptions } from './timezones';

describe('timezoneOptions', () => {
  it('keeps the stored zone and UTC even when the browser list lacks them', () => {
    const list = ['Africa/Abidjan', 'Asia/Calcutta'];
    expect(timezoneOptions(list, 'Asia/Kolkata')).toContain('Asia/Kolkata');
    expect(timezoneOptions(list, 'Etc/UTC')).toContain('Etc/UTC');
    expect(timezoneOptions(list, 'UTC')).toEqual(['Africa/Abidjan', 'Asia/Calcutta', 'UTC']);
  });
});
