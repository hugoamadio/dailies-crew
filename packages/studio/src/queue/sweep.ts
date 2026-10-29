import type { PgBoss } from 'pg-boss';
import type { StudioContext } from '../pipeline/context';
import { STAGE_QUEUES, type StageJobData } from './boss';

/** How often the worker looks for videos nobody is working on */
export const SWEEP_EVERY_MS = 10 * 60 * 1000;

const LIVE_JOB_STATES = ['created', 'retry', 'active'];

export interface SweepResult {
  /** Videos whose finished stage was queued again so its stored result is applied */
  requeued: string[];
  /** Videos marked failed ("interrupted") so "crew retry" can free them */
  failed: string[];
}

/**
 * A video "queued" or "running" must have a live job (waiting, waiting for a retry, or running) in
 * its stage's queue. When the worker died during the last attempt, or the result could not be
 * applied on it, pg-boss gives up on the job and nothing would ever move the video again. For
 * each such video: a stage already done in this round is queued again (the runner then applies
 * the stored result without running it); otherwise the video fails as "interrupted".
 */
export async function sweepStuckVideos(ctx: StudioContext, boss: PgBoss): Promise<SweepResult> {
  const result: SweepResult = { requeued: [], failed: [] };
  const videos = await ctx.db.video.findMany({ where: { status: { in: ['queued', 'running'] } } });
  for (const video of videos) {
    const jobs = await boss.findJobs<StageJobData>(STAGE_QUEUES[video.stage], {
      data: { videoId: video.id },
    });
    if (jobs.some((job) => LIVE_JOB_STATES.includes(job.state))) continue;
    const done = await ctx.db.stageRun.findFirst({
      where: { videoId: video.id, stage: video.stage, round: video.round, status: 'done' },
      select: { id: true },
    });
    if (done) {
      await ctx.queue.enqueue(video.stage, video.id);
      result.requeued.push(video.id);
      ctx.log(`[sweep] ${video.id}: ${video.stage} was done but not applied, queued again`);
      continue;
    }
    const reason = `The ${video.stage} stage was interrupted (the worker stopped or the queue gave up) and has no job left; try it again`;
    // guarded by the row as it was read: a video that moved meanwhile is left alone
    const marked = await ctx.db.video.updateMany({
      where: {
        id: video.id,
        stage: video.stage,
        round: video.round,
        status: video.status,
        updatedAt: video.updatedAt,
      },
      data: { status: 'failed', failureKind: 'interrupted', failureReason: reason },
    });
    if (marked.count === 0) continue;
    result.failed.push(video.id);
    ctx.log(`[sweep] ${video.id}: ${reason}`);
  }
  return result;
}

/** Sweeps now and then every SWEEP_EVERY_MS; the returned function stops it */
export function startSweeper(
  ctx: StudioContext,
  boss: PgBoss,
  everyMs: number = SWEEP_EVERY_MS,
): () => void {
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      await sweepStuckVideos(ctx, boss);
    } catch (error) {
      ctx.log(`[sweep] failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  };
  void sweep();
  const timer = setInterval(() => void sweep(), everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
