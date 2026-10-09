import { fitText } from '@remotion/layout-utils';
import { useMemo } from 'react';
import { ContentArea } from '../../layers/ContentArea';
import { useBrand } from '../../theme/brand';
import { useEnter } from '../../theme/motion';
import { CONTENT_WIDTH } from '../../theme/safe-area';
import type { KineticTitleParams } from './spec';

const MAX_FONT_SIZE = 190;

export const KineticTitle: React.FC<{ params: KineticTitleParams }> = ({ params }) => {
  const brand = useBrand();
  const enter = useEnter();
  const fontSize = useMemo(
    () =>
      Math.min(
        MAX_FONT_SIZE,
        ...params.lines.map(
          (line) =>
            fitText({
              text: line,
              withinWidth: CONTENT_WIDTH,
              fontFamily: brand.headingFamily,
              fontWeight: brand.headingWeight,
            }).fontSize,
        ),
      ),
    [params.lines, brand.headingFamily, brand.headingWeight],
  );
  return (
    <ContentArea
      style={{
        justifyContent: 'center',
        alignItems: params.align === 'left' ? 'flex-start' : 'center',
        gap: fontSize * 0.08,
      }}
    >
      {params.lines.map((line, index) => {
        const progress = enter(index * 6);
        return (
          <div
            key={index}
            style={{
              fontFamily: brand.headingFamily,
              fontWeight: brand.headingWeight,
              fontSize,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              color: index === params.highlight ? brand.colors.accent : brand.colors.text,
              opacity: progress,
              transform: `translateY(${(1 - progress) * 140}px) skewY(${(1 - progress) * -6}deg)`,
            }}
          >
            {line}
          </div>
        );
      })}
    </ContentArea>
  );
};
