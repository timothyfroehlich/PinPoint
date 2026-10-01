"use client";

import React, { useContext, useSyncExternalStore } from "react";

// Tailwind's `md` breakpoint is 768px, so "below md" is <= 767px.
const QUERY = "(max-width: 767px)";

function hasMatchMedia(): boolean {
  return (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
  );
}

function subscribe(onChange: () => void): () => void {
  // Environments without media queries (jsdom) keep the desktop tree.
  if (!hasMatchMedia()) return () => undefined;
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return hasMatchMedia() ? window.matchMedia(QUERY).matches : false;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribeNever(): () => void {
  return () => undefined;
}

/**
 * A page-level reading of the flag, so a page with many consumers reads the
 * media query once (the issue detail page provides it in `IssueSections`).
 */
const IsMobileContext = React.createContext<boolean | null>(null);

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
 * Every consumer is listed under CORE-RESP-002 in `docs/NON_NEGOTIABLES.md`.
 *
 * SSR-safe: the server snapshot is `false` (desktop-shaped markup); hydration
 * renders that, then React re-renders with the real value. A component that
 * mounts after hydration reads the real value on its first render.
 *
 * Under an `IsMobileProvider` the hook reads the provider's value and does not
 * subscribe on its own.
 */
export function useIsMobile(): boolean {
  const provided = useContext(IsMobileContext);
  const own = useSyncExternalStore(
    provided === null ? subscribe : subscribeNever,
    provided === null ? getSnapshot : getServerSnapshot,
    getServerSnapshot
  );
  return provided ?? own;
}

/** Reads the media query once and shares it with every `useIsMobile` below. */
export function IsMobileProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const isMobile = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return (
    <IsMobileContext.Provider value={isMobile}>
      {children}
    </IsMobileContext.Provider>
  );
}
