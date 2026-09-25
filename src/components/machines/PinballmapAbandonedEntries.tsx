"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";

import { removeMachineFromPinballMapAction } from "~/app/(app)/m/pinballmap-actions";
import {
  RemovalCommentNotice,
  useRemovalCommentCheck,
  type RemovalCommentState,
} from "~/components/machines/PinballmapRemovalComments";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

/** One entry this machine walked away from and nobody has taken down (PP-l81u). */
export interface AbandonedEntry {
  lmxId: number;
  /** Public Pinball Map page for the location this entry was abandoned at. */
  locationUrl: string;
  /** Catalog title at the time, or null if the mirror no longer carries it. */
  title: string | null;
  /** Older locations cannot be refreshed through the tracked-location seam. */
  currentLocation: boolean;
  /** Existing confirmation data for older-location entries, when available. */
  commentCount: number | null;
}

/**
 * Entries left on the location's lineup by a re-match (spec 2.5).
 *
 * **This is the orphan surface, and it is deliberately not the Lingering
 * state.** Lingering is what an entry looks like while cabinets still carry its
 * title — it shows through their own controls, because the entry is that title's
 * ordinary business. This alert is for the other case: the title has left the
 * fleet entirely, so no control would ever render it, and PinPoint remembers
 * which machine walked away in order to have somewhere to put it.
 *
 * The copy and the action match Lingering's on purpose. To the person reading,
 * the two situations are the same — an entry on the public map that should not
 * be there — and giving them different words or different resolutions would make
 * an implementation distinction into a user-facing one.
 */
export function PinballmapAbandonedEntries({
  machineId,
  entries,
  canPush,
  writeEnabled,
}: {
  machineId: string;
  entries: readonly AbandonedEntry[];
  /** Viewer holds the push capability; false keeps the alert status-only. */
  canPush: boolean;
  /** An operator credential exists, allowing PinPoint to perform the write. */
  writeEnabled: boolean;
}): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(lmxId: number): void {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("machineId", machineId);
      // The entry's own id, not this machine's current title: the whole point of
      // the record is that the machine no longer carries the title the entry is
      // under, so resolving by title would find the wrong row or none.
      formData.set("lmxId", String(lmxId));
      const result = await removeMachineFromPinballMapAction(
        undefined,
        formData
      );
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <Alert variant="warning" data-testid="machine-pinballmap-abandoned">
      <TriangleAlert className="size-4" aria-hidden="true" />
      <AlertDescription>
        {entries.map((entry) => (
          <div
            key={entry.lmxId}
            className="flex flex-wrap items-center gap-2 py-0.5"
          >
            <span className="flex-1">
              Still on the location&apos;s lineup:{" "}
              {entry.title === null
                ? `Pinball Map entry #${String(entry.lmxId)}`
                : `“${entry.title}”`}{" "}
              — this machine&apos;s model changed.
            </span>
            {canPush && writeEnabled ? (
              <RemoveEntryButton
                machineId={machineId}
                entry={entry}
                pending={pending}
                onConfirm={() => {
                  remove(entry.lmxId);
                }}
              />
            ) : canPush ? (
              <a
                href={entry.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Remove it on Pinball Map
              </a>
            ) : null}
          </div>
        ))}

        {/* GOV.UK Details pattern: expands in place, no navigation, and it works
            on touch where a tooltip does not. Named for its topic rather than
            "Learn more", which NN/G flags as poor information scent. */}
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
            Why is this here?
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            This machine was on Pinball Map under that title, and changing its
            model left the old entry behind. Cleaning it up is a separate action
            on purpose — the entry may stay as long as you want it to.
          </p>
        </details>

        {error !== null ? (
          <p
            className="mt-2 text-xs text-destructive-text"
            role="alert"
            data-testid="pbm-abandoned-error"
          >
            {error}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** Refreshes tracked-location counts; older-location cleanup remains PP-o355.49. */
function RemoveEntryButton({
  machineId,
  entry,
  pending,
  onConfirm,
}: {
  machineId: string;
  entry: AbandonedEntry;
  pending: boolean;
  onConfirm: () => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const comments = useRemovalCommentCheck();
  const game = entry.title ?? `Pinball Map entry #${String(entry.lmxId)}`;

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    if (!entry.currentLocation) return;
    if (nextOpen) comments.start({ machineId, lmxId: String(entry.lmxId) });
    else comments.cancel();
  }

  // Older locations keep the stored count (PP-o355.49); a zero needs no notice.
  const notice: RemovalCommentState | null = entry.currentLocation
    ? comments.state
    : entry.commentCount === null
      ? { kind: "unavailable" }
      : entry.commentCount === 0
        ? null
        : { kind: "count", count: entry.commentCount, lastKnown: null };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          data-testid={`pbm-abandoned-remove-${String(entry.lmxId)}`}
        >
          Remove machine from Pinball Map
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="pbm-abandoned-remove-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from Pinball Map?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes {game} from the location&apos;s lineup on pinballmap.com. It
            will no longer be publicly visible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {notice !== null ? (
          <RemovalCommentNotice state={notice} testId="pbm-abandoned-remove" />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={pending || (entry.currentLocation && !comments.ready)}
            onClick={onConfirm}
          >
            {comments.lastKnown ? "Remove anyway" : "Remove machine"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
