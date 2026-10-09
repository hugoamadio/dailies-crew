import { FORMAT } from '@dailies-crew/plan';
import { Composition } from 'remotion';
import { DailiesVideo, type DailiesVideoProps } from './DailiesVideo';
import { DEMO_BRAND, demoResolvedPlan } from './demo';
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

const videoDefaults: DailiesVideoProps = { plan: demoResolvedPlan() };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DailiesVideo"
      component={DailiesVideo}
      width={FORMAT.width}
      height={FORMAT.height}
      fps={FORMAT.fps}
      durationInFrames={videoDefaults.plan.durationInFrames}
      defaultProps={videoDefaults}
      calculateMetadata={({ props }) => ({ durationInFrames: props.plan.durationInFrames })}
    />
    <Composition
      id="PiecePreview"
      component={PiecePreview}
      width={FORMAT.width}
      height={FORMAT.height}
      fps={FORMAT.fps}
      durationInFrames={90}
      defaultProps={previewDefaults}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round(props.seconds * FORMAT.fps),
      })}
    />
  </>
);
