import { formatDistanceToNow } from "date-fns";

/**
 * Coerce a Date | string | number to a Date.
 * Returns null for null/undefined so callers can return "" gracefully.
 */
function toDate(date: Date | string | number | null | undefined): Date | null {
  if (date == null) return null;
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Relative time label: "3 minutes ago", "2 days ago", etc.
 * Uses date-fns formatDistanceToNow with addSuffix: true.
 * Returns "" for null/undefined input.
 */
export function formatRelative(
  date: Date | string | number | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Medium date only: "Apr 18, 2026" (locale-aware via Intl).
 * Returns "" for null/undefined input.
 */
export function formatDate(
  date: Date | string | number | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

/**
 * Medium date + short time: "Apr 18, 2026, 3:45 PM" (locale-aware via Intl).
 * Returns "" for null/undefined input.
 */
export function formatDateTime(
  date: Date | string | number | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
