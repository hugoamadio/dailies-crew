import type { Stage } from '@dailies-crew/db';
import type { StageHandler } from '../handler';
import { committee } from './committee';
import { direction } from './direction';
import { ideas } from './ideas';
import { prepare } from './prepare';
import { produce } from './produce';
import { review } from './review';
import { script } from './script';
import { social } from './social';

export const STAGE_HANDLERS: Record<Stage, StageHandler> = {
  prepare,
  ideas,
  committee,
  script,
  direction,
  produce,
  review,
  social,
};
