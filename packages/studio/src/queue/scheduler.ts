import type { Db } from '@dailies-crew/db';
import type { PgBoss } from 'pg-boss';
import { listLines } from '../lines/service';
import { getSettings } from '../settings/service';
import { TICK_QUEUE, type TickJobData } from './boss';

/** Every day at the line's hour (minute 0), in the settings' time zone */
export function cronFor(hour: number): string {
  return `0 ${hour} * * *`;
}

/**
 * Makes pg-boss's schedules match the lines: one daily tick per active line and per line the
 * system paused (keyed by the line id), none for lines Hugo paused or missing lines. Runs at worker start and after any line change. A
 * tick missed while the computer was off is sent once when the worker comes back.
 */
export async function syncSchedules(
  boss: PgBoss,
  db: Db,
): Promise<{ scheduled: string[]; removed: string[] }> {
  const settings = await getSettings(db);
  const active = (await listLines(db)).filter(
    // a line the system paused for its budget keeps its schedule: it comes back by itself
    (line) => line.active || line.pausedReason !== null,
  );
  for (const line of active) {
    const data: TickJobData = { lineId: line.id };
    await boss.schedule(TICK_QUEUE, cronFor(line.hour), data, {
      key: line.id,
      tz: settings.timezone,
      missed: 'once',
    });
  }
  const keep = new Set(active.map((line) => line.id));
  const removed: string[] = [];
  for (const schedule of await boss.getSchedules(TICK_QUEUE)) {
    if (keep.has(schedule.key)) continue;
    await boss.unschedule(TICK_QUEUE, schedule.key);
    removed.push(schedule.key);
  }
  return { scheduled: [...keep], removed };
}
