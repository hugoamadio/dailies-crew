import type { CameraSpec } from '@dailies-crew/plan';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { noise2D } from '@remotion/noise';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP, EASE_IN_OUT, EASE_OUT } from '../theme/motion';
import { CONTENT_AREA, CONTENT_HEIGHT, CONTENT_WIDTH } from '../theme/safe-area';

const AMOUNT = { subtle: 0.5, medium: 1, strong: 1.8 } as const;

/** Center of the content area: every move scales around it */
const ORIGIN = `${CONTENT_AREA.left + CONTENT_WIDTH / 2}px ${CONTENT_AREA.top + CONTENT_HEIGHT / 2}px`;

/** How much bigger than the content area the piece gets at the peak of the move */
function headroom(camera: CameraSpec): number {
  const a = AMOUNT[camera.intensity];
  switch (camera.move) {
    case 'push-in':
    case 'pull-out':
      return 1 + 0.12 * a;
    case 'pan-left':
    case 'pan-right':
      // The translate comes after scale() in the transform, so it is zoomed too (a product, not a sum).
      // The piece must shrink until its half width plus that shifted distance fits in half the area.
      return (1 + 0.08 * a) / (1 - ((1 + 0.08 * a) * 40 * a) / (CONTENT_WIDTH / 2));
    case 'handheld':
      return 1.04 + 0.04 * a;
    default:
      return 1;
  }
}

/** Moves the piece like a camera would; the background stays put, which reads as depth */
export const Camera: React.FC<{ camera: CameraSpec; children: React.ReactNode }> = ({ camera, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const amount = AMOUNT[camera.intensity];
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });
  let transform = 'none';
  let filter: string | undefined;

  switch (camera.move) {
    case 'static':
      break;
    case 'push-in':
      transform = `scale(${1 + 0.12 * amount * progress})`;
      break;
    case 'pull-out':
      transform = `scale(${1 + 0.12 * amount * (1 - progress)})`;
      break;
    case 'pan-left':
      transform = `scale(${1 + 0.08 * amount}) translateX(${interpolate(progress, [0, 1], [40, -40]) * amount}px)`;
      break;
    case 'pan-right':
      transform = `scale(${1 + 0.08 * amount}) translateX(${interpolate(progress, [0, 1], [-40, 40]) * amount}px)`;
      break;
    case 'handheld': {
      const x = noise2D('camera-x', frame / 45, 0) * 10 * amount;
      const y = noise2D('camera-y', 0, frame / 45) * 10 * amount;
      const rotation = noise2D('camera-rotation', frame / 60, 1) * 0.6 * amount;
      transform = `scale(1.04) translate(${x}px, ${y}px) rotate(${rotation}deg)`;
      break;
    }
    case 'rack-focus':
      filter = `blur(${interpolate(frame, [0, 18], [10 * amount, 0], { ...CLAMP, easing: EASE_OUT })}px)`;
      break;
  }

  // Pieces are sized to fill the content area, so the piece starts 1/headroom smaller and the move
  // grows it back: at the peak it fills the content area exactly instead of leaving it
  const content = (
    <AbsoluteFill style={{ transform, filter, transformOrigin: ORIGIN }}>
      <AbsoluteFill style={{ transform: `scale(${1 / headroom(camera)})`, transformOrigin: ORIGIN }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
  // Motion blur only where the move is fast enough to need it: it renders the frame 6 times
  const blurred = camera.intensity === 'strong' && camera.move !== 'static' && camera.move !== 'rack-focus';
  return blurred ? (
    <CameraMotionBlur samples={6} shutterAngle={180}>
      {content}
    </CameraMotionBlur>
  ) : (
    content
  );
};
