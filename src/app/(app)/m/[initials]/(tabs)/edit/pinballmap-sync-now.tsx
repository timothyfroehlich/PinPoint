"use client";

import type React from "react";
import { useActionState } from "react";
import { syncPinballMapNowAction } from "~/app/(app)/m/pinballmap-actions";

/**
 * "Sync now" — the manual refresh in the PinballMap section header of the
 * machine edit page (PP-o355.19).
 *
 * `syncPinballMapNowAction` is already form-action shaped, so this stays a
 * plain `<form action={...}>` — it carries no Radix Select and no controlled
 * hidden inputs, so React 19's post-action reset has nothing to wipe (see
 * the `pinpoint-ui` skill → Server Action Forms). It reports its own outcome rather
 * than claiming success it can't verify (CORE-ARCH-012): the action
 * self-throttles at the `syncLocationSnapshot` seam and surfaces `THROTTLED`
 * rather than hammering PinballMap (CORE-PBM-001).
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
