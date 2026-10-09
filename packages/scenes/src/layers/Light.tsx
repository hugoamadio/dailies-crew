import type { LightSpec } from '@dailies-crew/plan';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useSceneDuration } from '../theme/scene-duration';

/** A band of light crossing the frame once, and darker corners that pull the eye to the center */
export const Light: React.FC<{ light: LightSpec }> = ({ light }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const durationInFrames = useSceneDuration();
  const sweepX = interpolate(frame, [0, durationInFrames], [-1.1 * width, 1.1 * width]);
  return (
    <>
      {light.sweep ? (
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.28) 50%, transparent 60%)',
            transform: `translateX(${sweepX}px)`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      {light.vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,${0.75 * light.vignette}) 100%)`,
          }}
        />
      ) : null}
    </>
  );
};
