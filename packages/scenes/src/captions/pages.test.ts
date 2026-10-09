import { createTikTokStyleCaptions } from '@remotion/captions';
import { describe, expect, it } from 'vitest';
import { CAPTION_LINGER_MS, visiblePage } from './pages';

/** Caption pages the way Captions.tsx builds them: one page per voice line */
function pagesOf(lines: { text: string; startMs: number; endMs: number }[][]) {
  const captions = lines.flatMap((line, lineIndex) =>
    line.map((word, wordIndex) => ({
      text: lineIndex > 0 || wordIndex > 0 ? ` ${word.text}` : word.text,
      startMs: word.startMs,
      endMs: word.endMs,
      timestampMs: null,
      confidence: null,
      ...(wordIndex === line.length - 1 ? { pageBreakAfter: true } : {}),
    })),
  );
  return createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 1000 }).pages;
}

const first = [
  { text: 'pronto', startMs: 0, endMs: 300 },
  { text: 'para', startMs: 350, endMs: 600 },
  { text: 'presentear.', startMs: 650, endMs: 1000 },
];

describe('visiblePage', () => {
  it('lingers 400 ms after the last word', () => {
    expect(CAPTION_LINGER_MS).toBe(400);
  });

  it('shows a page right after it starts', () => {
    const pages = pagesOf([first, [{ text: 'Oferta', startMs: 3000, endMs: 3400 }]]);
    expect(visiblePage(pages, 10)?.text).toBe('pronto para presentear.');
  });

  it('keeps the page 300 ms after the last word', () => {
    const pages = pagesOf([first, [{ text: 'Oferta', startMs: 3000, endMs: 3400 }]]);
    expect(visiblePage(pages, 1300)?.text).toBe('pronto para presentear.');
  });

  it('hides the page 500 ms after the last word, though the next page starts 2 s later', () => {
    const pages = pagesOf([first, [{ text: 'Oferta', startMs: 3000, endMs: 3400 }]]);
    const [page] = pages;
    expect(page && page.startMs + page.durationMs).toBe(3000);
    expect(visiblePage(pages, 1500)).toBeUndefined();
    expect(visiblePage(pages, 2900)).toBeUndefined();
    expect(visiblePage(pages, 3010)?.text).toBe('Oferta');
  });

  it('picks the right page when two pages are back to back', () => {
    const pages = pagesOf([first, [{ text: 'Oferta', startMs: 1100, endMs: 1500 }]]);
    expect(visiblePage(pages, 1050)?.text).toBe('pronto para presentear.');
    expect(visiblePage(pages, 1100)?.text).toBe('Oferta');
    expect(visiblePage(pages, 1400)?.text).toBe('Oferta');
    expect(visiblePage(pages, 1950)).toBeUndefined();
  });
});
