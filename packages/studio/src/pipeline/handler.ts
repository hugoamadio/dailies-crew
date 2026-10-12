import type { Tx } from '@dailies-crew/db';
import type { StageRunContext, StudioContext } from './context';
import type { StageOutcome } from './outcome';

export interface StageResult {
  outcome: StageOutcome;
  /** What the stage received, for the video's history ("bastidores") */
  input?: unknown;
  /** What it produced */
  output: unknown;
  /** Database writes that happen together with marking the stage done */
  persist?: (tx: Tx) => Promise<unknown>;
}

export type StageHandler = (ctx: StudioContext, run: StageRunContext) => Promise<StageResult>;
