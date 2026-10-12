import {
  buildCreateRequest,
  CREATOR_STYLES,
  type CreatorStyle,
  type IdeaDraft,
} from '../../crew/creator';
import type { StageHandler } from '../handler';
import { briefingOf } from '../inputs';
import { allSettledOrThrow } from './settle';

export interface StyledIdea extends IdeaDraft {
  style: CreatorStyle;
}

/** Three creators with different styles propose two ideas each, in parallel */
export const ideas: StageHandler = async (ctx, run) => {
  const used = await ctx.db.idea.findMany({
    where: {
      lineId: run.line.id,
      productId: run.video.productId,
      status: { in: ['chosen', 'used'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const briefing = briefingOf(run.video);
  const answers = await allSettledOrThrow(
    CREATOR_STYLES.map(async (style) => {
      const request = buildCreateRequest(
        {
          style,
          recipe: run.recipe,
          rules: run.rules,
          material: run.material,
          briefing,
          usedIdeas: used.map((idea) => idea.title),
        },
        run.settings.roles.creator,
      );
      const answer = await run.call(request);
      return answer.ideas.map((idea): StyledIdea => ({ ...idea, style }));
    }),
  );
  return {
    outcome: { kind: 'next' },
    input: { usedIdeas: used.length },
    output: { ideas: answers.flat() },
  };
};
