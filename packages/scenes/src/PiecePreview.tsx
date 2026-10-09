import type { BackgroundSpec, Brand, CameraSpec, LightSpec } from '@dailies-crew/plan';
import { SceneFrame } from './SceneFrame';
import { BrandProvider } from './theme/brand';

export type PiecePreviewProps = {
  pieceId: string;
  params: Record<string, unknown>;
  brand: Brand;
  camera: CameraSpec;
  light: LightSpec;
  background: BackgroundSpec;
  seconds: number;
};

/** A single piece on its own: the visual tests, the Studio and (later) the library gallery */
export const PiecePreview: React.FC<PiecePreviewProps> = (props) => (
  <BrandProvider brand={props.brand}>
    <SceneFrame
      scene={{
        piece: props.pieceId,
        params: props.params,
        camera: props.camera,
        light: props.light,
        background: props.background,
      }}
    />
  </BrandProvider>
);
