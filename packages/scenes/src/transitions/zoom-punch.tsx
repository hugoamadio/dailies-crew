import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';
import { AbsoluteFill } from 'remotion';
import { EASE_IN_OUT } from '../theme/motion';

type ZoomPunchProps = Record<string, never>;

/** The camera rushes into the old scene, a white flash, and the new scene settles from close up */
const ZoomPunch: React.FC<TransitionPresentationComponentProps<ZoomPunchProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  const progress = EASE_IN_OUT(presentationProgress);
  const exiting = presentationDirection === 'exiting';
  const scale = exiting ? 1 + 0.6 * progress : 0.75 + 0.25 * progress;
  const blur = exiting ? 18 * progress : 18 * (1 - progress);
  const flash = Math.max(0, 1 - Math.abs(progress - 0.5) * 4) * 0.6;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          filter: `blur(${blur}px)`,
          opacity: exiting ? 1 - progress : progress,
        }}
      >
        {children}
      </AbsoluteFill>
      {exiting ? null : <AbsoluteFill style={{ backgroundColor: 'white', opacity: flash }} />}
    </AbsoluteFill>
  );
};

export function zoomPunch(): TransitionPresentation<ZoomPunchProps> {
  return { component: ZoomPunch, props: {} };
}
