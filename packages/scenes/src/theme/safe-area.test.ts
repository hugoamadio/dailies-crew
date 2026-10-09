import { describe, expect, it } from 'vitest';
import { CAPTION_BAND, CONTENT_AREA, CONTENT_HEIGHT, CONTENT_WIDTH, SAFE_AREA, SAFE_HEIGHT, SAFE_WIDTH } from './safe-area';

describe('safe area', () => {
  it('keeps the content area inside the safe area, above the caption band', () => {
    expect(SAFE_WIDTH).toBe(858);
    expect(SAFE_HEIGHT).toBe(1240);
    expect(CONTENT_AREA.bottom).toBe(SAFE_AREA.bottom + CAPTION_BAND);
    expect(CONTENT_WIDTH).toBe(858);
    expect(CONTENT_HEIGHT).toBe(980);
  });
});
