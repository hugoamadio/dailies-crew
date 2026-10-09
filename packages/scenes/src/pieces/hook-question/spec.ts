import type { PieceSpec } from '@dailies-crew/plan';
import { z } from 'zod';

export const hookQuestionParams = z.object({
  question: z.string().trim().min(3).max(80),
  /** Words of the question drawn in the accent color and underlined */
  emphasis: z.string().trim().min(1).max(30).optional(),
});
export type HookQuestionParams = z.output<typeof hookQuestionParams>;

export const hookQuestionSpec: PieceSpec = {
  id: 'hook-question',
  title: 'Hook: question',
  description:
    'A question that fills the screen, its words popping in one by one; the emphasized words turn to the accent color and get underlined. Made for the first 3 seconds: ask something the viewer wants answered.',
  paramsSchema: hookQuestionParams,
  assetParams: [],
  minSeconds: 1.5,
  maxSeconds: 6,
  example: { question: 'Sua mesa merece uma lua só dela?', emphasis: 'lua' },
};
