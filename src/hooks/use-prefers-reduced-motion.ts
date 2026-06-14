"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Reactively reports the user's `prefers-reduced-motion` setting.
 *
 * This is a *motion preference*, not a viewport/layout query, so it's outside
 * the CORE-RESP ban on `useMediaQuery` for layout (which must use CSS
 * breakpoints / container queries). It exists because some animations can't be
 * gated by a `motion-reduce:` utility class — notably an inline `transition`
 * style applied by a library (e.g. @dnd-kit's `useSortable`), which a class
 * can't override. SSR-safe: starts `false` and updates after mount.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setPrefersReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent): void => {
      setPrefersReduced(e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return prefersReduced;
}
