import type { Direction } from '@dailies-crew/plan';
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from '@remotion/transitions';
import { AbsoluteFill } from 'remotion';
import { EASE_IN_OUT } from '../theme/motion';

type WhipProps = { direction: Direction };

/** A fast camera pan: both scenes travel the whole frame, heavily blurred in the middle */
const Whip: React.FC<TransitionPresentationComponentProps<WhipProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const towardStart = passedProps.direction === 'left' || passedProps.direction === 'up';
  const axis = passedProps.direction === 'left' || passedProps.direction === 'right' ? 'X' : 'Y';
  const sign = towardStart ? -1 : 1;
  const progress = EASE_IN_OUT(presentationProgress);
  const offset =
    presentationDirection === 'exiting' ? sign * progress * 100 : sign * (progress - 1) * 100;
  const blur = Math.sin(Math.PI * progress) * 24;
  return (
    <AbsoluteFill style={{ transform: `translate${axis}(${offset}%)`, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

export function whip(props: WhipProps): TransitionPresentation<WhipProps> {
  return { component: Whip, props };
}
