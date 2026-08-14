"use client";

import type React from "react";
import { formatRelative } from "~/lib/dates";
import { useRelativeNow } from "./RelativeTimeProvider";

interface RelativeTimeProps {
  value: Date | string;
  /**
   * Server/hydration label, rendered until the client ticker mounts.
   *
   * Defaults to the empty string. It must not default to anything derived from
   * `value` at render time: a locale- or zone-formatted label diverges between
   * SSR and hydration, and the ISO instant this once defaulted to is 24
   * characters — far wider than any relative label it stands in for. The
   * timeline rows pin this into a `shrink-0` slot sized for "2 minutes ago",
   * so the raw instant overflowed the row and was clipped until hydration
   * (PP-h490). Empty is both zone-independent and unable to overflow.
   *
   * Pass an absolute label where the pre-hydration paint should still carry a
   * date. The pattern to copy is `IssueUpdatedTimestamp`, whose `fallback` is
   * computed by the issue-detail *server* page and handed down as a prop — the
   * string is then built once, in one zone, and cannot diverge.
   *
   * `NotificationList` and `IssueList` also pass `formatDateTime(...)`, but
   * both are `"use client"` and call it inline, so the value is computed twice
   * in two possibly-different zones. That is tolerable *here* only because a
   * fallback is text that the ticker replaces on mount; the same inline call
   * feeding an `aria-label` or any other attribute is a real bug, because
   * React does not patch mismatched attributes (see `IssueTimeline`).
   */
  fallback?: string;
}

export function RelativeTime({
  value,
  fallback,
}: RelativeTimeProps): React.JSX.Element {
  // `null` during SSR and before the provider's first tick — render fallback.
  // After mount the shared ticker emits a number every 60s, causing a re-render.
  const now = useRelativeNow();

  const resolvedFallback = fallback ?? "";

  // Pre-mount / SSR path: render fallback (matches original useEffect behaviour).
  if (now === null) {
    return <>{resolvedFallback}</>;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return <>{resolvedFallback}</>;
  }

  let label: string;
  try {
    label = formatRelative(date);
  } catch (err) {
    // formatDistanceToNow can throw RangeError on edge inputs; stay on fallback.
    console.warn("[RelativeTime] formatRelative threw", err);
    return <>{resolvedFallback}</>;
  }

  return <>{label}</>;
}
