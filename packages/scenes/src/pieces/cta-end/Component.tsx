import { fitText } from '@remotion/layout-utils';
import { useMemo } from 'react';
import { Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../../assets';
import { ContentArea } from '../../layers/ContentArea';
import { useBrand } from '../../theme/brand';
import { useEnter } from '../../theme/motion';
import { CONTENT_WIDTH } from '../../theme/safe-area';
import type { CtaEndParams } from './spec';

const LOGO_SIZE = 300;
const MAX_CTA_SIZE = 132;
const MAX_HANDLE_SIZE = 52;

export const CtaEnd: React.FC<{ params: CtaEndParams }> = ({ params }) => {
  const brand = useBrand();
  const enter = useEnter();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ctaSize = useMemo(
    () =>
      Math.min(
        MAX_CTA_SIZE,
        fitText({
          text: params.cta,
          withinWidth: CONTENT_WIDTH,
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
        }).fontSize,
      ),
    [params.cta, brand.headingFamily, brand.headingWeight],
  );
  const handleSize = useMemo(
    () =>
      params.handle
        ? Math.min(
            MAX_HANDLE_SIZE,
            fitText({
              text: params.handle,
              withinWidth: CONTENT_WIDTH,
              fontFamily: brand.bodyFamily,
            }).fontSize,
          )
        : MAX_HANDLE_SIZE,
    [params.handle, brand.bodyFamily],
  );
  const logoIn = enter(0);
  const ctaIn = enter(8);
  const bounce = Math.abs(Math.sin((frame / fps) * Math.PI * 1.6)) * 18;
  const logo = params.showLogo ? brand.logo : undefined;

  return (
    <ContentArea style={{ alignItems: 'center', justifyContent: 'center', gap: 40 }}>
      {logo ? (
        <div
          style={{
            position: 'relative',
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            transform: `scale(${logoIn}) rotate(${(1 - logoIn) * -25}deg)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: -30,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${brand.colors.accent}55, transparent 70%)`,
            }}
          />
          <Img
            src={assetUrl(logo)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontSize: ctaSize,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          color: brand.colors.text,
          opacity: ctaIn,
          transform: `translateY(${(1 - ctaIn) * 50}px)`,
        }}
      >
        {params.cta}
      </div>
      {params.handle ? (
        <div
          style={{
            fontFamily: brand.bodyFamily,
            fontSize: handleSize,
            whiteSpace: 'nowrap',
            color: brand.colors.accent,
            opacity: enter(14),
          }}
        >
          {params.handle}
        </div>
      ) : null}
      <svg
        width="90"
        height="60"
        viewBox="0 0 90 60"
        style={{ transform: `translateY(${bounce}px)`, opacity: enter(20) }}
      >
        <path
          d="M10 10 L45 45 L80 10"
          stroke={brand.colors.accent}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </ContentArea>
  );
};
