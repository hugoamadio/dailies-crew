import { fitTextOnNLines } from '@remotion/layout-utils';
import { useMemo } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { ContentArea } from '../../layers/ContentArea';
import { useBrand } from '../../theme/brand';
import { CLAMP, useEnter } from '../../theme/motion';
import { CONTENT_WIDTH } from '../../theme/safe-area';
import type { HookQuestionParams } from './spec';

const MAX_FONT_SIZE = 124;
const MAX_LINES = 4;

/** Lowercase letters and digits only, so "lua?" matches the emphasis "lua" */
const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const HookQuestion: React.FC<{ params: HookQuestionParams }> = ({ params }) => {
  const brand = useBrand();
  const enter = useEnter();
  const frame = useCurrentFrame();
  const { fontSize, lines } = useMemo(
    () =>
      fitTextOnNLines({
        text: params.question,
        maxLines: MAX_LINES,
        maxBoxWidth: CONTENT_WIDTH,
        fontFamily: brand.headingFamily,
        fontWeight: brand.headingWeight,
        maxFontSize: MAX_FONT_SIZE,
      }),
    [params.question, brand.headingFamily, brand.headingWeight],
  );
  const emphasis = new Set((params.emphasis ?? '').split(/\s+/).map(normalize).filter(Boolean));
  let wordIndex = 0;

  return (
    <ContentArea style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontSize,
          lineHeight: 1.08,
          textAlign: 'center',
          color: brand.colors.text,
          width: CONTENT_WIDTH,
        }}
      >
        {lines.map((line, lineIndex) => (
          <div key={lineIndex} style={{ whiteSpace: 'nowrap' }}>
            {line.split(' ').map((word, position, words) => {
              const index = wordIndex++;
              const progress = enter(4 + index * 3);
              const emphasized = emphasis.has(normalize(word));
              const underline = interpolate(frame, [20 + index * 3, 34 + index * 3], [0, 100], CLAMP);
              return (
                <span
                  key={index}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    marginRight: position < words.length - 1 ? '0.25em' : 0,
                    opacity: progress,
                    transform: `scale(${0.6 + 0.4 * progress})`,
                    color: emphasized ? brand.colors.accent : undefined,
                  }}
                >
                  {word}
                  {emphasized ? (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: '-0.06em',
                        height: '0.09em',
                        width: `${underline}%`,
                        borderRadius: 999,
                        backgroundColor: brand.colors.accent,
                      }}
                    />
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </ContentArea>
  );
};
