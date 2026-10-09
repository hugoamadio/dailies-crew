import type { ResolvedTransition } from '@dailies-crew/plan';
import type { TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { iris } from '@remotion/transitions/iris';
import { none } from '@remotion/transitions/none';
import { pushCut } from '@remotion/transitions/push-cut';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { FRAME_HEIGHT, FRAME_WIDTH } from '../theme/safe-area';
import { whip } from './whip';
import { zoomPunch } from './zoom-punch';

type AnyPresentation = TransitionPresentation<Record<string, unknown>>;

/** The plan says where the content travels; Remotion says where the new scene comes from */
const FROM = {
  left: 'from-right',
  right: 'from-left',
  up: 'from-bottom',
  down: 'from-top',
} as const;

export function presentationFor(transition: ResolvedTransition): AnyPresentation {
  const any = (presentation: unknown) => presentation as AnyPresentation;
  switch (transition.kind) {
    case 'cut':
      return any(none());
    case 'fade':
      return any(fade());
    case 'slide':
      return any(slide({ direction: FROM[transition.direction] }));
    case 'wipe':
      return any(wipe({ direction: FROM[transition.direction] }));
    case 'iris':
      return any(iris({ width: FRAME_WIDTH, height: FRAME_HEIGHT }));
    case 'push':
      return any(pushCut());
    case 'whip':
      return any(whip({ direction: transition.direction }));
    case 'zoom-punch':
      return any(zoomPunch());
  }
}
