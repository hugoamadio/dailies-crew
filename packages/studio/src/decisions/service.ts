import type { Video, VideoStatus } from '@dailies-crew/db';
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

const DECIDABLE: VideoStatus[] = ['ready_for_review', 'needs_you'];
const NO_LONGER_WAITING = 'The video is no longer waiting for a decision';

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
  const now = ctx.now();
  return ctx.db.$transaction(async (tx) => {
    // the guarded change comes first: a lost race never publishes
    const claimed = await tx.video.updateMany({
      where: { id: videoId, status: { in: DECIDABLE } },
      data: { status: 'approved', decidedAt: now },
    });
    if (claimed.count === 0) throw new StudioError(NO_LONGER_WAITING);
    const publication = await output.publish(video);
    await tx.decision.create({ data: { videoId, kind: 'approve' } });
    return tx.video.update({
      where: { id: videoId },
      data: { publication: json({ adapter: output.name, ...publication, at: now.toISOString() }) },
    });
  });
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
  if (mode === 'learn' && targetStage) {
    throw new StudioError(
      'A target stage only makes sense with "redo"; "learn" does not rerun anything',
    );
  }

  if (mode === 'learn') {
    let rule: string;
    try {
      rule = (await route(ctx, video, reason)).rule;
    } catch (error) {
      ctx.log(`[reject] the router failed, the reason becomes the rule as is: ${String(error)}`);
      rule = clip(reason, 200);
    }
    const rejected = await ctx.db.$transaction(async (tx) => {
      const claimed = await tx.video.updateMany({
        where: { id: videoId, status: { in: DECIDABLE } },
        data: { status: 'rejected', decidedAt: now },
      });
      if (claimed.count === 0) throw new StudioError(NO_LONGER_WAITING);
      await tx.learnedRule.create({
        data: { lineId: video.lineId, text: rule, sourceVideoId: videoId },
      });
      await tx.decision.create({ data: { videoId, kind: 'reject', reason, mode } });
      return tx.video.findUniqueOrThrow({ where: { id: videoId } });
    });
    return { video: rejected, stage: null, rule };
  }

  let stage: ReworkStage;
  let instruction = reason;
  if (targetStage) {
    if (!canRedo(video, targetStage)) {
      throw new StudioError(
        `Video ${videoId} never got to ${targetStage}; send it back to an earlier stage`,
      );
    }
    stage = targetStage;
  } else {
    // the router's pick, or the latest earlier stage the video already went through
    const pick = (await route(ctx, video, reason)).stage;
    const fallback = REWORK_STAGES.slice(0, REWORK_STAGES.indexOf(pick) + 1).findLast((each) =>
      canRedo(video, each),
    );
    if (!fallback) {
      throw new StudioError(`Video ${videoId} has not reached any stage that can be redone`);
    }
    stage = fallback;
    // the complaint was about a later stage: say so, so the earlier one still sees it
    if (stage !== pick) {
      instruction = `About ${pick === 'produce' ? 'the voice' : `the ${pick}`}: ${reason}`;
    }
  }
  // before the video runs again, so the produce worker cannot reuse the old voice
  if (stage === 'produce') await forgetVoice(ctx.dataDir, videoId);
  const redone = await ctx.db.$transaction(async (tx) => {
    const claimed = await tx.video.updateMany({
      where: { id: videoId, status: { in: DECIDABLE } },
      data: {
        status: 'running',
        stage,
        round: { increment: 1 },
        reviewRounds: 0,
        instructions: json([{ stage, instruction, source: 'hugo' }]),
        problems: [],
        readyAt: null,
        failureKind: null,
        failureReason: null,
      },
    });
    if (claimed.count === 0) throw new StudioError(NO_LONGER_WAITING);
    await tx.decision.create({
      data: { videoId, kind: 'reject', reason, mode, targetStage: stage },
    });
    await ctx.queue.enqueue(stage, videoId, tx);
    return tx.video.findUniqueOrThrow({ where: { id: videoId } });
  });
  return { video: redone, stage, rule: null };
}
