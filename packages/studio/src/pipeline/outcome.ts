import type { Stage, Tx } from '@dailies-crew/db';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Instruction, ReworkStage } from '../crew/context';
import { jobDir } from '../paths';
import type { StudioContext } from './context';
import { json } from './json';
import { nextStage } from './stages';

export type StageOutcome =
  /** Go on to the next stage; after the last one the video is ready for Hugo */
  | { kind: 'next' }
  /** A review (or the produce stage) sends the video back: a new round starts at `from` */
  | { kind: 'rework'; from: ReworkStage; instructions: Instruction[] }
  /** The crews cannot fix it: Hugo gets the video with the problems listed */
  | { kind: 'needs_you'; problems: string[] };

/**
 * A round with a change request for "produce" asks for a new voice take: the cached voice of the
 * job goes (the index `voice-cache.json` and the `voice-cache/` audio, as the engine lays them out
 * in the job folder). The round may start earlier (at "script", say) when another reviewer asked
 * for that; the voice request still counts.
 */
export async function forgetVoice(dataDir: string, videoId: string): Promise<void> {
  const dir = jobDir(dataDir, videoId);
  await fs.rm(path.join(dir, 'voice-cache.json'), { force: true });
  await fs.rm(path.join(dir, 'voice-cache'), { recursive: true, force: true });
}

/**
 * Moves the video on according to the outcome of `stage` in `round`, enqueueing the next job in
 * the same transaction. It only acts while the video is still at that stage and round, so
 * applying the same outcome twice (a crash, a repeated job) does nothing the second time.
 */
export async function applyOutcome(
  ctx: StudioContext,
  videoId: string,
  stage: Stage,
  round: number,
  outcome: StageOutcome,
): Promise<void> {
  const guard = {
    id: videoId,
    stage,
    round,
    status: { in: ['queued' as const, 'running' as const] },
  };
  const moved = await ctx.db.$transaction(async (tx: Tx) => {
    if (outcome.kind === 'needs_you') {
      await tx.video.updateMany({
        where: guard,
        data: { status: 'needs_you', problems: outcome.problems, readyAt: ctx.now() },
      });
      return null;
    }
    if (outcome.kind === 'rework') {
      const updated = await tx.video.updateMany({
        where: guard,
        data: {
          stage: outcome.from,
          round: { increment: 1 },
          reviewRounds: { increment: 1 },
          instructions: json(outcome.instructions),
          status: 'running',
        },
      });
      if (updated.count === 0) return null;
      await ctx.queue.enqueue(outcome.from, videoId, tx);
      return outcome.from;
    }
    const next = nextStage(stage);
    if (next === null) {
      await tx.video.updateMany({
        where: guard,
        data: { status: 'ready_for_review', readyAt: ctx.now() },
      });
      return null;
    }
    const updated = await tx.video.updateMany({
      where: guard,
      data: { stage: next, status: 'running' },
    });
    if (updated.count === 0) return null;
    await ctx.queue.enqueue(next, videoId, tx);
    return next;
  });
  if (
    outcome.kind === 'rework' &&
    moved !== null &&
    outcome.instructions.some((item) => item.stage === 'produce')
  ) {
    await forgetVoice(ctx.dataDir, videoId);
  }
}
