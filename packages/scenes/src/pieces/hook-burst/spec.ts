import type { PieceSpec } from '@dailies-crew/plan';
import { z } from 'zod';

export const hookBurstParams = z.strictObject({
  text: z.string().trim().min(1).max(24),
});
export type HookBurstParams = z.output<typeof hookBurstParams>;

export const hookBurstSpec: PieceSpec = {
  id: 'hook-burst',
  title: 'Hook: burst',
  description:
    'One short word or phrase (up to 24 characters) that explodes onto the screen: letters land one by one from big and blurred, with rays and a ring bursting behind them. Use it for a punch: OFFER!, NEW, WAIT... Works best silent, between two spoken scenes.',
  paramsSchema: hookBurstParams,
  assetParams: [],
  minSeconds: 1,
  maxSeconds: 4,
  example: { text: 'OFERTA!' },
};
