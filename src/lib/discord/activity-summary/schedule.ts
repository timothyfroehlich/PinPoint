/**
 * When the activity summary posts, and the period each post covers
 * (discord-activity-summary spec §3). Pure date logic, no IO.
 *
 * Post times live on the US Central wall clock (§3.1): the start hour plus
 * every multiple of the interval, all year. Vercel cron is UTC-only, so the
 * route runs every hour and asks {@link scheduledPostInstant} whether this
 * Central hour is a post time.
 *
 * A post's instant is the START of its Central hour — and when that wall-clock
 * hour occurs twice (the fall-back hour), its FIRST occurrence. Both runs in a
 * repeated hour therefore compute the same instant, and the period claim lets
 * only one of them post (§3.4, §3.5). A spring-forward hour never appears on
 * the clock, so its post time never comes and its changes fall into the next
 * period (§3.4).
 */

export const ACTIVITY_SUMMARY_TIME_ZONE = "America/Chicago";

const HOUR_MS = 60 * 60 * 1000;

/** A Central wall-clock hour: calendar date and hour of day (0–23). */
interface WallHour {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  hour: number;
}

const wallHourFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ACTIVITY_SUMMARY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
});

function wallHourOf(instant: Date): WallHour {
  const parts = wallHourFormat.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
  };
}

function sameWallHour(a: WallHour, b: WallHour): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour
  );
}

/**
 * Every instant at which a Central wall-clock hour starts, earliest first:
 * none for the spring-forward hour, two for the fall-back hour, one otherwise.
 * Central is UTC−5 (CDT) or UTC−6 (CST), so those are the only candidates.
 */
function startsOfWallHour(wall: WallHour): Date[] {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour);
  return [5, 6]
    .map((offsetHours) => new Date(asUtc + offsetHours * HOUR_MS))
    .filter((candidate) => sameWallHour(wallHourOf(candidate), wall));
}

/** Calendar arithmetic on the wall clock, ignoring daylight saving. */
function shiftWallHour(wall: WallHour, hours: number): WallHour {
  const shifted = new Date(
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour + hours)
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
}

function isScheduledHour(
  hour: number,
  intervalHours: number,
  startHour: number
): boolean {
  return (
    (((hour - startHour) % intervalHours) + intervalHours) % intervalHours === 0
  );
}

/**
 * The post instant for the Central hour `now` falls in, or null when that hour
 * is not a post time (§3.1). The instant is the hour's first start, so a
 * repeated fall-back hour yields one instant for both of its runs (§3.4).
 */
export function scheduledPostInstant(
  now: Date,
  intervalHours: number,
  startHour: number
): Date | null {
  const wall = wallHourOf(now);
  if (!isScheduledHour(wall.hour, intervalHours, startHour)) return null;
  return startsOfWallHour(wall)[0] ?? null;
}

/**
 * The scheduled post instant before `postInstant`: one interval earlier on the
 * Central wall clock, stepping back further past a post time that did not
 * exist (the spring-forward hour, §3.4).
 */
export function previousScheduledPostInstant(
  postInstant: Date,
  intervalHours: number
): Date {
  let wall = wallHourOf(postInstant);
  // A day of steps always reaches an hour that exists; the bound only guards
  // against a corrupt interval.
  for (let step = 0; step < 48; step += 1) {
    wall = shiftWallHour(wall, -intervalHours);
    const start = startsOfWallHour(wall)[0];
    if (start) return start;
  }
  throw new Error("No previous activity summary post time");
}

/**
 * The period a scheduled post covers (§3.2, §3.3): from where the last
 * covered period ended, or from the previous scheduled post time when there
 * is no previous period or it ended before that.
 */
export function scheduledPeriodStart(
  postInstant: Date,
  intervalHours: number,
  lastPeriodEnd: Date | null
): Date {
  const previous = previousScheduledPostInstant(postInstant, intervalHours);
  return lastPeriodEnd !== null && lastPeriodEnd.getTime() >= previous.getTime()
    ? lastPeriodEnd
    : previous;
}

// ─── Display ───────────────────────────────────────────────────────────

const periodPartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ACTIVITY_SUMMARY_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
});

interface PeriodParts {
  date: string;
  time: string;
}

/**
 * "Oct 2" and "6:00 PM", in Central time. Assembled from parts so the space
 * before AM/PM is a plain space whatever the ICU version prefers.
 */
function periodParts(instant: Date): PeriodParts {
  const parts = periodPartsFormat.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${part("month")} ${part("day")}`,
    time: `${part("hour")}:${part("minute")} ${part("dayPeriod").toUpperCase()}`,
  };
}

/**
 * "Oct 2, 6:00 PM to Oct 3, 6:00 PM" — or "Oct 3, 2:00 PM to 6:00 PM" when
 * both ends fall on the same Central date (§6.1).
 */
export function formatSummaryPeriod(start: Date, end: Date): string {
  const from = periodParts(start);
  const to = periodParts(end);
  return from.date === to.date
    ? `${from.date}, ${from.time} to ${to.time}`
    : `${from.date}, ${from.time} to ${to.date}, ${to.time}`;
}

/** "Sep 28, 2026", in Central time — the lineup date a stale section names (§5.8). */
export function formatLineupDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ACTIVITY_SUMMARY_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
