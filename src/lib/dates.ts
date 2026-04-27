import { formatDistanceToNow } from "date-fns";

/**
 * Coerce a Date | string | number to a Date.
 */
function toDate(date: Date | string | number): Date {
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
