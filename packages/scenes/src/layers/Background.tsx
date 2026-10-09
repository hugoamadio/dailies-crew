import type { BackgroundSpec } from '@dailies-crew/plan';
import { noise2D } from '@remotion/noise';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../theme/brand';
import { useSceneDuration } from '../theme/scene-duration';

const PARTICLES = { low: 24, medium: 48, high: 90 } as const;

export const Background: React.FC<{ background: BackgroundSpec }> = ({ background }) => {
  const { colors } = useBrand();
  const frame = useCurrentFrame();
  const durationInFrames = useSceneDuration();
  switch (background.kind) {
    case 'solid':
      return <AbsoluteFill style={{ backgroundColor: colors.background }} />;
    case 'gradient': {
      // The angle drifts a little during the scene, so the background never looks frozen
      const angle = background.angle + interpolate(frame, [0, durationInFrames], [0, 25]);
      return (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${angle}deg, ${colors.background} 0%, ${colors.surface} 55%, ${colors.primary} 140%)`,
          }}
        />
      );
    }
    case 'particles':
      return <Particles count={PARTICLES[background.density]} />;
    case 'grain':
      return <Grain />;
  }
};

const Particles: React.FC<{ count: number }> = ({ count }) => {
  const { colors } = useBrand();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, index) => {
        const size = 4 + random(`particle-size-${index}`) * 14;
        const speed = 20 + random(`particle-speed-${index}`) * 60;
        const x =
          random(`particle-x-${index}`) * width +
          noise2D(`particle-wobble-${index}`, frame / 90, index) * 30;
        const y =
          height -
          ((random(`particle-y-${index}`) * height + (frame / fps) * speed) % (height + 40));
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: colors.accent,
              opacity: 0.15 + random(`particle-opacity-${index}`) * 0.35,
              filter: size > 12 ? 'blur(2px)' : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => {
  const { colors } = useBrand();
  const seed = Math.floor(useCurrentFrame() / 2);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.09 }}>
        <filter id={`grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
