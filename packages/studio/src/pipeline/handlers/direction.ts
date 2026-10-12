import {
  buildDirectRequest,
  checkDirection,
  directWithRetries,
  type PlanFrame,
  pieceCards,
} from '../../crew/director';
import type { StageHandler } from '../handler';
import { briefingOf, chosenIdeaOf, instructionsFor, scriptOf } from '../inputs';
import { json } from '../json';

/**
 * The director writes the plan; it is validated against the library and resolved with the fake
 * voice's timings before any voice is paid for. Refused plans go back to the director with the
 * issues (twice at most); after that Hugo gets the video as "needs you".
 */
export const direction: StageHandler = async (ctx, run) => {
  const script = scriptOf(run.video);
  const { material } = run;
  const frame: PlanFrame = {
    brand: run.line.brand,
    voice: run.line.voice,
    language: run.line.language,
    musicTrack: run.line.musicTrack,
    images: material.kind === 'topic' ? [] : material.images,
  };
  const instructions = instructionsFor(run.video, 'direction');
  const base = {
    recipe: run.recipe,
    rules: run.rules,
    material,
    briefing: briefingOf(run.video),
    idea: await chosenIdeaOf(ctx.db, run.video),
    script,
    frame,
    pieces: pieceCards(),
    instructions,
  };
  let notes = '';
  const outcome = await directWithRetries(
    async (previousIssues) => {
      const answer = await run.call(
        buildDirectRequest({ ...base, previousIssues }, run.settings.roles.director),
      );
      notes = answer.notes;
      return answer;
    },
    (answer) => checkDirection(answer, script, frame),
  );
  if (!outcome.ok) {
    return {
      outcome: {
        kind: 'needs_you',
        problems: [
          'The director could not write a valid plan in 3 attempts. Last problems:',
          ...outcome.issues,
        ],
      },
      input: { instructions },
      output: { attempts: outcome.attempts },
    };
  }
  return {
    outcome: { kind: 'next' },
    input: { instructions },
    output: { attempts: outcome.attempts, notes },
    persist: (tx) =>
      tx.video.update({ where: { id: run.video.id }, data: { plan: json(outcome.plan) } }),
  };
};
