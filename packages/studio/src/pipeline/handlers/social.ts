import { buildSocialRequest } from '../../crew/social';
import type { StageHandler } from '../handler';
import { chosenIdeaOf, scriptOf } from '../inputs';
import { json } from '../json';

/** Title, description and hashtags for every network; then the video is ready for Hugo */
export const social: StageHandler = async (ctx, run) => {
  const posts = await run.call(
    buildSocialRequest(
      {
        recipe: run.recipe,
        rules: run.rules,
        material: run.material,
        idea: await chosenIdeaOf(ctx.db, run.video),
        script: scriptOf(run.video),
      },
      run.settings.roles.social,
    ),
  );
  return {
    outcome: { kind: 'next' },
    output: posts,
    persist: (tx) =>
      tx.video.update({ where: { id: run.video.id }, data: { social: json(posts) } }),
  };
};
