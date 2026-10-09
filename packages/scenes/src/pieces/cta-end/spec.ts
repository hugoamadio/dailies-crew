import type { PieceSpec } from '@dailies-crew/plan';
import { z } from 'zod';

export const ctaEndParams = z.strictObject({
  cta: z.string().trim().min(1).max(40),
  handle: z.string().trim().min(2).max(40).optional(),
  showLogo: z.boolean().default(true),
});
export type CtaEndParams = z.output<typeof ctaEndParams>;

export const ctaEndSpec: PieceSpec = {
  id: 'cta-end',
  title: 'Call to action (closing)',
  description:
    'The closing scene: the brand logo spins in with a glow, then the call to action (e.g. "Link na bio") and an optional handle, with an arrow bouncing below. Use it as the last scene of every video.',
  paramsSchema: ctaEndParams,
  assetParams: [],
  minSeconds: 1.5,
  maxSeconds: 6,
  example: { cta: 'Link na bio', handle: '@feiraria' },
};
