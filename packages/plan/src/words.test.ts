import { describe, expect, it } from 'vitest';
import { fakeWords } from './words';

describe('fakeWords', () => {
  it('gives every word 0.32 s and a 0.08 s gap, plus a short tail', () => {
    expect(fakeWords(' Olá   mundo ')).toEqual({
      words: [
        { text: 'Olá', startSeconds: 0.05, endSeconds: 0.37 },
        { text: 'mundo', startSeconds: 0.45, endSeconds: 0.77 },
      ],
      durationSeconds: 0.92,
    });
  });
});
