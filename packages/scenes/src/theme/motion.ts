import { Easing, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from './brand';

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** How springy entrances are, per brand personality */
export const SPRINGS = {
  calm: { damping: 26, stiffness: 90, mass: 1 },
  energetic: { damping: 16, stiffness: 170, mass: 0.9 },
  playful: { damping: 9, stiffness: 150, mass: 0.8 },
  premium: { damping: 30, stiffness: 110, mass: 1.1 },
} as const;

/** enter(delay) goes from 0 to 1 (with the brand's spring) starting `delay` frames into the scene */
export function useEnter(): (delayFrames?: number) => number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { personality } = useBrand();
  return (delayFrames = 0) =>
    spring({ frame: Math.max(0, frame - delayFrames), fps, config: SPRINGS[personality] });
}
