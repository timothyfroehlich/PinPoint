/**
 * When the weekly Pinball Map sync report posts: Monday at 6 PM US Central,
 * all year (pinballmap-sync-report spec §3.1). Pure date logic, no IO.
 */

const REPORT_TIME_ZONE = "America/Chicago";
const REPORT_WEEKDAY = "Mon";
const REPORT_HOUR = 18;

interface CentralClock {
  weekday: string;
  hour: number;
  /** The Central-time calendar date, YYYY-MM-DD. */
  date: string;
}

function centralClock(now: Date): CentralClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: part("weekday"),
    hour: Number(part("hour")),
    date: `${part("year")}-${part("month")}-${part("day")}`,
  };
}

/**
 * The report week — the Central-time Monday's date — when `now` falls in the
 * report hour (Monday 18:00–18:59 Central), otherwise null.
 */
export function syncReportWeekAt(now: Date): string | null {
  const clock = centralClock(now);
  return clock.weekday === REPORT_WEEKDAY && clock.hour === REPORT_HOUR
    ? clock.date
    : null;
}

/** "Sep 28, 2026", in Central time — the lineup date a stale report names (§4.6). */
export function formatLineupDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
