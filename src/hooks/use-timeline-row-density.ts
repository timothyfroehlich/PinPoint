"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Density tier for a timeline issue row's line 1.
 *
 *   - `full`      — id + verb + labeled badges + "— Actor" + time
 *   - `no-actor`  — actor (and its em-dash separator) hidden; verb
 *                   truncates with ellipsis if the badges + ID don't fit
 *
 * (A third "icons-only" tier was considered but skipped for v1 — the
 * verb's ellipsis already handles the squeeze case, and the existing
 * `IssueBadge` component's fixed-width pills don't collapse cleanly to
 * an icon-only state. Revisit if the no-actor state proves cramped in
 * production with long actor names + long titles.)
 */
export type TimelineRowDensity = "full" | "no-actor";

/**
 * Threshold (in px of the **row body** — the flex-1 column next to the
 * leading event icon, i.e. the element the returned ref attaches to).
 * At/above this width the actor is shown.
 *
 * Sized to clear the design-bible `@xl` (576px) container-query tier with
 * a small margin: the row body sits inside the row shell inside the page
 * container, so a body of 560px corresponds to a wider page.
 */
export const TIMELINE_ROW_BREAKPOINT_FULL = 560;

/**
 * Resize-driven density hook for a timeline issue row.
 *
 * Mirrors the pattern in `useTableResponsiveColumns` — observe the
 * container with `ResizeObserver`, recompute on rAF to coalesce
 * back-to-back resize events. Returns a density tier plus the ref the
 * caller attaches to the line-1 element.
 *
 * SSR-safe: starts in `"no-actor"` so the server-rendered HTML matches the
 * narrowest visible state (actor hidden). When the JS bundle hydrates and
 * runs the observer, room is detected and the row expands to `"full"` if
 * the width allows. Hydration mismatch is impossible because the
 * server-rendered DOM is exactly what the client renders before the first
 * effect runs.
 */
export function useTimelineRowDensity(): {
  density: TimelineRowDensity;
  containerRef: React.RefObject<HTMLDivElement | null>;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [density, setDensity] = useState<TimelineRowDensity>("no-actor");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frame = 0;
    const recompute = (): void => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const w = el.offsetWidth;
        if (w === 0) return;
        setDensity(w >= TIMELINE_ROW_BREAKPOINT_FULL ? "full" : "no-actor");
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
