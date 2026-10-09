import { describe, expect, it } from 'vitest';
import { alignmentToWords } from './alignment';

describe('alignmentToWords', () => {
  it('groups characters into words and keeps accents and punctuation', () => {
    const characters = [...'Promoção é já!'];
    const starts = characters.map((_, index) => index * 0.1);
    const ends = starts.map((start) => start + 0.1);
    expect(alignmentToWords(characters, starts, ends)).toEqual([
      { text: 'Promoção', startSeconds: 0, endSeconds: 0.8 },
      { text: 'é', startSeconds: 0.9, endSeconds: 1 },
      { text: 'já!', startSeconds: 1.1, endSeconds: 1.4 },
    ]);
  });
});
