import { fitText } from '@remotion/layout-utils';
import { useMemo } from 'react';
import { Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../../assets';
import { ContentArea } from '../../layers/ContentArea';
import { useBrand } from '../../theme/brand';
import { useEnter } from '../../theme/motion';
import { CONTENT_WIDTH } from '../../theme/safe-area';
import type { ProductHeroParams } from './spec';

const PHOTO_HEIGHT = 620;
/** Room above and below the photo for the float, so it never leaves its box */
const FLOAT_ROOM = 40;
const MAX_NAME_SIZE = 104;

export const ProductHero: React.FC<{ params: ProductHeroParams }> = ({ params }) => {
  const brand = useBrand();
  const enter = useEnter();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = enter(0);
  const nameIn = enter(8);
  const float = Math.sin((frame / fps) * 1.6) * 14;
  const nameSize = useMemo(
    () =>
      Math.min(
        MAX_NAME_SIZE,
        fitText({
          text: params.name,
          withinWidth: CONTENT_WIDTH,
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
        }).fontSize,
      ),
    [params.name, brand.headingFamily, brand.headingWeight],
  );

  return (
    <ContentArea style={{ alignItems: 'center', justifyContent: 'flex-start', gap: 28 }}>
      <div style={{ position: 'relative', width: CONTENT_WIDTH, height: PHOTO_HEIGHT }}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 6,
            width: 420,
            height: 56,
            marginLeft: -210,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)',
            transform: `scaleX(${1 - float / 120})`,
            opacity: appear,
          }}
        />
        <Img
          src={assetUrl(params.image)}
          style={{
            position: 'absolute',
            left: 0,
            top: FLOAT_ROOM,
            width: '100%',
            height: PHOTO_HEIGHT - 2 * FLOAT_ROOM,
            objectFit: 'contain',
            opacity: appear,
            transform: `translateY(${float}px) scale(${0.86 + 0.14 * appear})`,
            filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.45))',
          }}
        />
      </div>
      <div
        style={{
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontSize: nameSize,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          color: brand.colors.text,
          opacity: nameIn,
          transform: `translateY(${(1 - nameIn) * 40}px)`,
        }}
      >
        {params.name}
      </div>
      {params.tagline ? (
        <div
          style={{
            fontFamily: brand.bodyFamily,
            fontSize: 44,
            lineHeight: 1.2,
            textAlign: 'center',
            maxWidth: CONTENT_WIDTH,
            color: brand.colors.text,
            opacity: 0.85 * enter(14),
          }}
        >
          {params.tagline}
        </div>
      ) : null}
    </ContentArea>
  );
};
