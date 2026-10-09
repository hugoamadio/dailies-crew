import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../../assets';
import { ContentArea } from '../../layers/ContentArea';
import { useBrand } from '../../theme/brand';
import { useEnter } from '../../theme/motion';
import type { ProductLoupeParams } from './spec';

const BOX = 800;
const LENS = 340;
/** The lens stays fully over the photo box, so it never leaves the content area */
const clampLens = (value: number) => Math.min(BOX - LENS / 2, Math.max(LENS / 2, value));

export const ProductLoupe: React.FC<{ params: ProductLoupeParams }> = ({ params }) => {
  const brand = useBrand();
  const enter = useEnter();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const travel = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const cx = clampLens(interpolate(travel, [0, 1], [BOX / 2, params.focus.x * BOX]));
  const cy = clampLens(interpolate(travel, [0, 1], [BOX * 0.9, params.focus.y * BOX]));
  const src = assetUrl(params.image);

  return (
    <ContentArea style={{ alignItems: 'center', justifyContent: 'center', gap: 36 }}>
      <div style={{ position: 'relative', width: BOX, height: BOX, opacity: enter(0) }}>
        <Img src={src} style={{ width: BOX, height: BOX, objectFit: 'contain' }} />
        <div
          style={{
            position: 'absolute',
            left: cx - LENS / 2,
            top: cy - LENS / 2,
            width: LENS,
            height: LENS,
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: brand.colors.surface,
            // A ring drawn with box-shadow: unlike a border, it does not shift the lens content
            boxShadow: `0 0 0 8px ${brand.colors.accent}, 0 24px 60px rgba(0,0,0,0.5)`,
            transform: `scale(${enter(6)})`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: -(cx - LENS / 2),
              top: -(cy - LENS / 2),
              width: BOX,
              height: BOX,
              transform: `scale(${params.zoom})`,
              transformOrigin: `${cx}px ${cy}px`,
            }}
          >
            <Img src={src} style={{ width: BOX, height: BOX, objectFit: 'contain' }} />
          </div>
        </div>
      </div>
      <div
        style={{
          fontFamily: brand.headingFamily,
          fontWeight: brand.headingWeight,
          fontSize: 64,
          textAlign: 'center',
          color: brand.colors.text,
          opacity: enter(24),
        }}
      >
        {params.label}
      </div>
    </ContentArea>
  );
};
