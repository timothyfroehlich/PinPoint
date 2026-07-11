"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Density tier for a timeline issue row's line 1.
 *
 *   - `full`      — id + verb + labeled badges + "— Actor" + time
 *   - `no-actor`  — actor (and its em-dash separator) hidden; both badges
 *                   still shown; verb truncates with ellipsis if the
 *                   badges + ID don't fit
 *   - `compact`   — narrow (phone) tier: actor hidden AND the Frequency
 *                   badge dropped, keeping only Severity. Mirrors the
 *                   PP-dnk8 "mobile badge-wrap caps to Status+Severity"
 *                   rule — two fixed-width pills plus the ID and a long
 *                   relative timestamp don't fit a ~360px row, so the
 *                   secondary badge is shed rather than overflowing.
 */
export type TimelineRowDensity = "full" | "no-actor" | "compact";

/**
 * Thresholds (in px of the **row body** — the flex-1 column next to the
 * leading event icon, i.e. the element the returned ref attaches to).
 *
 * - `FULL` (560): at/above this the actor is shown. Sized to clear the
 *   design-bible `@xl` (576px) tier with a small margin — the row body sits
 *   inside the row shell inside the page container, so 560 here corresponds
 *   to a wider page.
 * - `BADGES` (420): below this, only the Severity badge is kept. Both
 *   fixed-width pills (~severity 70px + frequency 110px) plus the ID and a
 *   "N minutes ago" timestamp need ~360px of clear space; 420 keeps a margin
 *   so the second badge is shed before the row is forced to overlap.
 */
export const TIMELINE_ROW_BREAKPOINT_FULL = 560;
export const TIMELINE_ROW_BREAKPOINT_BADGES = 420;

/**
 * Resize-driven density hook for a timeline issue row.
 *
 * Mirrors the pattern in `useTableResponsiveColumns` — observe the
 * container with `ResizeObserver`, recompute on rAF to coalesce
 * back-to-back resize events. Returns a density tier plus the ref the
 * caller attaches to the line-1 element.
 *
 * SSR-safe: starts in `"compact"` so the server-rendered HTML matches the
 * narrowest visible state (actor hidden, single badge). When the JS bundle
 * hydrates and runs the observer, room is detected and the row expands to
 * `"no-actor"` or `"full"` if the width allows. Hydration mismatch is
 * impossible because the server-rendered DOM is exactly what the client
 * renders before the first effect runs.
 */
export function useTimelineRowDensity(): {
  density: TimelineRowDensity;
  containerRef: React.RefObject<HTMLDivElement | null>;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState<TimelineRowDensity>("compact");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frame = 0;
    const recompute = (): void => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const w = el.offsetWidth;
        if (w === 0) return;
        setDensity(
          w >= TIMELINE_ROW_BREAKPOINT_FULL
            ? "full"
            : w >= TIMELINE_ROW_BREAKPOINT_BADGES
              ? "no-actor"
              : "compact"
        );
      });
    };

    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    recompute();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return { density, containerRef };
}
