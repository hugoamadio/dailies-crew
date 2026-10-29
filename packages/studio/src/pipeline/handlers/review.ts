import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tx } from '@dailies-crew/db';
import { FORMAT } from '@dailies-crew/plan';
import {
  buildReviewRequest,
  decideReview,
  MAX_REVIEW_FRAMES,
  type Review,
  type ReviewFocus,
  sampleEvenly,
} from '../../crew/reviewer';
import { buildSocialRequest, type SocialPosts } from '../../crew/social';
import { LlmError } from '../../llm/errors';
import type { StageHandler } from '../handler';
import { chosenIdeaOf, latestOutput, scriptOf } from '../inputs';
import { json } from '../json';
import { type ProduceOutput, REVIEW_FRAMES } from './produce';
import { allSettledOrThrow } from './settle';

/**
 * Three reviewers (art, rhythm, fidelity) watch the frames. The first call puts the frames in the
 * prompt cache; the other two read them from it at a tenth of the price. Any "adjust" starts a new
 * round from the earliest stage asked for, twice at most; then Hugo gets the problems.
 */
export const review: StageHandler = async (ctx, run) => {
  const produced = await latestOutput<ProduceOutput>(ctx.db, run.video.id, 'produce');
  if (!produced) throw new Error(`Video ${run.video.id} has no render to review`);
  const directed = await latestOutput<{ notes?: string }>(ctx.db, run.video.id, 'direction');
  const frames = sampleEvenly(
    run.video.frameFiles.map((file, index) => ({
      file,
      second: (index * REVIEW_FRAMES.everyNthFrame) / FORMAT.fps,
    })),
    MAX_REVIEW_FRAMES,
  );
  const images = await Promise.all(
    frames.map((frame) => fs.readFile(path.join(ctx.dataDir, frame.file), 'base64')),
  );
  const idea = await chosenIdeaOf(ctx.db, run.video);
  const script = scriptOf(run.video);
  const ask = (focus: ReviewFocus) =>
    run.call(
      buildReviewRequest(
        {
          focus,
          recipe: run.recipe,
          rules: run.rules,
          material: run.material,
          idea,
          script,
          directorNotes: directed?.notes ?? '',
          totalSeconds: produced.durationSeconds,
          scenes: produced.scenes,
          voice: produced.voice,
          frameSeconds: frames.map((frame) => frame.second),
        },
        images,
        run.settings.roles.reviewer,
      ),
    );
  const art = await ask('art');
  const [rhythm, fidelity] = await allSettledOrThrow([ask('rhythm'), ask('fidelity')]);
  const verdicts: Record<ReviewFocus, Review> = { art, rhythm, fidelity };
  const decision = decideReview(verdicts, run.video.reviewRounds);
  // a video handed to Hugo skips the social stage, so its post texts are written here
  let social: SocialPosts | null = null;
  if (decision.kind === 'needs_you' && run.video.videoFile) {
    try {
      social = await run.call(
        buildSocialRequest(
          { recipe: run.recipe, rules: run.rules, material: run.material, idea, script },
          run.settings.roles.social,
        ),
      );
    } catch (error) {
      // a refused key or no credit must still stop everything
      if (error instanceof LlmError && (error.kind === 'auth' || error.kind === 'credit'))
        throw error;
      ctx.log(
        `[review] ${run.video.id}: no post texts for the video handed to Hugo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const persist = (tx: Tx) =>
    tx.video.update({
      where: { id: run.video.id },
      data: { review: json(verdicts), ...(social ? { social: json(social) } : {}) },
    });
  const input = { frames: frames.length, reviewRoundsUsed: run.video.reviewRounds };
  if (decision.kind === 'approve')
    return { outcome: { kind: 'next' }, input, output: verdicts, persist };
  if (decision.kind === 'adjust') {
    return {
      outcome: { kind: 'rework', from: decision.from, instructions: decision.instructions },
      input,
      output: verdicts,
      persist,
    };
  }
  return {
    outcome: { kind: 'needs_you', problems: decision.problems },
    input,
    output: verdicts,
    persist,
  };
};
