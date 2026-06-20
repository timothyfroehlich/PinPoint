"use client";

import { useEffect, useState } from "react";

// Tailwind's `md` breakpoint is 768px, so "below md" is <= 767px.
const QUERY = "(max-width: 767px)";

/**
 * Reactively reports whether the viewport is below Tailwind's `md` breakpoint.
 *
 * This is a sanctioned exception to the CORE-RESP ban on `useMediaQuery` for
 * layout. The ban exists because *layout* should be expressed in CSS
 * (breakpoint utilities / container queries), which the renderer can evaluate
 * without JS. This hook is NOT used for layout — it swaps *interaction
 * behavior*: on mobile, tapping a settings row opens a bottom-sheet editor; on
 * desktop, the same row uses inline click-to-edit cells. Those are two
 * different component trees with different event wiring, not two stylings of
 * one tree, so CSS cannot express the difference. Precedent:
 * `use-table-responsive-columns` (PP-rs9), the other documented exception.
 *
 * SSR-safe: starts `false` (desktop-shaped markup) and updates after mount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent): void => {
      setIsMobile(e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
}
