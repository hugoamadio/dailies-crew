import { checkBudget } from '../costs/service';
import { getLine, pauseLine } from '../lines/service';
import type { Line } from '../lines/schema';
import { chooseMaterial } from '../material';
import type { StudioContext } from '../pipeline/context';
import { getSettings } from '../settings/service';
import { requeueWaiting } from './service';

export interface TickResult {
  /** Ids of the videos queued */
  created: string[];
  /** Why nothing was made */
  skipped?: string;
}

/** Turns the line back on and queues its budget-paused videos again (guarded: no double jobs) */
async function liftBudgetPause(ctx: StudioContext, line: Line): Promise<boolean> {
  const videos = await ctx.db.$transaction(async (tx) => {
    const lifted = await tx.productionLine.updateMany({
      where: { id: line.id, active: false, pausedReason: { not: null } },
      data: { active: true, pausedReason: null, warning: null },
    });
    if (lifted.count === 0) return null;
    return requeueWaiting(ctx, tx, { lineId: line.id, status: 'paused_budget' });
  });
  if (videos === null) return false;
  ctx.log(
    `[tick] line "${line.name}" is back on: its budget passes again; ${videos} videos queued`,
  );
  return true;
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
  const settings = await getSettings(ctx.db);
  const now = ctx.now();
  if (!line.active) {
    // Hugo's pause stays; the system's budget pause lifts itself once the budget passes again
    const lifted =
      line.pausedReason && !settings.warning
        ? (await checkBudget(ctx.db, settings, line, now)).ok
        : false;
    if (!lifted) return { created: [], skipped: `line "${line.name}" is paused` };
    // someone else changed the line meanwhile: this tick makes nothing
    if (!(await liftBudgetPause(ctx, line)))
      return { created: [], skipped: `line "${line.name}" is paused` };
  }
  if (settings.warning) return { created: [], skipped: settings.warning };
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
