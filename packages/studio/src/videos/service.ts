import type { Db, Video, VideoStatus } from '@dailies-crew/db';
import { isUuid } from '../assets';
import { roundUsd } from '../costs/math';
import { monthRange, monthStart, zonedYearMonth } from '../costs/month';
import { spendBetween } from '../costs/service';
import { StudioError } from '../errors';
import type { StudioContext } from '../pipeline/context';
import { RESUMABLE_FAILURES } from '../pipeline/failure';
import { getSettings } from '../settings/service';

export async function getVideo(db: Db, id: string): Promise<Video> {
  const video = isUuid(id) ? await db.video.findUnique({ where: { id } }) : null;
  if (!video) throw new StudioError(`No video with id ${id}`);
  return video;
}

/** Everything about a video: its stages, ideas, costs and Hugo's decisions ("bastidores") */
export async function videoDetails(db: Db, id: string) {
  await getVideo(db, id);
  return db.video.findUniqueOrThrow({
    where: { id },
    include: {
      line: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      stageRuns: { orderBy: [{ startedAt: 'asc' }] },
      ideas: { orderBy: { createdAt: 'asc' } },
      costs: { orderBy: { createdAt: 'asc' } },
      decisions: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function listVideos(
  db: Db,
  filter: { status?: VideoStatus; lineId?: string; limit?: number } = {},
) {
  return db.video.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.lineId ? { lineId: filter.lineId } : {}),
    },
    include: { line: { select: { name: true } }, product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 20,
  });
}

/** "Try again" on a failed video: its current stage is queued again, with fresh retries */
export async function retryVideo(ctx: StudioContext, id: string): Promise<Video> {
  const video = await getVideo(ctx.db, id);
  if (video.status !== 'failed') {
    throw new StudioError(`Video ${id} is ${video.status}; only a failed video can be tried again`);
  }
  return ctx.db.$transaction(async (tx) => {
    const claimed = await tx.video.updateMany({
      where: { id, status: 'failed' },
      data: { status: 'queued', failureKind: null, failureReason: null },
    });
    if (claimed.count === 0) throw new StudioError(`Video ${id} is no longer failed`);
    await ctx.queue.enqueue(video.stage, id, tx);
    return tx.video.findUniqueOrThrow({ where: { id } });
  });
}

/**
 * After fixing what stopped the studio (the API key, the credit, a spending cap): clears the
 * global warning, turns back on the lines the system paused, and queues again every video that
 * was waiting. Spending caps are checked again at the next stage, so raise them first.
 */
export async function resumeStudio(
  ctx: StudioContext,
  options: { lineId?: string } = {},
): Promise<{ lines: number; videos: number }> {
  const settings = await getSettings(ctx.db);
  if (options.lineId && settings.warning) {
    throw new StudioError(
      `Everything is stopped: ${settings.warning}. Fix it, then run "crew resume" without --line`,
    );
  }
  const ofLine = options.lineId ? { lineId: options.lineId } : {};
  const { lines, videos } = await ctx.db.$transaction(async (tx) => {
    if (!options.lineId)
      await tx.settings.update({ where: { id: 1 }, data: { warning: null, warningAt: null } });
    const lines = await tx.productionLine.updateMany({
      where: {
        ...(options.lineId ? { id: options.lineId } : {}),
        active: false,
        pausedReason: { not: null },
      },
      data: { active: true, pausedReason: null, warning: null },
    });
    const waiting = await tx.video.findMany({
      where: {
        ...ofLine,
        OR: [
          { status: 'paused_budget' },
          { status: 'failed', failureKind: { in: RESUMABLE_FAILURES } },
        ],
      },
    });
    let videos = 0;
    for (const video of waiting) {
      // guarded: a video someone else already moved is not queued twice
      const claimed = await tx.video.updateMany({
        where: {
          id: video.id,
          OR: [
            { status: 'paused_budget' },
            { status: 'failed', failureKind: { in: RESUMABLE_FAILURES } },
          ],
        },
        data: { status: 'queued', failureKind: null, failureReason: null },
      });
      if (claimed.count === 0) continue;
      await ctx.queue.enqueue(video.stage, video.id, tx);
      videos += 1;
    }
    return { lines: lines.count, videos };
  });
  return { lines, videos };
}

/** The panel's "Hoje" in numbers: what is happening and what it costs this month */
export async function studioStatus(db: Db, now: Date) {
  const settings = await getSettings(db);
  const since = monthStart(now, settings.timezone);
  const lines = await db.productionLine.findMany({ orderBy: { createdAt: 'asc' } });
  const byStatus = await db.video.groupBy({ by: ['status'], _count: { _all: true } });
  return {
    warning: settings.warning,
    month: zonedYearMonth(now, settings.timezone),
    monthSpend: await spendBetween(db, { since }),
    globalCapUsd: settings.globalMonthlyCapUsd,
    lines: await Promise.all(
      lines.map(async (line) => ({
        id: line.id,
        name: line.name,
        active: line.active,
        hour: line.hour,
        pausedReason: line.pausedReason,
        warning: line.warning,
        monthSpend: await spendBetween(db, { since, lineId: line.id }),
        monthlyCapUsd: line.monthlyCapUsd,
      })),
    ),
    videos: Object.fromEntries(byStatus.map((group) => [group.status, group._count._all])),
  };
}

/** Spending of one month ("YYYY-MM"; default: the current one), per line and per role */
export async function costsReport(db: Db, now: Date, yearMonth?: string) {
  const settings = await getSettings(db);
  const { year, month } = zonedYearMonth(now, settings.timezone);
  const label = yearMonth ?? `${year}-${String(month).padStart(2, '0')}`;
  const { start, end } = monthRange(label, settings.timezone);
  const where = { createdAt: { gte: start, lt: end } };
  const [byLine, byRole, lines, videos] = await Promise.all([
    db.costEntry.groupBy({ by: ['lineId'], where, _sum: { usd: true } }),
    db.costEntry.groupBy({ by: ['role'], where, _sum: { usd: true } }),
    db.productionLine.findMany({ select: { id: true, name: true } }),
    db.video.count({ where }),
  ]);
  const nameOf = new Map(lines.map((line) => [line.id, line.name]));
  const total = byLine.reduce((sum, group) => sum + (group._sum.usd ?? 0), 0);
  return {
    month: label,
    totalUsd: roundUsd(total),
    videos,
    perVideoUsd: videos ? roundUsd(total / videos) : 0,
    lines: byLine.map((group) => ({
      line: nameOf.get(group.lineId) ?? group.lineId,
      usd: roundUsd(group._sum.usd ?? 0),
    })),
    roles: byRole.map((group) => ({ role: group.role, usd: roundUsd(group._sum.usd ?? 0) })),
  };
}
