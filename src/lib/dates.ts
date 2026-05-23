import {
  differenceInCalendarDays,
  formatDistanceToNow,
  isToday,
  isYesterday,
} from "date-fns";

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
function toDate(date: Date | string | number): Date {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- guard against 'any' or untyped JSON input
  if (date == null) {
    throw new TypeError("Expected date to be a Date, string, or number");
  }
  if (date instanceof Date) return date;
  return new Date(date);
}

// Module-level formatters. Intl.DateTimeFormat construction is expensive,
// and these helpers render per-row in list views — hoisting lets every call
// reuse the same instance.
const MEDIUM_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});
const MEDIUM_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
// Long weekday: "Monday", "Tuesday", … — used by `formatDayGroup` for dates
// within the past week. Cheaper than re-allocating per row in long timelines.
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
});
// "May 2026" — Tier-2 (month) banner label.
const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
// "May 14" — inline date chip on Tier-2 rows.
const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/**
 * Relative time label: "3 minutes ago", "2 days ago", etc.
 * Uses date-fns formatDistanceToNow with addSuffix: true.
 */
export function formatRelative(date: Date | string | number): string {
  const d = toDate(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Medium date only: "Apr 18, 2026" (locale-aware via Intl).
 */
export function formatDate(date: Date | string | number): string {
  const d = toDate(date);
  return MEDIUM_DATE_FORMATTER.format(d);
}

/**
 * Medium date + short time: "Apr 18, 2026, 3:45 PM" (locale-aware via Intl).
 */
export function formatDateTime(date: Date | string | number): string {
  const d = toDate(date);
  return MEDIUM_DATE_TIME_FORMATTER.format(d);
}

/**
 * Day-group heading label for chronological lists. Follows the pattern used
 * by GitHub/Linear/Slack activity feeds: a familiar word for recent days,
 * an absolute date for older history.
 *
 * - Today / Yesterday — for the calendar day match
 * - Day of week (Monday, Tuesday, …) — for 2–6 calendar days back
 * - Absolute medium date — for 7+ days back
 *
 * Uses server-local time. Edge case: a 2026-05-19 23:59 timestamp loaded by
 * a 2026-05-20 00:01 viewer renders as "Yesterday" relative to the server
 * clock, which may be 1h ahead of the viewer. Acceptable for V1.
 *
 * Used standalone by callers that only want the single-tier label. The
 * timeline page uses {@link formatTimelineBucket} for two-tier rollup.
 */
export function formatDayGroup(date: Date | string | number): string {
  const d = toDate(date);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  const daysBack = differenceInCalendarDays(new Date(), d);
  if (daysBack >= 2 && daysBack <= 6) return WEEKDAY_FORMATTER.format(d);
  return formatDate(d);
}

/**
 * Two-tier bucket assignment for a single timeline row's timestamp.
 *
 * Returns either a `day` bucket (matches {@link formatDayGroup} for the
 * last 7 days) or a `month` bucket (month-name + year for anything older,
 * with an inline `rowDateLabel` so the row can show its exact date).
 *
 * The `key` uniquely identifies the bucket within a single render pass —
 * the page's grouping loop starts a new bucket whenever `key` changes.
 * Using `key` rather than `label` is important: two different calendar
 * days can both currently render as `"Tuesday"` if you scroll across a
 * week boundary in a long history, so label-based grouping would collide.
 */
export function formatTimelineBucket(
  date: Date | string | number
): TimelineBucket {
  const d = toDate(date);
  if (isToday(d)) {
    return {
      key: `day-${ymd(d)}`,
      label: "Today",
      tier: "day",
    };
  }
  if (isYesterday(d)) {
    return {
      key: `day-${ymd(d)}`,
      label: "Yesterday",
      tier: "day",
    };
  }
  const daysBack = differenceInCalendarDays(new Date(), d);
  if (daysBack >= 2 && daysBack <= 6) {
    return {
      key: `day-${ymd(d)}`,
      label: WEEKDAY_FORMATTER.format(d),
      tier: "day",
    };
  }
  return {
    key: `month-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: MONTH_YEAR_FORMATTER.format(d),
    tier: "month",
    rowDateLabel: MONTH_DAY_FORMATTER.format(d),
  };
}

/** Server-local YYYY-MM-DD for stable per-calendar-day grouping keys. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
