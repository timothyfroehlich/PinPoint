import { formatDistanceToNow, intervalToDuration } from "date-fns";

import { SITE_TIME_ZONE, siteDayOf } from "~/lib/time-zone";

/**
 * Two-tier grouping for the machine timeline (PP-0x98 V2 design):
 *   - `day`   bucket — used for entries within the last 7 calendar days.
 *               One bucket per day; banner label is Today / Yesterday /
 *               weekday name. Rows inside have no inline date chip.
 *   - `month` bucket — used for entries older than 7 days. Rows roll up
 *               into one bucket per calendar month; banner label is e.g.
 *               "May 2026". Rows inside lead with a small inline date chip
 *               (e.g. "May 14") so per-row precision is preserved.
 *
 * `key` is a stable string the page can use to detect bucket boundaries
 * during a single pass through the rows (it's NOT the visible label —
 * "Today" rolls to a new date at midnight and the visible label changes,
 * but the `key` for that calendar day is the same).
 */
export type TimelineBucketTier = "day" | "month";

export interface TimelineBucket {
  key: string;
  label: string;
  tier: TimelineBucketTier;
  rowDateLabel?: string;
}

/**
 * Coerce a Date | string | number to a Date.
 * Throws TypeError if date is null/undefined at runtime.
 */
function toDate(date: Date | string | number | null | undefined): Date {
  if (date == null) {
    throw new TypeError("Expected date to be a Date, string, or number");
  }
  if (date instanceof Date) return date;
  return new Date(date);
}

// Module-level formatters. Intl.DateTimeFormat construction is expensive,
// and these helpers render per-row in list views — hoisting lets every call
// reuse the same instance.
//
// Every formatter pins the locale and the site time zone (PP-4v3i): the
// server (UTC on Vercel) and the viewer's browser then print the same text,
// so client components hydrate without a mismatch and an evening event reads
// as the day it happened in Austin.
const MEDIUM_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: SITE_TIME_ZONE,
});
const MEDIUM_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: SITE_TIME_ZONE,
});
// "Monday", "Tuesday", … — Tier-1 (day) banner label for 2–6 days back.
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: SITE_TIME_ZONE,
});
// "May 2026" — Tier-2 (month) banner label.
const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: SITE_TIME_ZONE,
});
// "Oct 2026" — a short month and year (profile "Member since").
const SHORT_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: SITE_TIME_ZONE,
});
// "May 14" — inline date chip on Tier-2 rows.
const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: SITE_TIME_ZONE,
});

// "Oct 4, 2026" for a calendar day that carries no zone. Formatted at UTC
// midnight in UTC, so the day prints exactly as written.
const CALENDAR_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Relative time label: "3 minutes ago", "2 days ago", etc.
 * Uses date-fns formatDistanceToNow with addSuffix: true.
 */
export function formatRelative(date: Date | string | number): string {
  const d = toDate(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Compact elapsed-age label for dense tables: "12m", "3h", "5d", "2mo 5d",
 * "1y 3mo".
 *
 * Calendar-accurate (via date-fns `intervalToDuration`), not 30-day months.
 * Granularity steps down as the age grows so the label stays ~5 chars:
 *   - < 1 minute         → "now"
 *   - < 1 hour           → "Nm"
 *   - < 1 day            → "Nh"
 *   - < 1 month          → "Nd"
 *   - < 1 year           → "Xmo Yd"
 *   - >= 1 year          → "Xy Zmo"
 *
 * `date` must be an instant (a timestamp). Every caller passes one — issue
 * `updatedAt`/`createdAt` and timeline-event `createdAt`, all `timestamptz`.
 * A date-only value ("2026-10-02") parses as UTC midnight, so it would read
 * as a misleading number of hours; give such a value its own day-precision
 * label rather than passing it here.
 *
 * `now` is injectable for testing; callers in client components should pass
 * the shared ticker value so SSR and hydration agree (see `RelativeTime` with `format="compact"`).
 */
export function formatCompactAge(
  date: Date | string | number,
  now: Date | number = new Date()
): string {
  const start = toDate(date);
  const end = toDate(now);
  if (start.getTime() > end.getTime()) return "now"; // future/clock skew
  const {
    years = 0,
    months = 0,
    days = 0,
    hours = 0,
    minutes = 0,
  } = intervalToDuration({
    start,
    end,
  });
  if (years > 0) return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  if (months > 0) return days > 0 ? `${months}mo ${days}d` : `${months}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "now";
}

/**
 * {@link formatCompactAge} with an "ago" suffix, for the age fields of list
 * rows on both List Hosts (machine-views §5.7, issues-list §3.3): "just now",
 * "12m ago", "3h ago", "5d ago", "2mo 5d ago", "1y 3mo ago".
 */
export function formatCompactAgeAgo(
  date: Date | string | number,
  now: Date | number = new Date()
): string {
  const age = formatCompactAge(date, now);
  return age === "now" ? "just now" : `${age} ago`;
}

/**
 * Medium date only, on the site's calendar: "Apr 18, 2026".
 */
export function formatDate(date: Date | string | number): string {
  const d = toDate(date);
  return MEDIUM_DATE_FORMATTER.format(d);
}

/**
 * Medium date + short time, on the site's clock: "Apr 18, 2026, 3:45 PM".
 */
export function formatDateTime(date: Date | string | number): string {
  const d = toDate(date);
  return MEDIUM_DATE_TIME_FORMATTER.format(d);
}

/**
 * Short month and year, on the site's calendar: "Oct 2026".
 */
export function formatMonthYear(date: Date | string | number): string {
  return SHORT_MONTH_YEAR_FORMATTER.format(toDate(date));
}

/**
 * A calendar day with no zone attached, as a medium date: "Oct 4, 2026".
 *
 * Takes `YYYY-MM-DD`, optionally followed by a wall-clock time
 * ("2026-10-04 21:34:46", as iScored sends its venue-local timestamps), and
 * prints that day as written — never shifted through a time zone. Returns
 * null when `value` does not start with a real day.
 */
export function formatCalendarDay(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|[ T])/.exec(value);
  if (!match) return null;
  const midnight = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(midnight.getTime())) return null;
  if (midnight.toISOString().slice(0, 10) !== match[1]) return null;
  return CALENDAR_DAY_FORMATTER.format(midnight);
}

/**
 * Whether `date` falls on the site's current calendar day (America/Chicago),
 * regardless of the server's or browser's own zone.
 *
 * `now` is injectable for testing.
 */
export function isSiteToday(
  date: Date | string | number,
  now: Date | number = new Date()
): boolean {
  return siteDayOf(toDate(date)) === siteDayOf(now);
}

/** Whole site calendar days from `earlier` to `later` (`YYYY-MM-DD` each). */
function siteDaysBetween(earlier: string, later: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) /
      DAY_MS
  );
}

/**
 * Two-tier bucket assignment for a single timeline row's timestamp, on the
 * site's calendar (America/Chicago):
 *
 * - `day` bucket for the last 7 calendar days: "Today", "Yesterday", then the
 *   weekday name for 2–6 days back.
 * - `month` bucket for anything older: month name + year, with an inline
 *   `rowDateLabel` so the row can show its exact date.
 *
 * The `key` uniquely identifies the bucket within a single render pass —
 * the page's grouping loop starts a new bucket whenever `key` changes.
 * Using `key` rather than `label` is important: two different calendar
 * days can both currently render as `"Tuesday"` if you scroll across a
 * week boundary in a long history, so label-based grouping would collide.
 *
 * `now` is injectable for testing.
 */
export function formatTimelineBucket(
  date: Date | string | number,
  now: Date | number = new Date()
): TimelineBucket {
  const d = toDate(date);
  const day = siteDayOf(d);
  const daysBack = siteDaysBetween(day, siteDayOf(now));
  if (daysBack >= 0 && daysBack <= 6) {
    return {
      key: `day-${day}`,
      label:
        daysBack === 0
          ? "Today"
          : daysBack === 1
            ? "Yesterday"
            : WEEKDAY_FORMATTER.format(d),
      tier: "day",
    };
  }
  return {
    key: `month-${day.slice(0, 7)}`,
    label: MONTH_YEAR_FORMATTER.format(d),
    tier: "month",
    rowDateLabel: MONTH_DAY_FORMATTER.format(d),
  };
}
