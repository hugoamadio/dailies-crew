import type { TikTokPage } from '@remotion/captions';

/** How long a caption page stays on screen after its last word has been spoken */
export const CAPTION_LINGER_MS = 400;

/**
 * The caption page on screen at nowMs, if any. A page shows from its start until the next page
 * starts or CAPTION_LINGER_MS after its last word, whichever comes first, so the captions clear
 * during a pause in the speech (a silent scene) instead of waiting for the next line.
 */
export function visiblePage(pages: readonly TikTokPage[], nowMs: number): TikTokPage | undefined {
  return pages.find((page) => {
    const lastToken = page.tokens.at(-1);
    const end = Math.min(
      page.startMs + page.durationMs,
      lastToken ? lastToken.toMs + CAPTION_LINGER_MS : page.startMs,
    );
    return nowMs >= page.startMs && nowMs < end;
  });
}
