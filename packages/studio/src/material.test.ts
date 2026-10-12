import { describe, expect, it } from 'vitest';
import { pickProducts } from './material';

const day = (n: number) => new Date(Date.UTC(2026, 9, n));
const now = day(20);

describe('pickProducts', () => {
  it('starts with the products that never got a video, oldest first', () => {
    const candidates = [
      { id: 'used', createdAt: day(1), lastVideoAt: day(10) },
      { id: 'new-b', createdAt: day(3), lastVideoAt: null },
      { id: 'new-a', createdAt: day(2), lastVideoAt: null },
    ];
    expect(pickProducts(candidates, 2, now)).toEqual(['new-a', 'new-b']);
  });

  it('then repeats the least recently used product', () => {
    const candidates = [
      { id: 'recent', createdAt: day(1), lastVideoAt: day(15) },
      { id: 'old', createdAt: day(2), lastVideoAt: day(5) },
    ];
    expect(pickProducts(candidates, 1, now)).toEqual(['old']);
  });

  it('spreads a run over every product before repeating one', () => {
    const candidates = [
      { id: 'a', createdAt: day(1), lastVideoAt: null },
      { id: 'b', createdAt: day(2), lastVideoAt: day(3) },
    ];
    expect(pickProducts(candidates, 3, now)).toEqual(['a', 'b', 'a']);
  });

  it('picks nothing from an empty list', () => {
    expect(pickProducts([], 3, now)).toEqual([]);
  });
});
