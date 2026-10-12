import type { Stage, Tx } from '@dailies-crew/db';
import { fromPrisma, type JobWithMetadata, type PgBoss } from 'pg-boss';
import type { JobQueue, StudioContext } from '../pipeline/context';
import type { StageHandler } from '../pipeline/handler';
import { runStage } from '../pipeline/runner';
import { STAGES } from '../pipeline/stages';
import { runLineTick } from '../videos/tick';

/** One queue per stage, plus the daily run of each line */
export const STAGE_QUEUES: Record<Stage, string> = {
  prepare: 'stage.prepare',
  ideas: 'stage.ideas',
  committee: 'stage.committee',
  script: 'stage.script',
  direction: 'stage.direction',
  produce: 'stage.produce',
  review: 'stage.review',
  social: 'stage.social',
};
export const TICK_QUEUE = 'line.tick';

/** Up to 3 retries, 30 s, 60 s, 120 s apart (with jitter, never more than 10 minutes) */
export const RETRY_OPTIONS = {
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  retryDelayMax: 600,
};

/**
 * A running job tells pg-boss it is alive every 30 s; a job silent for 60 s (the computer died)
 * goes back to the queue when the worker runs again. The expiry only stops a job stuck far beyond
 * anything normal: pg-boss retries an expired job even if its handler is still running.
 */
export const HEARTBEAT_SECONDS = 60;
export const EXPIRE_SECONDS: Record<Stage, number> = {
  prepare: 1800,
  ideas: 3600,
  committee: 3600,
  script: 3600,
  direction: 7200,
  produce: 7200,
  review: 7200,
  social: 1800,
};

/** Videos the crews work on at once, per stage (DAILIES_CONCURRENCY) */
export const DEFAULT_CONCURRENCY = 4;

/** Renders are heavy: one at a time. The crews' calls can overlap. */
export function concurrencyOf(stage: Stage, crews = DEFAULT_CONCURRENCY): number {
  return stage === 'produce' ? 1 : crews;
}

export interface StageJobData {
  videoId: string;
}

export interface TickJobData {
  lineId: string;
}

/** Creates the queues (or updates their options); safe to call at every start */
export async function ensureQueues(boss: PgBoss): Promise<void> {
  for (const stage of STAGES) {
    const options = {
      ...RETRY_OPTIONS,
      expireInSeconds: EXPIRE_SECONDS[stage],
      heartbeatSeconds: HEARTBEAT_SECONDS,
    };
    await boss.createQueue(STAGE_QUEUES[stage], options);
    await boss.updateQueue(STAGE_QUEUES[stage], options);
  }
  await boss.createQueue(TICK_QUEUE, { retryLimit: 2, retryDelay: 60, expireInSeconds: 300 });
}

/** Stage jobs on pg-boss; inside a Prisma transaction the job commits (or not) with it */
export class BossQueue implements JobQueue {
  constructor(private readonly boss: PgBoss) {}

  async enqueue(stage: Stage, videoId: string, tx?: Tx): Promise<void> {
    const data: StageJobData = { videoId };
    await this.boss.send(STAGE_QUEUES[stage], data, tx ? { db: fromPrisma(tx) } : {});
  }
}

/** One worker per stage queue and one for the daily runs */
export async function startWorkers(
  boss: PgBoss,
  ctx: StudioContext,
  handlers: Record<Stage, StageHandler>,
  options: { concurrency?: number } = {},
): Promise<void> {
  for (const stage of STAGES) {
    await boss.work(
      STAGE_QUEUES[stage],
      { includeMetadata: true, localConcurrency: concurrencyOf(stage, options.concurrency) },
      async ([job]: JobWithMetadata<StageJobData>[]) => {
        if (!job) return;
        await runStage(
          ctx,
          stage,
          {
            videoId: job.data.videoId,
            lastAttempt: job.retryCount >= job.retryLimit,
            signal: job.signal,
          },
          handlers,
        );
      },
    );
  }
  await boss.work<TickJobData>(TICK_QUEUE, async ([job]) => {
    if (!job) return;
    const result = await runLineTick(ctx, job.data.lineId, { tickJobId: job.id });
    ctx.log(
      result.created.length
        ? `[tick] line ${job.data.lineId}: ${result.created.length} videos queued`
        : `[tick] line ${job.data.lineId}: nothing made (${result.skipped})`,
    );
  });
}
