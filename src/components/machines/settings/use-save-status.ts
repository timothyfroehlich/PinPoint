"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Page-level save status for the auto-saving Machine Settings editor (PP-43q3).
 * Feedback is FAILURE-ONLY — there is no "Saved ✓" state. Tracks which sets
 * have a save in flight (`pending`) and which last failed (`failedIds`), so the
 * tab can show a single Google-Docs-style banner and arm a navigation guard
 * while anything is unsaved. Set ids here are the CURRENT id (temp id until a
 * new set's first insert swaps it).
 */
export function useSaveStatus(): {
  failedIds: Set<string>;
  pending: boolean;
  markPending: (id: string) => void;
  markSaved: (id: string) => void;
  markFailed: (id: string) => void;
  hasUnsaved: boolean;
} {
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());

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
  }, []);

  const markFailed = useCallback((id: string): void => {
    setPendingIds((p) => removeFrom(p, id));
    setFailedIds((p) => new Set(p).add(id));
  }, []);

  const pending = pendingIds.size > 0;
  const hasUnsaved = pending || failedIds.size > 0;

  return useMemo(
    () => ({
      failedIds,
      pending,
      markPending,
      markSaved,
      markFailed,
      hasUnsaved,
    }),
    [failedIds, pending, markPending, markSaved, markFailed, hasUnsaved]
  );
}

function removeFrom(prev: Set<string>, id: string): Set<string> {
  if (!prev.has(id)) return prev;
  const next = new Set(prev);
  next.delete(id);
  return next;
}
