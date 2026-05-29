"use client";

import type React from "react";
import { formatRelative } from "~/lib/dates";
import { useRelativeNow } from "./RelativeTimeProvider";

interface RelativeTimeProps {
  value: Date | string;
  /** Server/hydration label. Defaults to an ISO instant so SSR and browser
   *  hydration do not diverge across different default locales/time zones. */
  fallback?: string;
}

export function RelativeTime({
  value,
  fallback,
}: RelativeTimeProps): React.JSX.Element {
  // `null` during SSR and before the provider's first tick — render fallback.
  // After mount the shared ticker emits a number every 60s, causing a re-render.
  const now = useRelativeNow();

  const resolvedFallback = (() => {
    if (fallback !== undefined) return fallback;
    const date = typeof value === "string" ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  })();

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
