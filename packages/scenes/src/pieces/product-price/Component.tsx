import { fitText } from '@remotion/layout-utils';
import { useMemo } from 'react';
import { Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../../assets';
import { ContentArea } from '../../layers/ContentArea';
import { useBrand } from '../../theme/brand';
import { CLAMP, EASE_OUT, useEnter } from '../../theme/motion';
import { CONTENT_WIDTH } from '../../theme/safe-area';
import type { ProductPriceParams } from './spec';

const MAX_PRICE_SIZE = 170;

export const ProductPrice: React.FC<{ params: ProductPriceParams }> = ({ params }) => {
  const brand = useBrand();
  const enter = useEnter();
  const frame = useCurrentFrame();
  const format = useMemo(
    () => new Intl.NumberFormat(params.locale, { style: 'currency', currency: params.currency }),
    [params.locale, params.currency],
  );
  const finalText = format.format(params.price / 100);
  const priceSize = useMemo(
    () =>
      Math.min(
        MAX_PRICE_SIZE,
        fitText({
          text: finalText,
          withinWidth: CONTENT_WIDTH,
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontVariantNumeric: 'tabular-nums',
        }).fontSize,
      ),
    [finalText, brand.headingFamily, brand.headingWeight],
  );
  const counted = interpolate(frame, [6, 36], [params.oldPrice ?? 0, params.price], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const photoIn = enter(0);
  const labelIn = enter(30);

  return (
    <ContentArea style={{ alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <Img
        src={assetUrl(params.image)}
        style={{
          width: 480,
          height: 480,
          objectFit: 'contain',
          opacity: photoIn,
          transform: `scale(${0.9 + 0.1 * photoIn})`,
          filter: 'drop-shadow(0 28px 40px rgba(0,0,0,0.4))',
        }}
      />
      {params.oldPrice !== undefined ? (
        <div
          style={{
            fontFamily: brand.bodyFamily,
            fontSize: 52,
            color: brand.colors.text,
            opacity: 0.6 * enter(4),
            textDecoration: 'line-through',
            textDecorationThickness: 4,
          }}
        >
          {format.format(params.oldPrice / 100)}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontSize: priceSize,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          color: brand.colors.accent,
        }}
      >
        {format.format(Math.round(counted) / 100)}
      </div>
      {params.label ? (
        <div
          style={{
            fontFamily: brand.headingFamily,
            fontWeight: brand.headingWeight,
            fontSize: 46,
            padding: '10px 28px',
            borderRadius: 999,
            color: brand.colors.background,
            backgroundColor: brand.colors.accent,
            transform: `scale(${labelIn}) rotate(${(1 - labelIn) * -8}deg)`,
          }}
        >
          {params.label}
        </div>
      ) : null}
    </ContentArea>
  );
};
