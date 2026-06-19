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
 * Unmount intentionally cancels pending timers WITHOUT flushing — pending edits
 * are not auto-persisted on teardown. This is by design: the SettingsTab nav
 * guard blocks in-app navigation while saves are unsaved, and `beforeunload`
 * calls `flushAll()` (both wired in Task 6), so the caller is responsible for
 * flushing before unmounting.
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

  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    },
    []
  );

  return { schedule, flush, flushAll, cancel };
}
