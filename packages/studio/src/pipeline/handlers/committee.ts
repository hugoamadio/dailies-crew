import { CREATOR_STYLES, type CreatorStyle } from '../../crew/creator';
import {
  buildJudgeRequest,
  type CandidateIdea,
  decideCommittee,
  JUDGE_CRITERIA,
  type JudgeCriterion,
  type JudgeOutput,
} from '../../crew/judge';
import type { StageHandler } from '../handler';
import { briefingOf, latestOutput } from '../inputs';
import { json } from '../json';
import type { StyledIdea } from './ideas';

/** Banked ideas of the same subject that compete again with today's six */
export const BANKED_CANDIDATES = 2;

/**
 * Three judges (objective, retention, brand) score every idea; the highest sum wins. Today's good
 * losers go to the line's bank, the others are discarded. A banked idea that wins is "used".
 */
export const committee: StageHandler = async (ctx, run) => {
  const fresh = (await latestOutput<{ ideas: StyledIdea[] }>(ctx.db, run.video.id, 'ideas'))?.ideas;
  if (!fresh?.length) throw new Error(`Video ${run.video.id} has no ideas to judge`);
  const banked = await ctx.db.idea.findMany({
    where: { lineId: run.line.id, productId: run.video.productId, status: 'banked' },
    orderBy: { createdAt: 'desc' },
    take: BANKED_CANDIDATES,
  });
  const candidates: CandidateIdea[] = [
    ...fresh.map((idea, index) => ({ ...idea, key: `idea-${index + 1}`, bankedId: null })),
    ...banked.map((idea, index) => ({
      key: `idea-${fresh.length + index + 1}`,
      style: (CREATOR_STYLES as readonly string[]).includes(idea.style)
        ? (idea.style as CreatorStyle)
        : 'demonstration',
      title: idea.title,
      hook: idea.hook,
      angle: idea.angle,
      structure: idea.structure,
      cta: idea.cta,
      bankedId: idea.id,
    })),
  ];
  const briefing = briefingOf(run.video);
  const answers = await Promise.all(
    JUDGE_CRITERIA.map(async (criterion) => {
      const request = buildJudgeRequest(
        {
          criterion,
          recipe: run.recipe,
          rules: run.rules,
          material: run.material,
          briefing,
          ideas: candidates,
        },
        run.settings.roles.judge,
      );
      return [criterion, await run.call(request)] as const;
    }),
  );
  const verdicts = Object.fromEntries(answers) as Record<JudgeCriterion, JudgeOutput>;
  const decision = decideCommittee(candidates, verdicts);
  const tallyOf = (key: string) => decision.tallies.find((tally) => tally.key === key)!;

  return {
    outcome: { kind: 'next' },
    input: { ideas: candidates.length, fromBank: banked.length },
    output: decision,
    persist: async (tx) => {
      for (const idea of candidates) {
        const tally = tallyOf(idea.key);
        const scored = { scores: json(tally.scores), total: tally.total };
        if (idea.bankedId) {
          if (idea.key === decision.winner) {
            await tx.idea.update({
              where: { id: idea.bankedId },
              data: { ...scored, status: 'used', videoId: run.video.id },
            });
          }
          continue;
        }
        await tx.idea.create({
          data: {
            lineId: run.line.id,
            videoId: run.video.id,
            productId: run.video.productId,
            style: idea.style,
            title: idea.title,
            hook: idea.hook,
            angle: idea.angle,
            structure: idea.structure,
            cta: idea.cta,
            ...scored,
            status:
              idea.key === decision.winner
                ? 'chosen'
                : decision.banked.includes(idea.key)
                  ? 'banked'
                  : 'discarded',
          },
        });
      }
    },
  };
};
