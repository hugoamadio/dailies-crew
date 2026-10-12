function zonedParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
}

/** How far the wall clock of the zone is ahead of UTC at that instant, in milliseconds */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const wallClock = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return wallClock - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant the wall clock of the zone shows midnight of the first day of that month */
export function zonedMonthStart(year: number, month: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, 1);
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  // once more, in case the offset changed between the guess and the answer (daylight saving)
  return new Date(guess - zoneOffsetMs(new Date(first), timeZone));
}

/** Year and month (1-12) the zone's calendar shows at that instant */
export function zonedYearMonth(now: Date, timeZone: string): { year: number; month: number } {
  const p = zonedParts(now, timeZone);
  return { year: p.year!, month: p.month! };
}

/** Start of the spending month that `now` falls in, in the zone of the settings */
export function monthStart(now: Date, timeZone: string): Date {
  const { year, month } = zonedYearMonth(now, timeZone);
  return zonedMonthStart(year, month, timeZone);
}

/** [start, end) of a month given as "YYYY-MM" */
export function monthRange(yearMonth: string, timeZone: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  const month = Number(match?.[2]);
  if (!match || month < 1 || month > 12)
    throw new Error(`"${yearMonth}" is not a month like 2026-10`);
  const year = Number(match[1]);
  return {
    start: zonedMonthStart(year, month, timeZone),
    end:
      month === 12
        ? zonedMonthStart(year + 1, 1, timeZone)
        : zonedMonthStart(year, month + 1, timeZone),
  };
}
