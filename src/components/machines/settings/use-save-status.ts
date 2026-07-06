"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Page-level save status for the auto-saving Machine Settings editor (PP-43q3).
 * Feedback is FAILURE-ONLY — there is no "Saved ✓" state. Tracks three
 * dimensions per set: dirty (working copy diverged from last-saved baseline),
 * pending (save in flight), and failed (last save attempt failed). The nav
 * guard arms on any of them: `hasUnsaved = dirty || pending || failed`.
 *
 * State-machine semantics (PP-43q3 Task 8):
 *   markDirty   — working-copy edit landed; adds to dirtyIds.
 *   markPending — save in flight; set stays dirty until markClean.
 *   markFailed  — clears pending, adds failedIds; leaves dirtyIds alone.
 *   markSaved   — clears pending + failedIds; does NOT clear dirtyIds.
 *   markClean   — clears dirtyIds. Called by execute ONLY on a successful
 *                 save where no newer edit landed during the await.
 */
export function useSaveStatus(): {
  dirtyIds: Set<string>;
  failedIds: Set<string>;
  pending: boolean;
  markDirty: (id: string) => void;
  markClean: (id: string) => void;
  markPending: (id: string) => void;
  markSaved: (id: string) => void;
  markFailed: (id: string) => void;
  hasUnsaved: boolean;
} {
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());

  const markDirty = useCallback((id: string): void => {
    setDirtyIds((p) => (p.has(id) ? p : new Set(p).add(id)));
  }, []);

  const markClean = useCallback((id: string): void => {
    setDirtyIds((p) => removeFrom(p, id));
  }, []);

  const markPending = useCallback((id: string): void => {
    setPendingIds((p) => new Set(p).add(id));
    // A retry clears the prior failure optimistically; markFailed re-adds it.
    setFailedIds((p) => {
      if (!p.has(id)) return p;
      const next = new Set(p);
      next.delete(id);
      return next;
    });
  }, []);

  const markSaved = useCallback((id: string): void => {
    setPendingIds((p) => removeFrom(p, id));
    setFailedIds((p) => removeFrom(p, id));
    // dirtyIds intentionally left alone — markClean handles that separately.
  }, []);

  const markFailed = useCallback((id: string): void => {
    setPendingIds((p) => removeFrom(p, id));
    setFailedIds((p) => new Set(p).add(id));
    // dirtyIds intentionally left alone — the edit is still unsaved.
  }, []);

  const pending = pendingIds.size > 0;
  const hasUnsaved = pending || failedIds.size > 0 || dirtyIds.size > 0;

  return useMemo(
    () => ({
      dirtyIds,
      failedIds,
      pending,
      markDirty,
      markClean,
      markPending,
      markSaved,
      markFailed,
      hasUnsaved,
    }),
    [
      dirtyIds,
      failedIds,
      pending,
      markDirty,
      markClean,
      markPending,
      markSaved,
      markFailed,
      hasUnsaved,
    ]
  );
}

function removeFrom(prev: Set<string>, id: string): Set<string> {
  if (!prev.has(id)) return prev;
  const next = new Set(prev);
  next.delete(id);
  return next;
}
