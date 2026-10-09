import type { CaptionWord } from '@dailies-crew/plan';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { fitTextOnNLines } from '@remotion/layout-utils';
import { useMemo } from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../theme/brand';
import { CAPTION_BAND, FRAME_HEIGHT, SAFE_AREA, SAFE_HEIGHT, SAFE_WIDTH } from '../theme/safe-area';
import { visiblePage } from './pages';

/** How close words must be to share a caption page */
const COMBINE_WITHIN_MS = 1000;

/** TikTok-style captions: a page of words at a time, the word being spoken in the accent color */
export const Captions: React.FC<{ words: CaptionWord[]; position: 'lower' | 'center' }> = ({
  words,
  position,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = useBrand();
  const pages = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: words,
        combineTokensWithinMilliseconds: COMBINE_WITHIN_MS,
      }).pages,
    [words],
  );
  const nowMs = (frame / fps) * 1000;
  const page = visiblePage(pages, nowMs);
  const pageText = page
    ? page.tokens
        .map((token) => token.text)
        .join('')
        .trim()
    : '';
  const fontSize = useMemo(
    () =>
      pageText
        ? fitTextOnNLines({
            text: pageText,
            maxLines: 2,
            maxBoxWidth: SAFE_WIDTH,
            fontFamily: brand.headingFamily,
            fontWeight: brand.headingWeight,
            maxFontSize: 70,
          }).fontSize
        : 70,
    [pageText, brand.headingFamily, brand.headingWeight],
  );
  if (!page) return null;

  const pageIn = spring({
    frame: Math.max(0, frame - Math.round((page.startMs / 1000) * fps)),
    fps,
    config: { damping: 14, stiffness: 200 },
  });
  const box =
    position === 'lower'
      ? { top: FRAME_HEIGHT - SAFE_AREA.bottom - CAPTION_BAND, height: CAPTION_BAND }
      : { top: SAFE_AREA.top, height: SAFE_HEIGHT };

  return (
    <AbsoluteFill
      style={{
        top: box.top,
        height: box.height,
        left: SAFE_AREA.left,
        right: SAFE_AREA.right,
        width: 'auto',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          maxWidth: SAFE_WIDTH,
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontSize,
          lineHeight: 1.12,
          textAlign: 'center',
          color: brand.colors.text,
          textShadow: '0 4px 20px rgba(0,0,0,0.6)',
          transform: `scale(${0.92 + 0.08 * pageIn})`,
        }}
      >
        {page.tokens.map((token) => {
          const active = nowMs >= token.fromMs && nowMs < token.toMs;
          return (
            <span
              key={token.fromMs}
              style={{ whiteSpace: 'pre-wrap', color: active ? brand.colors.accent : undefined }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
