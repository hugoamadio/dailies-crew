import type { BackgroundSpec, CameraSpec, LightSpec } from '@dailies-crew/plan';
import { AbsoluteFill } from 'remotion';
import { Background } from './layers/Background';
import { Camera } from './layers/Camera';
import { Light } from './layers/Light';
import { pieceComponents } from './pieces';

export type SceneLike = {
  piece: string;
  params: Record<string, unknown>;
  camera: CameraSpec;
  light: LightSpec;
  background: BackgroundSpec;
};

/** One scene: background, then the piece seen through the camera, then the light on top */
export const SceneFrame: React.FC<{ scene: SceneLike }> = ({ scene }) => {
  const Piece = pieceComponents[scene.piece];
  if (!Piece) throw new Error(`Unknown piece "${scene.piece}"`);
  return (
    <AbsoluteFill>
      <Background background={scene.background} />
      <Camera camera={scene.camera}>
        <Piece params={scene.params} />
      </Camera>
      <Light light={scene.light} />
    </AbsoluteFill>
  );
};
