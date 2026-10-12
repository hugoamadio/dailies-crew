import { buildScriptRequest } from '../../crew/scriptwriter';
import type { StageHandler } from '../handler';
import { briefingOf, chosenIdeaOf, instructionsFor, scriptOf } from '../inputs';
import { json } from '../json';

/** The scriptwriter turns the chosen idea into voice lines (reworking the last script on a new round) */
export const script: StageHandler = async (ctx, run) => {
  const instructions = instructionsFor(run.video, 'script');
  const facts = {
    recipe: run.recipe,
    rules: run.rules,
    material: run.material,
    briefing: briefingOf(run.video),
    idea: await chosenIdeaOf(ctx.db, run.video),
    instructions,
    previousScript: run.video.script ? scriptOf(run.video) : null,
  };
  const written = await run.call(buildScriptRequest(facts, run.settings.roles.scriptwriter));
  return {
    outcome: { kind: 'next' },
    input: { instructions },
    output: written,
    persist: (tx) =>
      tx.video.update({ where: { id: run.video.id }, data: { script: json(written) } }),
  };
};
