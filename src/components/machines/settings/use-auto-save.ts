"use client";

import { useCallback, useEffect, useRef } from "react";

const DEBOUNCE_MS = 800;

/**
 * Auto-save trigger timing for the Machine Settings editor (PP-43q3). Sits on
 * top of `useSettingsSaveQueue` (which coalesces + serializes the actual
 * whole-row writes): text edits `schedule()` a debounced persist; blur and
 * toggles `flush()` immediately. Per-id timers so editing two sets at once
 * doesn't cross-cancel. Timers live in a ref (no render output) and are cleared
 * on unmount.
 *
 * Unmount FLUSHES pending timers (PP-43q3 Task 9 durability): a debounced edit
 * that hasn't fired yet must still persist when the tab unmounts on in-app
 * navigation. The fired server action survives the unmount and completes in the
 * background (React 19 makes the post-unmount status update a silent no-op).
 * This is the always-live contract: every edit persists. (Flushing here rather
 * than in a SettingsTab effect avoids a fragile dependency on effect-cleanup
 * ordering — React runs cleanups top-to-bottom, so a parent effect registered
 * after this hook cannot reliably flush before this hook clears its own timers.)
 */
export function useAutoSave(persist: (id: string) => void): {
  schedule: (id: string) => void;
  flush: (id: string) => void;
  flushAll: () => void;
  cancel: (id: string) => void;
} {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Hold persist in a ref so the returned callbacks stay referentially stable.
  const persistRef = useRef(persist);
  persistRef.current = persist; // keep ref current each render without breaking callback stability

  const cancel = useCallback((id: string): void => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const flush = useCallback(
    (id: string): void => {
      cancel(id);
      persistRef.current(id);
    },
    [cancel]
  );

  const schedule = useCallback(
    (id: string): void => {
      cancel(id);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          persistRef.current(id);
        }, DEBOUNCE_MS)
      );
    },
    [cancel]
  );

  const flushAll = useCallback((): void => {
    for (const id of [...timers.current.keys()]) flush(id);
  }, [flush]);

  // Flush (don't drop) any pending debounced saves on unmount — see header.
  // `flushAll` is stable; the empty-dep effect runs its cleanup once on unmount.
  useEffect(() => () => flushAll(), [flushAll]);

  return { schedule, flush, flushAll, cancel };
}
