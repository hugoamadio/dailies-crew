import { AbsoluteFill } from 'remotion';
import { CONTENT_AREA } from '../theme/safe-area';

/** The part of the frame a piece may draw in (safe area minus the caption band), as a flex column */
export const ContentArea: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <AbsoluteFill
    style={{
      top: CONTENT_AREA.top,
      right: CONTENT_AREA.right,
      bottom: CONTENT_AREA.bottom,
      left: CONTENT_AREA.left,
      width: 'auto',
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);
