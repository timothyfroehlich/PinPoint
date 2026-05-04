"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { formatRelative } from "~/lib/dates";

interface RelativeTimeProps {
  value: Date | string;
  /** Initial label rendered on the server and during hydration. Avoids a
   *  hydration mismatch from `Date.now()` diverging between server and client. */
  fallback: string;
}

export function RelativeTime({
  value,
  fallback,
}: RelativeTimeProps): React.JSX.Element {
  const [label, setLabel] = useState<string | null>(null);

  // Stable primitive dependency: a fresh `Date` reference with the same instant
  // shouldn't tear down and recreate the 60s interval on every parent re-render.
  const depKey = value instanceof Date ? value.getTime() : value;

  useEffect(() => {
    const date = typeof value === "string" ? new Date(value) : value;
    // Bail out on invalid input. Leaving `label` null causes the fallback to
    // render, and we avoid re-throwing inside a setInterval forever.
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const update = (): void => {
      try {
        setLabel(formatRelative(date));
      } catch (err) {
        // Defense-in-depth: formatRelative -> formatDistanceToNow can still
        // throw (e.g. RangeError on edge inputs). Swallow and stay on
        // fallback. Logger module is server-only, so console.warn is the
        // appropriate surface here.
        console.warn(
          "[RelativeTime] formatRelative threw; using fallback",
          err
        );
      }
    };
    update();
    const interval = window.setInterval(update, 60_000);
    return () => {
      window.clearInterval(interval);
    };
    // depKey is the stabilized primitive form of `value` — passing the raw
    // `value` would re-run this effect on every fresh Date reference, which is
    // exactly the 60s-interval thrash this component is trying to avoid.
  }, [depKey]);

  return <>{label ?? fallback}</>;
}
