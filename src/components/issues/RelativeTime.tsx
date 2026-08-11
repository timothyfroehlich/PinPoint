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
   * Pass a server-computed absolute label where the pre-hydration paint should
   * still carry a date — `NotificationList`, `IssueList` and the issue detail
   * page all pass `formatDateTime(...)`, which is stable because the string is
   * built once on the server and handed down as a prop.
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
