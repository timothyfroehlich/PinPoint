"use client";

import type React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";

interface SaveFailureBannerProps {
  /** How many sets currently have a failed save. 0 → render nothing. */
  failedCount: number;
  onRetry: () => void;
}

/**
 * Page-level, failure-only save banner for the Machine Settings editor
 * (PP-43q3). Auto-save shows NO success state; this appears only when a save
 * fails, mirroring Google Docs' "couldn't save" affordance. The typed text is
 * never dropped — the working copy keeps it and Retry re-enqueues the write.
 * Sits sticky at the top of the tab. role="alert" announces it (CORE-A11Y).
 */
export function SaveFailureBanner({
  failedCount,
  onRetry,
}: SaveFailureBannerProps): React.JSX.Element | null {
  if (failedCount <= 0) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Some changes couldn&apos;t be saved. Your edits are still here — retry
        to save them.
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="shrink-0"
      >
        Retry
      </Button>
    </div>
  );
}
