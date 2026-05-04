"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { formatDateTime, formatRelative } from "~/lib/dates";

interface RelativeTimeProps {
  value: Date | string;
  /** Server/hydration label. Defaults to the absolute time, which is the
   *  natural fallback for "X ago" strings and avoids `Date.now()`-induced
   *  hydration mismatches. */
  fallback?: string;
}

export function RelativeTime({
  value,
  fallback,
}: RelativeTimeProps): React.JSX.Element {
  const [label, setLabel] = useState<string | null>(null);

  // Re-runs only when the instant changes, not the Date reference.
  const depKey = value instanceof Date ? value.getTime() : value;

  useEffect(() => {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return;

    const update = (): void => {
      try {
        setLabel(formatRelative(date));
      } catch (err) {
        // formatDistanceToNow can throw RangeError on edge inputs; stay on fallback.
        console.warn("[RelativeTime] formatRelative threw", err);
      }
    };
    update();
    const interval = window.setInterval(update, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [depKey]);

  const resolvedFallback = (() => {
    if (fallback !== undefined) return fallback;
    const date = typeof value === "string" ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? "" : formatDateTime(date);
  })();

  return <>{label ?? resolvedFallback}</>;
}
