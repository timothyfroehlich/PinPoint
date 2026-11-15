/**
 * The collective's local time zone, and the calendar-day arithmetic that
 * depends on it. Pure date logic with no IO, safe on server and client.
 *
 * Austin is on US Central time: UTC−6 (CST) in winter, UTC−5 (CDT) in
 * summer. Every place PinPoint shows a date or clock time, groups by day, or
 * reads a calendar day as a span of time uses this clock (PP-4v3i) — never
 * the server's zone (UTC on Vercel) or the viewer's browser zone, so a server
 * render and its hydration agree and an evening event lands on its own day.
 */
export const SITE_TIME_ZONE = "America/Chicago";

const siteWallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

/**
 * How far the site's wall clock is from UTC at `instantMs`, in
 * milliseconds: negative in the Americas, −5 h or −6 h for Central.
 */
function siteOffsetMs(instantMs: number): number {
  const wholeSecond = Math.floor(instantMs / 1000) * 1000;
  const parts = siteWallClock.formatToParts(wholeSecond);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
  const wallAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  );
  return wallAsUtc - wholeSecond;
}

/**
 * The instant local midnight starts the calendar day `year-month-day`
 * (month 0–11; out-of-range days roll over as `Date.UTC` does).
 *
 * Takes the offset at a first guess, then re-reads it at the result, so a
 * day whose offset differs from the previous evening's still lands on its
 * own midnight. Central changes clocks at 2 AM, so midnight always exists
 * exactly once.
 */
function siteMidnight(year: number, month: number, day: number): Date {
  const wallMidnight = Date.UTC(year, month, day);
  const firstGuess = wallMidnight - siteOffsetMs(wallMidnight);
  return new Date(wallMidnight - siteOffsetMs(firstGuess));
}

function calendarDay(day: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) {
    throw new RangeError(`Expected a YYYY-MM-DD day, got "${day}"`);
  }
  return [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
}

/** The instant the site-local calendar day `YYYY-MM-DD` begins. */
export function startOfSiteDay(day: string): Date {
  const [year, month, date] = calendarDay(day);
  return siteMidnight(year, month, date);
}

/**
 * The instant the site-local day after `YYYY-MM-DD` begins: the exclusive
 * end of `day`. A day is 23 hours long when clocks spring forward and 25
 * when they fall back.
 */
export function startOfNextSiteDay(day: string): Date {
  const [year, month, date] = calendarDay(day);
  return siteMidnight(year, month, date + 1);
}

/**
 * The site-local calendar day `YYYY-MM-DD` that contains `instant`: the date
 * a member in Austin would read off a wall calendar at that moment, whatever
 * zone the server or browser runs in.
 */
export function siteDayOf(instant: Date | number): string {
  const parts = siteWallClock.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month").padStart(2, "0")}-${part("day").padStart(2, "0")}`;
}
