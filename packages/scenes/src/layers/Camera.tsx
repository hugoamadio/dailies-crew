import type { CameraSpec } from '@dailies-crew/plan';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { noise2D } from '@remotion/noise';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CLAMP, EASE_IN_OUT, EASE_OUT } from '../theme/motion';

const AMOUNT = { subtle: 0.5, medium: 1, strong: 1.8 } as const;

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

  const content = (
    <AbsoluteFill style={{ transform, filter, transformOrigin: '50% 45%' }}>{children}</AbsoluteFill>
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
