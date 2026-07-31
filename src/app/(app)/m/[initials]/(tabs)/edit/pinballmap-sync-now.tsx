"use client";

import type React from "react";
import { useActionState } from "react";
import { syncPinballMapNowAction } from "~/app/(app)/m/pinballmap-actions";

/**
 * "Sync now" — the manual refresh in the PinballMap section header of the
 * machine edit page (PP-o355.19).
 *
 * `syncPinballMapNowAction` is already form-action shaped, so this is a plain
 * `<form action={...}>` and works without JavaScript (CORE-ARCH-002). The
 * action self-throttles at the `syncLocationSnapshot` seam and reports
 * `THROTTLED` rather than hammering PinballMap (CORE-PBM-001).
 */
export function PinballmapSyncNow(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(
    syncPinballMapNowAction,
    undefined
  );

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={isPending}
        className="text-primary underline underline-offset-2 hover:no-underline disabled:opacity-60"
        data-testid="pbm-sync-now"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {state && !state.ok && (
        <span className="ml-2 text-destructive-text" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
