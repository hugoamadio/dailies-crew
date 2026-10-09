import type { PieceSpec } from '@dailies-crew/plan';
import { z } from 'zod';

export const kineticTitleParams = z.strictObject({
  lines: z.array(z.string().trim().min(1).max(28)).min(1).max(3),
  align: z.enum(['left', 'center']).default('center'),
  /** Index of the line drawn in the accent color */
  highlight: z.number().int().min(0).max(2).optional(),
});
export type KineticTitleParams = z.output<typeof kineticTitleParams>;

export const kineticTitleSpec: PieceSpec = {
  id: 'kinetic-title',
  title: 'Kinetic title',
  description:
    'One to three short lines (up to 28 characters each) that slide up one after another, as big as the frame allows. One line can be drawn in the accent color. Use it for statements, section titles and the promise of the video.',
  paramsSchema: kineticTitleParams,
  assetParams: [],
  minSeconds: 1.5,
  maxSeconds: 8,
  example: { lines: ['Feito à mão', 'em 3D'], highlight: 1 },
};
