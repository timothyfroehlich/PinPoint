"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = (): (() => void) => {
  return () => {
    // Static subscription: hydration state never reverts on the client.
  };
};

/**
 * Returns true once the component has hydrated on the client.
 *
 * - Server-side rendering (SSR): returns `false` (via `getServerSnapshot`).
 * - Client hydration pass: returns `false` matching SSR output without hydration mismatch.
 * - Post-hydration and client-only renders: returns `true` (via `getSnapshot`).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
