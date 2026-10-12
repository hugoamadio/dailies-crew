import type { Stage } from '@dailies-crew/db';
import type { VoiceProvider } from '@dailies-crew/engine/voice';
import { materialOf, recipeOf } from '../crew/context';
import { roundUsd } from '../costs/math';
import { checkBudget, recordLlmCost, recordVoiceCost } from '../costs/service';
import { getLine, pauseLine } from '../lines/service';
import { getSettings, setGlobalWarning } from '../settings/service';
import type { StageRunContext, StudioContext } from './context';
import { classifyFailure } from './failure';
import type { StageHandler } from './handler';
import { json } from './json';
import { applyOutcome, type StageOutcome } from './outcome';

export interface StageJob {
  videoId: string;
  /** No retry follows if this attempt fails */
  lastAttempt: boolean;
  /** Aborted when the job expires or the worker stops */
  signal?: AbortSignal;
}

/** Every synthesis of the provider is reported (to record its cost at once) */
export function meteredVoice(
  provider: VoiceProvider,
  onCharacters: (characters: number) => Promise<void>,
): VoiceProvider {
  return {
    name: provider.name,
    synthesize: async (request) => {
      const result = await provider.synthesize(request);
      await onCharacters(result.characters);
      return result;
    },
  };
}

/** A refused key or no credit: every line stops, the panel shows why, nothing more is tried */
async function stopEverything(ctx: StudioContext, reason: string): Promise<void> {
  await setGlobalWarning(ctx.db, reason, ctx.now());
  await ctx.db.productionLine.updateMany({
    where: { active: true },
    data: { active: false, pausedReason: reason },
  });
}

async function fail(
  ctx: StudioContext,
  stage: Stage,
  videoId: string,
  runId: string,
  error: unknown,
  job: StageJob,
  cost: number,
): Promise<void> {
  const failure = classifyFailure(error);
  await ctx.db.stageRun.update({
    where: { id: runId },
    data: {
      status: 'failed',
      error: failure.message,
      costUsd: roundUsd(cost),
      finishedAt: ctx.now(),
    },
  });
  const failed = {
    status: 'failed' as const,
    failureKind: failure.kind,
    failureReason: failure.message,
  };
  if (failure.stopsEverything) {
    await stopEverything(ctx, failure.message);
    await ctx.db.video.update({ where: { id: videoId }, data: failed });
    ctx.log(`[${stage}] ${videoId}: every line stopped: ${failure.message}`);
    return;
  }
  if (failure.retryable && !job.lastAttempt) {
    ctx.log(`[${stage}] ${videoId}: failed, the queue will try again: ${failure.message}`);
    throw error;
  }
  await ctx.db.video.update({ where: { id: videoId }, data: failed });
  ctx.log(`[${stage}] ${videoId}: failed: ${failure.message}`);
}

/**
 * Runs one stage of one video, the way every queue job does:
 * - a job for a video that moved on (or stopped) does nothing;
 * - a stage already done in this round is never run again: its stored outcome is applied;
 * - with a global warning (key, credit) or a spending cap reached, nothing is paid for;
 * - every Claude call and voice synthesis is recorded as it happens;
 * - the result is saved and the stage marked done in one transaction, then the video moves on;
 * - a failure is retried by the queue when it can help, otherwise the video fails with the reason.
 */
export async function runStage(
  ctx: StudioContext,
  stage: Stage,
  job: StageJob,
  handlers: Record<Stage, StageHandler>,
): Promise<void> {
  const video = await ctx.db.video.findUnique({ where: { id: job.videoId } });
  if (!video) {
    ctx.log(`[${stage}] video ${job.videoId} does not exist: job dropped`);
    return;
  }
  if (video.stage !== stage || (video.status !== 'queued' && video.status !== 'running')) {
    ctx.log(`[${stage}] ${video.id} is at ${video.stage} (${video.status}): job skipped`);
    return;
  }
  const done = await ctx.db.stageRun.findFirst({
    where: { videoId: video.id, stage, round: video.round, status: 'done' },
  });
  if (done) {
    const { outcome } = done.output as { outcome: StageOutcome };
    await applyOutcome(ctx, video.id, stage, video.round, outcome);
    return;
  }

  const settings = await getSettings(ctx.db);
  if (settings.warning) {
    await ctx.db.video.update({
      where: { id: video.id },
      data: { status: 'failed', failureKind: 'paused', failureReason: settings.warning },
    });
    return;
  }
  const line = await getLine(ctx.db, video.lineId);
  const budget = await checkBudget(ctx.db, settings, line, ctx.now());
  if (!budget.ok) {
    await pauseLine(ctx.db, line.id, budget.reason);
    await ctx.db.video.update({
      where: { id: video.id },
      data: { status: 'paused_budget', failureReason: budget.reason },
    });
    ctx.log(`[${stage}] ${video.id}: paused: ${budget.reason}`);
    return;
  }

  // an attempt still "running" here was cut short (the worker stopped): the history says so
  await ctx.db.stageRun.updateMany({
    where: { videoId: video.id, stage, round: video.round, status: 'running' },
    data: { status: 'failed', error: 'interrupted: the worker stopped', finishedAt: ctx.now() },
  });
  const attempt =
    1 + (await ctx.db.stageRun.count({ where: { videoId: video.id, stage, round: video.round } }));
  const run = await ctx.db.stageRun.create({
    data: { videoId: video.id, stage, round: video.round, attempt, status: 'running' },
  });
  await ctx.db.video.update({
    where: { id: video.id },
    data: { status: 'running', failureKind: null, failureReason: null },
  });
  ctx.log(`[${stage}] ${video.id}: round ${video.round}, attempt ${attempt}`);

  let cost = 0;
  let outcome: StageOutcome;
  try {
    const product = video.productId
      ? await ctx.db.product.findUnique({ where: { id: video.productId } })
      : null;
    const rules = await ctx.db.learnedRule.findMany({
      where: { lineId: line.id, active: true },
      orderBy: { createdAt: 'asc' },
    });
    const runContext: StageRunContext = {
      stage,
      video,
      line,
      product,
      settings,
      recipe: recipeOf(line),
      material: materialOf(line, product),
      rules: rules.map((rule) => rule.text),
      signal: job.signal,
      call: async (request) => {
        const result = await ctx.llm.generate(request);
        cost += await recordLlmCost(ctx.db, settings, {
          lineId: line.id,
          videoId: video.id,
          stage,
          role: request.role,
          requestedModel: request.model,
          model: result.model,
          usage: result.usage,
        });
        return result.data;
      },
      voice: () =>
        meteredVoice(ctx.voices(line.voice.provider), async (characters) => {
          cost += await recordVoiceCost(ctx.db, settings, {
            lineId: line.id,
            videoId: video.id,
            provider: line.voice.provider,
            characters,
          });
        }),
    };
    const result = await handlers[stage](ctx, runContext);
    outcome = result.outcome;
    await ctx.db.$transaction(async (tx) => {
      await result.persist?.(tx);
      await tx.stageRun.update({
        where: { id: run.id },
        data: {
          status: 'done',
          ...(result.input !== undefined ? { input: json(result.input) } : {}),
          output: json({ outcome: result.outcome, data: result.output }),
          costUsd: roundUsd(cost),
          finishedAt: ctx.now(),
        },
      });
    });
  } catch (error) {
    await fail(ctx, stage, video.id, run.id, error, job, cost);
    return;
  }
  // outside the try: if moving on fails, the queue retries and finds the stage already done
  await applyOutcome(ctx, video.id, stage, video.round, outcome);
}
