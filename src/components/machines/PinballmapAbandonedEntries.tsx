"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";

import { removeMachineFromPinballMapAction } from "~/app/(app)/m/pinballmap-actions";
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
  /** Catalog title at the time, or null if the mirror no longer carries it. */
  title: string | null;
  /** Comments on the entry, for the remove confirm (spec 4.6). */
  commentCount: number | null;
  /**
   * Link-back to the venue THIS entry is on — which is not always the tracked
   * one. A record kept across a re-point (spec 6.4) belongs to a lineup PinPoint
   * no longer syncs, and pointing its "remove it yourself" link at the current
   * location sends the reader to a page the entry is not on.
   */
  locationUrl: string;
  /** True when the entry's venue is no longer the one PinPoint tracks. */
  crossLocation: boolean;
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
}: {
  machineId: string;
  entries: readonly AbandonedEntry[];
  canPush: boolean;
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
              {entry.crossLocation
                ? "Still on a previously tracked location's lineup: "
                : "Still on the location's lineup: "}
              {entry.title === null
                ? `Pinball Map entry #${String(entry.lmxId)}`
                : `“${entry.title}”`}{" "}
              — this machine&apos;s model changed.
            </span>
            {canPush ? (
              <RemoveEntryButton
                entry={entry}
                pending={pending}
                onConfirm={() => {
                  remove(entry.lmxId);
                }}
              />
            ) : (
              <a
                href={entry.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Remove it on Pinball Map
              </a>
            )}
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

/** Same confirm as the control's Remove, including the comment count (4.6). */
function RemoveEntryButton({
  entry,
  pending,
  onConfirm,
}: {
  entry: AbandonedEntry;
  pending: boolean;
  onConfirm: () => void;
}): React.JSX.Element {
  const game = entry.title ?? `Pinball Map entry #${String(entry.lmxId)}`;
  const consequence =
    entry.commentCount === null
      ? "PinPoint could not read this entry's comments just now, so it can't say how many would be lost. Refresh first if that matters."
      : entry.commentCount === 0
        ? null
        : `The entry has ${String(entry.commentCount)} ${entry.commentCount === 1 ? "comment" : "comments"}. They are recoverable only if the game is re-added within 7 days; after that the history is permanently lost.`;

  return (
    <AlertDialog>
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
        {consequence !== null ? (
          <p className="rounded-r-md border-l-[3px] border-warning bg-warning-container/40 px-3 py-2 text-sm text-on-warning-container">
            {consequence}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            Remove machine
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
