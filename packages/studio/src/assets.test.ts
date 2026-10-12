import { isSafeRelativePath } from '@dailies-crew/plan';
import { describe, expect, it } from 'vitest';
import { safeFileName } from './assets';

describe('safeFileName', () => {
  it('cuts a very long name, keeps the extension and leaves the path under the limit', () => {
    const name = safeFileName(`${'a'.repeat(300)}.jpg`);
    expect(name.endsWith('.jpg')).toBe(true);
    expect(name.length).toBeLessThanOrEqual(84);
    const id = '123e4567-e89b-12d3-a456-426614174000';
    expect(isSafeRelativePath(`products/${id}/10-${name}`)).toBe(true);
  });

  it('turns odd names into safe ones', () => {
    expect(safeFileName('../x.png')).toBe('x.png');
    expect(safeFileName('a b é.PNG')).toBe('a-b-e.PNG');
    expect(safeFileName('.png')).toBe('png');
    expect(safeFileName('???')).toBe('file');
  });
});
