import { checkBudget } from '../costs/service';
import { getLine, pauseLine } from '../lines/service';
import { chooseMaterial } from '../material';
import type { StudioContext } from '../pipeline/context';
import { getSettings } from '../settings/service';

export interface TickResult {
  /** Ids of the videos queued */
  created: string[];
  /** Why nothing was made */
  skipped?: string;
}

/**
 * A line's daily run (or "crew run-now"): picks the material, creates the videos and queues their
 * first stage, all in one transaction. With tickJobId, a repeated delivery of the same scheduled
 * job creates nothing new.
 */
export async function runLineTick(
  ctx: StudioContext,
  lineId: string,
  options: { count?: number; tickJobId?: string } = {},
): Promise<TickResult> {
  const line = await getLine(ctx.db, lineId);
  if (options.tickJobId) {
    const earlier = await ctx.db.video.findMany({
      where: { tickJobId: options.tickJobId },
      select: { id: true },
    });
    if (earlier.length > 0)
      return { created: [], skipped: 'this daily run already made its videos' };
  }
  if (!line.active) return { created: [], skipped: `line "${line.name}" is paused` };
  const settings = await getSettings(ctx.db);
  if (settings.warning) return { created: [], skipped: settings.warning };
  const now = ctx.now();
  const budget = await checkBudget(ctx.db, settings, line, now);
  if (!budget.ok) {
    await pauseLine(ctx.db, line.id, budget.reason);
    return { created: [], skipped: budget.reason };
  }
  const count = options.count ?? line.perDay;
  const material = await chooseMaterial(ctx.db, line, count, now);
  if (!material.ok) {
    await ctx.db.productionLine.update({
      where: { id: line.id },
      data: { warning: material.warning },
    });
    return { created: [], skipped: material.warning };
  }
  const created = await ctx.db.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const productId of material.productIds) {
      const video = await tx.video.create({
        data: { lineId: line.id, productId, tickJobId: options.tickJobId ?? null },
      });
      await ctx.queue.enqueue('prepare', video.id, tx);
      ids.push(video.id);
    }
    if (line.warning)
      await tx.productionLine.update({ where: { id: line.id }, data: { warning: null } });
    return ids;
  });
  return { created };
}
