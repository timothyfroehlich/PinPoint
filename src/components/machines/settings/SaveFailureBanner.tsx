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
    // Fixed OVERLAY bar anchored to the bottom of the app top bar (h-14 = 56px,
    // z-20) — NOT sticky-in-flow, so showing/hiding it never reflows the tab
    // content (PP-43q3 review). Opaque bg-card (the page is bg-background, so a
    // translucent bg let content bleed through); destructive border + text mark
    // it as a failure. Full-width like the header; inner content is centered.
    <div
      role="alert"
      className="fixed inset-x-0 top-14 z-30 border-b border-destructive/50 bg-card px-4 py-2 shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm text-destructive">
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
    </div>
  );
}
