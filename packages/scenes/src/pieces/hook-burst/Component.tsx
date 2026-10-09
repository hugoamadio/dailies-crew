import { fitText } from '@remotion/layout-utils';
import { useMemo } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ContentArea } from '../../layers/ContentArea';
import { useBrand } from '../../theme/brand';
import { CLAMP, EASE_OUT } from '../../theme/motion';
import { CONTENT_WIDTH } from '../../theme/safe-area';
import type { HookBurstParams } from './spec';

const RAYS = 14;
const MAX_FONT_SIZE = 260;

export const HookBurst: React.FC<{ params: HookBurstParams }> = ({ params }) => {
  const brand = useBrand();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fontSize = useMemo(
    () =>
      Math.min(
        MAX_FONT_SIZE,
        fitText({
          text: params.text,
          withinWidth: CONTENT_WIDTH * 0.92,
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
        }).fontSize,
      ),
    [params.text, brand.headingFamily, brand.headingWeight],
  );
  const letters = [...params.text];
  // The rays-and-letters rhythm compresses for long text so the last letter starts by frame 10
  const stagger = Math.min(2, 10 / Math.max(1, letters.length - 1));
  const burst = interpolate(frame, [0, 14], [0, 1], { ...CLAMP, easing: EASE_OUT });
  // The rays and the ring are gone by frame 22: the settled frame stays inside the content area
  const raysOpacity = interpolate(frame, [4, 22], [1, 0], CLAMP);

  return (
    <ContentArea style={{ justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        {Array.from({ length: RAYS }, (_, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: 14,
              height: 80 + 180 * burst,
              borderRadius: 999,
              backgroundColor: brand.colors.accent,
              opacity: raysOpacity,
              transform: `rotate(${(360 / RAYS) * index}deg) translateY(${-(140 + 160 * burst)}px)`,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            width: 300 + 500 * burst,
            height: 300 + 500 * burst,
            borderRadius: '50%',
            border: `10px solid ${brand.colors.accent}`,
            opacity: raysOpacity,
          }}
        />
      </AbsoluteFill>
      <div
        style={{
          display: 'flex',
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontSize,
          lineHeight: 1,
          color: brand.colors.text,
          textShadow: `0 10px 40px ${brand.colors.accent}66`,
        }}
      >
        {letters.map((letter, index) => {
          const landed = spring({
            frame: Math.max(0, frame - index * stagger),
            fps,
            config: { damping: 11, stiffness: 180, mass: 0.7 },
          });
          return (
            <span
              key={index}
              style={{
                display: 'inline-block',
                whiteSpace: 'pre',
                transform: `scale(${2.4 - 1.4 * landed})`,
                filter: `blur(${(1 - landed) * 12}px)`,
                opacity: Math.min(1, landed * 1.5),
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>
    </ContentArea>
  );
};
