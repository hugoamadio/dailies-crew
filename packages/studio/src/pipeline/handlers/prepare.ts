import { buildPrepareRequest } from '../../crew/preparer';
import type { StageHandler } from '../handler';
import { json } from '../json';

/** The producer reads everything about the video and writes the briefing */
export const prepare: StageHandler = async (ctx, run) => {
  const [ideas, rejections] = await Promise.all([
    ctx.db.idea.findMany({
      where: { lineId: run.line.id, status: { in: ['chosen', 'used'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    ctx.db.decision.findMany({
      where: { kind: 'reject', video: { lineId: run.line.id }, reason: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  const facts = {
    recipe: run.recipe,
    rules: run.rules,
    material: run.material,
    recentIdeas: ideas.map((idea) => ({ title: idea.title, hook: idea.hook })),
    rejections: rejections.map((decision) => decision.reason!),
  };
  const briefing = await run.call(buildPrepareRequest(facts, run.settings.roles.preparer));
  return {
    outcome: { kind: 'next' },
    input: { recentIdeas: facts.recentIdeas.length, rejections: facts.rejections.length },
    output: briefing,
    persist: (tx) =>
      tx.video.update({ where: { id: run.video.id }, data: { briefing: json(briefing) } }),
  };
};
