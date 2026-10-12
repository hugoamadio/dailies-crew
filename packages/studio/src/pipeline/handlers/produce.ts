import path from 'node:path';
import type { ProduceResult, ReviewFramesOptions } from '@dailies-crew/engine';
import { formatIssues, PlanError } from '@dailies-crew/plan';
import { MAX_REVIEW_ROUNDS, type SceneRow, type VoiceRow } from '../../crew/reviewer';
import { assetsDir, jobDir, relativeToData } from '../../paths';
import type { StageHandler } from '../handler';
import { planOf } from '../inputs';

/** Two frames per second (every 15th frame at 30 fps), at a third of the size: 360×640 */
export const REVIEW_FRAMES: ReviewFramesOptions = { everyNthFrame: 15, scale: 1 / 3 };

export interface ProduceOutput {
  videoFile: string;
  frameFiles: string[];
  durationSeconds: number;
  voiceCharacters: number;
  cachedVoiceCharacters: number;
  /** For the rhythm reviewer: when each scene and each voice line plays */
  scenes: SceneRow[];
  voice: VoiceRow[];
}

const seconds = (frames: number, fps: number) => Math.round((frames / fps) * 100) / 100;

function timeline(result: ProduceResult, plan: ReturnType<typeof planOf>) {
  const { fps } = result.resolved;
  const lineOf = new Map(
    plan.scenes.map((scene) => [
      scene.id,
      scene.timing.kind === 'line' ? scene.timing.lineId : null,
    ]),
  );
  const textOf = new Map(plan.voice.lines.map((line) => [line.id, line.text]));
  const scenes: SceneRow[] = result.resolved.scenes.map((scene) => ({
    id: scene.id,
    piece: scene.piece,
    startSeconds: seconds(scene.from, fps),
    seconds: seconds(scene.durationInFrames, fps),
    lineId: lineOf.get(scene.id) ?? null,
    transitionOut: scene.transitionOut?.kind ?? null,
  }));
  const voice: VoiceRow[] = result.resolved.voice.map((line) => ({
    lineId: line.lineId,
    text: textOf.get(line.lineId) ?? '',
    startSeconds: seconds(line.from, fps),
    seconds: seconds(line.durationInFrames, fps),
  }));
  return { scenes, voice };
}

/**
 * Voice, render and review frames, in the video's job folder. The voice is cached there, so a
 * retry never pays for it twice. If the real voice no longer fits the plan, a new round starts
 * (at the director, or at the scriptwriter when the whole video is too long or too short), or
 * Hugo gets the video once the review rounds are spent.
 */
export const produce: StageHandler = async (ctx, run) => {
  const plan = planOf(run.video);
  const workDir = jobDir(ctx.dataDir, run.video.id);
  let result: ProduceResult;
  try {
    result = await ctx.produce({
      plan,
      assetsDir: assetsDir(ctx.dataDir),
      workDir,
      outFile: path.join(workDir, 'video.mp4'),
      voice: run.voice(),
      reviewFrames: REVIEW_FRAMES,
      signal: run.signal,
    });
  } catch (error) {
    if (!(error instanceof PlanError)) throw error;
    const issues = formatIssues(error.issues).split('\n');
    const plain = issues.map((issue) => issue.replace(/^- /, ''));
    // a scene too long for its piece: the director picks another piece; the whole video too long
    // or too short: the scriptwriter changes the narration
    const stage = error.issues.some((issue) => issue.path === 'scenes') ? 'script' : 'direction';
    if (run.video.reviewRounds >= MAX_REVIEW_ROUNDS) {
      return {
        outcome: {
          kind: 'needs_you',
          problems: ['The plan does not fit the real voice:', ...issues],
        },
        output: { planIssues: issues },
      };
    }
    return {
      outcome: {
        kind: 'rework',
        from: stage,
        instructions: plain.map((issue) => ({
          stage,
          instruction: `With the real voice the plan breaks a rule; fix it: ${issue}`,
          source: 'review' as const,
        })),
      },
      output: { planIssues: issues },
    };
  }
  const output: ProduceOutput = {
    videoFile: relativeToData(ctx.dataDir, result.outFile),
    frameFiles: result.frameFiles.map((file) => relativeToData(ctx.dataDir, file)),
    durationSeconds: Math.round(result.durationSeconds * 100) / 100,
    voiceCharacters: result.voiceCharacters,
    cachedVoiceCharacters: result.cachedVoiceCharacters,
    ...timeline(result, plan),
  };
  return {
    outcome: { kind: 'next' },
    output,
    persist: (tx) =>
      tx.video.update({
        where: { id: run.video.id },
        data: {
          videoFile: output.videoFile,
          frameFiles: output.frameFiles,
          durationSeconds: output.durationSeconds,
        },
      }),
  };
};
