"use client";

/**
 * Shared 60-second ticker for RelativeTime components.
 *
 * Without this, every <RelativeTime> instance runs its own setInterval(60_000),
 * meaning N mounted components → N timers. On a long issue timeline with many
 * comments this is O(N) timers all firing every minute. The provider collapses
 * that to a single interval regardless of how many instances are mounted.
 *
 * Architecture:
 *  - A module-level external store (singleton) manages the ticker.
 *  - RelativeTimeProvider mounts once in the app root and starts/stops it.
 *  - useRelativeNow() subscribes via useSyncExternalStore — idiomatic React 18.
 *  - RelativeTime reads from useRelativeNow() instead of its own interval.
 *
 * SSR / hydration contract:
 *  - The server snapshot is `null` so that RelativeTime renders the fallback
 *    during SSR and the first synchronous render on the client (before effects
 *    fire). This preserves the original component's hydration-safe behaviour.
 *  - After the provider mounts (useEffect → startTicker), the store emits the
 *    current timestamp and all subscribers re-render with relative labels.
 */

import type React from "react";
import { useEffect, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// External store (module-level singleton)
// ---------------------------------------------------------------------------

type Listener = () => void;

/**
 * `null` = server / pre-mount (render the fallback).
 * `number` = client tick timestamp (render relative label).
 */
let _snapshot: number | null = null;
let _interval: number | null = null;
let _refCount = 0;
const _listeners = new Set<Listener>();

function notifyListeners(): void {
  _snapshot = Date.now();
  for (const listener of _listeners) {
    listener();
  }
}

/** Start the shared ticker. Safe to call multiple times; ref-counted. */
function startTicker(): void {
  _refCount++;
  if (_interval === null) {
    // Emit immediately so components update right after mount, then every 60s.
    notifyListeners();
    _interval = window.setInterval(notifyListeners, 60_000);
  }
}

/** Stop the shared ticker. Only actually stops when all consumers have unmounted. */
function stopTicker(): void {
  _refCount = Math.max(0, _refCount - 1);
  if (_refCount === 0 && _interval !== null) {
    window.clearInterval(_interval);
    _interval = null;
    // Reset to null so a remount starts fresh with the fallback path.
    _snapshot = null;
  }
}

function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function getSnapshot(): number | null {
  return _snapshot;
}

function getServerSnapshot(): number | null {
  // On the server there is no ticker — return null so RelativeTime renders
  // its fallback, matching the original useEffect-based behaviour.
  return null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Mount once in the app root (inside a Client boundary). Starts the shared
 * 60-second ticker on mount and stops it on unmount.
 */
export function RelativeTimeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  useEffect(() => {
    startTicker();
    return stopTicker;
  }, []);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current timestamp as a number once the provider has mounted,
 * or `null` during SSR / before the first tick (signals: render fallback).
 * Updates every 60 seconds via the shared ticker.
 */
export function useRelativeNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
