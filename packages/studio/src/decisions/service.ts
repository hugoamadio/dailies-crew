import type { Video } from '@dailies-crew/db';
import { z } from 'zod';
import { clip, type ReworkStage, REWORK_STAGES, recipeOf } from '../crew/context';
import { buildRouteRequest, type RouterOutput } from '../crew/router';
import { recordLlmCost } from '../costs/service';
import { parseInput, StudioError } from '../errors';
import { getLine } from '../lines/service';
import type { StudioContext } from '../pipeline/context';
import { json } from '../pipeline/json';
import { forgetVoice } from '../pipeline/outcome';
import { getSettings } from '../settings/service';
import { getVideo } from '../videos/service';
import { manualOutput, type OutputAdapter } from './output';

const DECIDABLE = ['ready_for_review', 'needs_you'];

export const RejectInputSchema = z.strictObject({
  reason: z.string().trim().min(3).max(1000),
  /** redo: the video goes back to a stage with the reason; learn: the reason becomes a rule */
  mode: z.enum(['redo', 'learn']),
  /** For redo: Hugo's choice of stage; without it the rejection router picks one */
  targetStage: z.enum(REWORK_STAGES).optional(),
});
export type RejectInput = z.input<typeof RejectInputSchema>;

/** A stage can run again only if what it reads exists: produce needs a plan, direction a script */
function canRedo(video: Video, stage: ReworkStage): boolean {
  if (stage === 'produce') return video.plan !== null;
  if (stage === 'direction') return video.script !== null;
  return video.briefing !== null;
}

function ensureDecidable(video: Video): void {
  if (!DECIDABLE.includes(video.status)) {
    throw new StudioError(
      `Video ${video.id} is ${video.status}; only a video ready for review or needing you can be decided`,
    );
  }
}

/** Approves the video and hands it to the output (manual: ready to post) */
export async function approveVideo(
  ctx: StudioContext,
  videoId: string,
  output: OutputAdapter = manualOutput,
): Promise<Video> {
  const video = await getVideo(ctx.db, videoId);
  ensureDecidable(video);
  if (!video.videoFile) {
    throw new StudioError(`Video ${videoId} has no rendered file; reject it with "redo" instead`);
  }
  const publication = await output.publish(video);
  const now = ctx.now();
  const [approved] = await ctx.db.$transaction([
    ctx.db.video.update({
      where: { id: videoId },
      data: {
        status: 'approved',
        decidedAt: now,
        publication: json({ adapter: output.name, ...publication, at: now.toISOString() }),
      },
    }),
    ctx.db.decision.create({ data: { videoId, kind: 'approve' } }),
  ]);
  return approved;
}

/** The rejection router: the stage that can fix the complaint, and the complaint as a rule */
async function route(ctx: StudioContext, video: Video, reason: string): Promise<RouterOutput> {
  const settings = await getSettings(ctx.db);
  const line = await getLine(ctx.db, video.lineId);
  const idea = await ctx.db.idea.findFirst({
    where: { videoId: video.id, status: { in: ['chosen', 'used'] } },
  });
  const script = video.script as { lines?: { text: string }[] } | null;
  const request = buildRouteRequest(
    {
      recipe: recipeOf(line),
      reason,
      ideaTitle: idea?.title ?? null,
      scriptLines: script?.lines?.map((line) => line.text) ?? [],
    },
    settings.roles['rejection-router'],
  );
  const result = await ctx.llm.generate(request);
  await recordLlmCost(ctx.db, settings, {
    lineId: video.lineId,
    videoId: video.id,
    stage: null,
    role: 'rejection-router',
    requestedModel: request.model,
    model: result.model,
    usage: result.usage,
  });
  return result.data;
}

/**
 * Rejects with a reason (kept in the history either way):
 * - learn: the reason, cleaned up by the router into a short rule, joins the line's rules;
 * - redo: the video goes back to Hugo's stage (or the router's pick) in a new round, with the
 *   reason as the instruction, and two fresh review rounds.
 */
export async function rejectVideo(
  ctx: StudioContext,
  videoId: string,
  input: unknown,
): Promise<{ video: Video; stage: ReworkStage | null; rule: string | null }> {
  const { reason, mode, targetStage } = parseInput(RejectInputSchema, input, 'rejection');
  const video = await getVideo(ctx.db, videoId);
  ensureDecidable(video);
  const now = ctx.now();

  if (mode === 'learn') {
    let rule: string;
    try {
      rule = (await route(ctx, video, reason)).rule;
    } catch (error) {
      ctx.log(`[reject] the router failed, the reason becomes the rule as is: ${String(error)}`);
      rule = clip(reason, 200);
    }
    const [rejected] = await ctx.db.$transaction([
      ctx.db.video.update({ where: { id: videoId }, data: { status: 'rejected', decidedAt: now } }),
      ctx.db.learnedRule.create({
        data: { lineId: video.lineId, text: rule, sourceVideoId: videoId },
      }),
      ctx.db.decision.create({ data: { videoId, kind: 'reject', reason, mode } }),
    ]);
    return { video: rejected, stage: null, rule };
  }

  let stage: ReworkStage;
  if (targetStage) {
    if (!canRedo(video, targetStage)) {
      throw new StudioError(
        `Video ${videoId} never got to ${targetStage}; send it back to an earlier stage`,
      );
    }
    stage = targetStage;
  } else {
    // the router's pick, or the latest earlier stage the video already went through
    const picked = REWORK_STAGES.indexOf((await route(ctx, video, reason)).stage);
    stage = REWORK_STAGES.slice(0, picked + 1).findLast((each) => canRedo(video, each)) ?? 'script';
  }
  const redone = await ctx.db.$transaction(async (tx) => {
    await tx.decision.create({
      data: { videoId, kind: 'reject', reason, mode, targetStage: stage },
    });
    const updated = await tx.video.update({
      where: { id: videoId },
      data: {
        status: 'running',
        stage,
        round: { increment: 1 },
        reviewRounds: 0,
        instructions: json([{ stage, instruction: reason, source: 'hugo' }]),
        problems: [],
        readyAt: null,
        failureKind: null,
        failureReason: null,
      },
    });
    await ctx.queue.enqueue(stage, videoId, tx);
    return updated;
  });
  if (stage === 'produce') await forgetVoice(ctx.dataDir, videoId);
  return { video: redone, stage, rule: null };
}
