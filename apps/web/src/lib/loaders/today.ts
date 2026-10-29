import 'server-only';
import type { Db } from '@dailies-crew/db';
import {
  getSettings,
  nextDailyRun,
  RESUMABLE_FAILURES,
  studioStatus,
  zonedDayStart,
} from '@dailies-crew/studio';
import { IN_PROGRESS, isWaiting, toRow, type VideoRow } from './videos-common';

/** Failed videos older than this leave Today (they stay in All videos) */
const FAILED_DAYS = 7;

export interface TodayGroups {
  inProduction: VideoRow[];
  ready: VideoRow[];
  needsYou: VideoRow[];
  waiting: (VideoRow & { why: 'key' | 'cap' })[];
  failed: VideoRow[];
  decided: VideoRow[];
}

/**
 * The "Hoje" page: today's videos (in the settings' time zone) plus any older video still in
 * production, waiting for Hugo or waiting to go on; the month's spending; each active line's next
 * run.
 */
export async function loadToday(db: Db, now: Date) {
  const settings = await getSettings(db);
  const status = await studioStatus(db, now);
  const since = zonedDayStart(now, settings.timezone);
  const failedSince = new Date(since.getTime() - FAILED_DAYS * 24 * 3600 * 1000);
  const videos = await db.video.findMany({
    where: {
      OR: [
        { createdAt: { gte: since } },
        { decidedAt: { gte: since } },
        { status: { in: ['queued', 'running', 'ready_for_review', 'needs_you', 'paused_budget'] } },
        { status: 'failed', failureKind: { in: RESUMABLE_FAILURES } },
        { status: 'failed', updatedAt: { gte: failedSince } },
      ],
    },
    include: { line: { select: { name: true } }, product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const groups: TodayGroups = {
    inProduction: [],
    ready: [],
    needsYou: [],
    waiting: [],
    failed: [],
    decided: [],
  };
  for (const video of videos) {
    const row = toRow(video);
    if (IN_PROGRESS.includes(video.status)) groups.inProduction.push(row);
    else if (video.status === 'ready_for_review') groups.ready.push(row);
    else if (video.status === 'needs_you') groups.needsYou.push(row);
    else if (isWaiting(video)) {
      groups.waiting.push({ ...row, why: video.status === 'paused_budget' ? 'cap' : 'key' });
    } else if (video.status === 'failed') groups.failed.push(row);
    else groups.decided.push(row);
  }
  const nextRuns = status.lines
    .filter((line) => line.active)
    .map((line) => ({
      id: line.id,
      name: line.name,
      at: nextDailyRun(line.hour, settings.timezone, now),
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return {
    timezone: settings.timezone,
    month: status.month,
    monthSpend: status.monthSpend,
    globalCapUsd: status.globalCapUsd,
    lines: status.lines,
    groups,
    nextRuns,
    /** Something is queued or running: the page refreshes itself */
    live: groups.inProduction.length > 0,
  };
}
