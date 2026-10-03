"use client";

import { useSyncExternalStore } from "react";

/**
 * How much of the layout viewport's bottom edge the on-screen keyboard
 * covers, and the height still visible above it, in CSS pixels.
 *
 * iOS Safari ignores `interactive-widget=resizes-content` (see the viewport
 * export in `app/layout.tsx`): the keyboard shrinks only the visual viewport,
 * so a `bottom: 0` fixed element stays behind it. Bottom sheets read this to
 * sit above the keyboard instead. Zero whenever nothing covers the bottom
 * (no keyboard, or a browser that resizes the layout viewport itself).
 */
export interface VisualViewportInset {
  bottom: number;
  visibleHeight: number | null;
}

const NONE: VisualViewportInset = { bottom: 0, visibleHeight: null };
let current: VisualViewportInset = NONE;

function read(): VisualViewportInset {
  const viewport = window.visualViewport;
  if (!viewport) return NONE;
  const bottom = Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
  );
  if (bottom === 0) return NONE;
  const visibleHeight = Math.round(viewport.height);
  // Keep the snapshot stable while nothing changed (useSyncExternalStore).
  if (current.bottom !== bottom || current.visibleHeight !== visibleHeight) {
    current = { bottom, visibleHeight };
  }
  return current;
}

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => undefined;
  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

export function useVisualViewportInset(): VisualViewportInset {
  return useSyncExternalStore(subscribe, read, () => NONE);
}
