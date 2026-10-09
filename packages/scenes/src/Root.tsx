import { FORMAT } from '@dailies-crew/plan';
import { Composition } from 'remotion';
import { DEMO_BRAND } from './demo';
import { PiecePreview, type PiecePreviewProps } from './PiecePreview';
import { kineticTitleSpec } from './pieces/kinetic-title/spec';

const previewDefaults: PiecePreviewProps = {
  pieceId: kineticTitleSpec.id,
  params: kineticTitleSpec.paramsSchema.parse(kineticTitleSpec.example),
  brand: DEMO_BRAND,
  camera: { move: 'push-in', intensity: 'medium' },
  light: { sweep: true, vignette: 0.35 },
  background: { kind: 'particles', density: 'medium' },
  seconds: 3,
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="PiecePreview"
      component={PiecePreview}
      width={FORMAT.width}
      height={FORMAT.height}
      fps={FORMAT.fps}
      durationInFrames={90}
      defaultProps={previewDefaults}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.seconds * FORMAT.fps) })}
    />
  </>
);
