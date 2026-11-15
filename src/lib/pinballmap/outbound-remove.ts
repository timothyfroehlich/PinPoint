/**
 * Outbound Pinball Map removals — the domain half of the two remove actions in
 * `m/pinballmap-actions.ts` (spec 4.3; lineup spec §5.4).
 *
 * Same contract as `./outbound-write`: the actions authenticate, parse and
 * revalidate; these flows claim the mutation lease, call PBM before the
 * transaction (CORE-ARCH-011), and edit the stored lineup under the lease.
 *
 * **The stored-snapshot edit is not bookkeeping — it is the correctness of a
 * removal.** Every control renders from the stored lineup, so leaving the
 * deleted entry in it repaints the page as still Lingering and offers Remove
 * again on an entry that is already gone (CORE-ARCH-012).
 *
 * **Which lmx we delete is also correctness.** PBM re-mints a title's row after
 * a delete plus a re-add outside their 7-day window, so a stale id deletes
 * nothing while the title stays on the public lineup. Two things guard that
 * (PP-rnup): the id is resolved from the stored lineup by title, and a
 * `not_found` reply is checked against a freshly re-fetched lineup rather than
 * read as "already gone" — see `classifyRemoveNotFound`.
 */
import "server-only";

import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import type { PinballmapRuntimeState } from "~/lib/types";
import {
  listSurfacingAbandonedForMachine,
  retireAbandonmentForLmx,
} from "~/lib/pinballmap/abandoned-listings";
import { getPinballMapClient } from "~/lib/pinballmap/client";
import { PBM_REFRESH_REFILL_MS } from "~/lib/pinballmap/config";
import {
  mutationLeaseOwnsLocation,
  withPinballMapMutationLease,
} from "~/lib/pinballmap/mutation-lease";
import {
  NOT_LINKED_MESSAGE,
  editStoredSnapshot,
  rejectPush,
} from "~/lib/pinballmap/outbound-write";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import { withLmxRemoved } from "~/lib/pinballmap/snapshot-edit";
import {
  getPinballMapState,
  syncLocationSnapshot,
} from "~/lib/pinballmap/state";
import type { PbmLmx } from "~/lib/pinballmap/types";
import { getLinkedPinballMapCredentials } from "~/lib/pinballmap/user-credentials";

/**
 * What a `not_found` from `removeMachine` actually means (PP-rnup).
 *
 * It is ambiguous, and the two readings need opposite handling:
 *
 * - **The entry really is gone** — someone deleted it on pinballmap.com. Finish
 *   the unlist locally; that is the desync the button exists to resolve.
 * - **Our handle was stale** — PBM re-minted the title's lmx (a delete plus a
 *   re-add outside its 7-day resurrection window) and the row is still on the
 *   lineup under a new id. Clearing local state here reports an unlist that did
 *   not happen: the title stays on PBM and the next reconcile pass re-lists the
 *   cabinet within the hour (CORE-ARCH-012).
 *
 * Only the live lineup separates them. Resolving the lmx from the stored
 * snapshot before the delete narrows the window but cannot close it — the
 * snapshot is itself up to an hour old, so both the machine row and the snapshot
 * can carry the same dead id.
 *
 * So: refresh through the sanctioned `syncLocationSnapshot` chokepoint
 * (CORE-PBM-001 — it owns the ≤20/hour manual throttle) and re-resolve. The
 * refresh is skipped when the stored snapshot is already newer than the throttle
 * interval, since that is the freshest lineup we are allowed to fetch anyway.
 *
 * Refusing is not a dead end the way it would have been before this: the only
 * refusals left are "we could not reach PBM just now" and "PBM's lineup
 * contradicts its own 404", and the first clears on retry.
 */
type NotFoundVerdict =
  /** Confirmed absent from the live lineup — finish the unlist locally. */
  | { kind: "gone" }
  /** Still listed under a different id — delete that one instead. */
  | { kind: "retry"; lmxId: number }
  /** The lineup changed underneath this recovery; never resolve in the new one. */
  | { kind: "location_changed" }
  /** No trustworthy evidence either way — do not claim an unlist happened. */
  | { kind: "refuse"; message: string };

async function classifyRemoveNotFound(args: {
  attemptedLmxId: number;
  pinballmapMachineId: number | null;
  expectedLocationId: number;
  mutationLeaseId: string;
  userId: string;
}): Promise<NotFoundVerdict> {
  const {
    attemptedLmxId,
    pinballmapMachineId,
    expectedLocationId,
    mutationLeaseId,
    userId,
  } = args;

  const isFresh = (syncedAt: Date | null): boolean =>
    syncedAt !== null &&
    Date.now() - syncedAt.getTime() < PBM_REFRESH_REFILL_MS;

  let refreshed = await getPinballMapState();
  if ((refreshed?.locationId ?? null) !== expectedLocationId) {
    return { kind: "location_changed" };
  }

  if (!isFresh(refreshed?.lastSyncedAt ?? null)) {
    // Outcome is deliberately ignored: `throttled` means a concurrent refresh
    // just landed and `error` means PBM is unreachable, and the freshness check
    // below answers both correctly without re-deriving them here.
    await syncLocationSnapshot({
      updatedBy: userId,
      trigger: "manual",
      mutationLeaseId,
    });
    refreshed = await getPinballMapState();
  }

  if ((refreshed?.locationId ?? null) !== expectedLocationId) {
    return { kind: "location_changed" };
  }
  if (!isFresh(refreshed?.lastSyncedAt ?? null)) {
    return {
      kind: "refuse",
      message:
        "Pinball Map says that entry doesn't exist, but PinPoint couldn't refresh the lineup to confirm it's really gone. Nothing was changed — try again in a few minutes.",
    };
  }

  const live =
    pinballmapMachineId !== null && refreshed?.snapshotJson
      ? findLmxForMachine(refreshed.snapshotJson, pinballmapMachineId)
      : undefined;

  if (!live) return { kind: "gone" };
  if (live.id !== attemptedLmxId) return { kind: "retry", lmxId: live.id };

  // PBM 404s the id its own freshly-fetched lineup still advertises. Not a case
  // we can resolve by guessing.
  return {
    kind: "refuse",
    message:
      "Pinball Map still shows this entry but rejected the removal. Nothing was changed — an admin should check the lineup on pinballmap.com.",
  };
}

export type RemoveMachineLineupEntryResult = Result<
  Record<string, never>,
  | "VALIDATION"
  | "NOT_FOUND"
  | "NOT_LINKED"
  | "PBM_REJECTED"
  | "PBM_AUTH_FAILED"
  | "SERVER"
>;

/**
 * Take a machine's entry off the tracked location's Pinball Map lineup (spec
 * 4.3): the entry under the machine's current title, or — when `explicitLmxId`
 * is given — an entry the machine left behind (the abandoned-entry alert).
 *
 * Intent is deliberately untouched; see the action's docblock.
 */
export async function removeMachineLineupEntry(args: {
  userId: string;
  machine: Pick<typeof machines.$inferSelect, "id" | "pinballmapMachineId">;
  /** An entry id the request named, already parsed; null to resolve by title. */
  explicitLmxId: number | null;
}): Promise<RemoveMachineLineupEntryResult> {
  const { userId, machine, explicitLmxId } = args;

  const state = await getPinballMapState();
  if (state?.locationId === null || state?.locationId === undefined)
    return err("SERVER", "Pinball Map isn't configured yet");
  const locationId = state.locationId;

  // The scope check and PBM delete are one configuration-sensitive operation.
  // Claim before evaluating the orphan predicate so a switch cannot turn an
  // old-location orphan into current-location sibling business halfway through
  // the removal (spec 2.5, 10.9, 10.12).
  return withPinballMapMutationLease(
    locationId,
    state.configurationGeneration,
    async (lease) => {
      // The submitted id is attacker-controlled, and the member's linked Pinball
      // Map account it would act through can edit the WHOLE location's lineup
      // (Pinball Map is publicly editable). Push is `member: "owner"`,
      // so without this an owner of any one cabinet could post any lmx on the
      // lineup and delete a game they have nothing to do with. The abandonment
      // records are the allowlist: an entry is this machine's business only if this
      // machine is the one that walked away from it.
      //
      // The record also carries the title the entry was listed under, which is the
      // context the rest of this flow needs — `machine.pinballmapMachineId` is
      // the cabinet's CURRENT title and naming the wrong one here reaches the wrong
      // entry twice over (see the two uses below).
      // The SURFACING list, not every record: an abandoned entry whose title some
      // cabinet still carries is that cabinet's business (spec 2.5) and is not
      // offered here, so accepting it from a stale page would remove an entry a
      // sibling is actively covering — and `withLmxRemoved` would strip that title
      // from the stored lineup too. Authorizing exactly what the UI offers keeps
      // the two from drifting apart in the direction that matters.
      const abandonedRecord =
        explicitLmxId === null
          ? null
          : ((
              await listSurfacingAbandonedForMachine(machine.id, locationId)
            ).find((record) => record.lmxId === explicitLmxId) ?? null);

      if (explicitLmxId !== null && abandonedRecord === null)
        return err(
          "NOT_FOUND",
          "That entry is not one this machine left behind, so it is not this machine's to remove."
        );

      // Which title this removal is ABOUT: the abandoned entry's own, when we are
      // acting on one, and otherwise the cabinet's current title.
      const titleId =
        abandonedRecord?.pinballmapMachineId ?? machine.pinballmapMachineId;
      const removalLocationId = abandonedRecord?.locationId ?? locationId;
      const isCrossLocation =
        abandonedRecord !== null && abandonedRecord.locationId !== locationId;

      const liveLmxId =
        explicitLmxId ??
        (machine.pinballmapMachineId !== null && state.snapshotJson
          ? (findLmxForMachine(state.snapshotJson, machine.pinballmapMachineId)
              ?.id ?? null)
          : null);

      if (liveLmxId === null)
        return err(
          "VALIDATION",
          "That entry is not on the location's lineup, so there is nothing to remove."
        );

      // --- non-transactional effects, both BEFORE the transaction ---
      const linked = await getLinkedPinballMapCredentials(userId);
      if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);
      const { credentials } = linked;

      const client = await getPinballMapClient();
      let deletedLmxId = liveLmxId;
      let written = await client.removeMachine({
        credentials,
        lmxId: deletedLmxId,
      });

      if (!written.ok && written.reason !== "not_found") {
        log.error(
          { reason: written.reason, action: "pinballmap.removeMachine" },
          "PinballMap remove rejected"
        );
        return await rejectPush(userId, linked, written);
      }

      // `not_found` is ambiguous — already gone, or our handle was stale and the
      // title is still listed under a re-minted id. `classifyRemoveNotFound` asks
      // the live lineup which one it is; taking the already-gone reading on faith
      // is what silently un-does a human unlist (PP-rnup).
      if (!written.ok && isCrossLocation) {
        log.info(
          {
            lmxId: deletedLmxId,
            machineId: machine.id,
            action: "pinballmap.removeMachine",
          },
          "PinballMap returned not_found for a cross-location abandoned entry — treating it as already gone"
        );
      } else if (!written.ok) {
        const verdict = await classifyRemoveNotFound({
          attemptedLmxId: deletedLmxId,
          // The abandoned entry's title, not the cabinet's current one. Passing the
          // current title here would ask "has THIS machine's title been re-minted?"
          // about an entry under a different title — and a `retry` verdict would
          // then delete the cabinet's own live entry from the public lineup.
          pinballmapMachineId: titleId,
          expectedLocationId: removalLocationId,
          mutationLeaseId: lease.id,
          userId,
        });

        if (verdict.kind === "location_changed") {
          if (abandonedRecord === null) {
            return err(
              "SERVER",
              "The tracked Pinball Map location changed while this removal was running. Reload the page and try again."
            );
          }
          // Once the tracked location differs, spec 10.12 makes this the same as
          // every other cross-location 404: never re-resolve its title in the new
          // lineup, and retire the old record as already gone.
          log.info(
            {
              lmxId: deletedLmxId,
              machineId: machine.id,
              action: "pinballmap.removeMachine",
            },
            "Tracked Pinball Map location changed during orphan recovery — suppressing title re-resolution"
          );
        } else if (verdict.kind === "refuse") {
          log.warn(
            {
              lmxId: deletedLmxId,
              machineId: machine.id,
              action: "pinballmap.removeMachine",
            },
            "PinballMap returned not_found and the live lineup could not confirm removal — refusing to clear"
          );
          return err("PBM_REJECTED", verdict.message);
        } else if (verdict.kind === "retry") {
          log.info(
            {
              staleLmxId: deletedLmxId,
              lmxId: verdict.lmxId,
              machineId: machine.id,
              action: "pinballmap.removeMachine",
            },
            "PinballMap re-minted this title's lmx — retrying the removal on the live id"
          );
          deletedLmxId = verdict.lmxId;
          written = await client.removeMachine({
            credentials,
            lmxId: deletedLmxId,
          });
          if (!written.ok) {
            log.error(
              { reason: written.reason, action: "pinballmap.removeMachine" },
              "PinballMap remove rejected on the re-resolved lmx"
            );
            return await rejectPush(userId, linked, written);
          }
        } else {
          // Confirmed absent from a lineup we just re-fetched. Finish the job
          // rather than refuse: the desired end state — the entry off the lineup —
          // is already reached, and refusing would strand the reader, since every
          // retry hits the same 404. Not honesty-washing (CORE-ARCH-012): we now
          // have positive evidence of the state we are about to report, we just
          // did not have to do the deleting.
          log.info(
            {
              lmxId: deletedLmxId,
              machineId: machine.id,
              action: "pinballmap.removeMachine",
            },
            "PinballMap lmx confirmed absent from the live lineup — dropping it from the stored lineup"
          );
        }
      }
      // --- transaction: local state only ---

      // Intent is deliberately untouched. Removing is how the operator's existing
      // Off decision gets carried out; writing intent here would make the push and
      // the toggle two ways to do one thing, which is the conflation the two-line
      // control exists to undo (spec 4.1).
      const committed = await db.transaction(async (tx) => {
        if (!(await mutationLeaseOwnsLocation(tx, lease))) return false;
        await editStoredSnapshot(tx, removalLocationId, (snapshot) =>
          // Same reason as above: `withLmxRemoved` drops rows matching EITHER the
          // id or the title, so the cabinet's current title would take its own live
          // row out of the stored lineup and leave every same-title cabinet reading
          // Missing until the next cron.
          withLmxRemoved(snapshot, deletedLmxId, titleId)
        );

        // The abandoned-entry alert reads the RECORD, not the snapshot, so editing
        // the snapshot alone leaves the alert standing after a removal that
        // succeeded — press Remove, watch the page repaint with the same "Still on
        // the location's lineup" card, press it again and 404 through the whole
        // `classifyRemoveNotFound` refresh. That is the failure this module's
        // docblock says the snapshot edit exists to prevent, on the other surface.
        // `clearResolvedAbandonments` would get there eventually; eventually is an
        // hour (CORE-ARCH-012).
        //
        // Both ids, because they can differ: the record holds the id we validated,
        // while `deletedLmxId` is what PBM actually accepted after a re-mint. A
        // delete by lmx that matches nothing is a no-op, so the Lingering path
        // (no record, no explicit id) costs one statement and stays correct.
        if (explicitLmxId !== null)
          await retireAbandonmentForLmx(tx, explicitLmxId);
        if (deletedLmxId !== explicitLmxId)
          await retireAbandonmentForLmx(tx, deletedLmxId);
        await createMachineTimelineEvent(
          machine.id,
          {
            sourceType: "lifecycle",
            tag: "lifecycle",
            // The lmx we actually deleted, which differs from the one we resolved
            // when PBM had re-minted the row. Recording the stale handle would make
            // the timeline disagree with what Pinball Map saw.
            eventData: {
              kind: "pinballmap_listing",
              action: "unlisted",
              lmxId: deletedLmxId,
            },
            actorId: userId,
          },
          tx
        );
        return true;
      });

      if (!committed)
        return err(
          "SERVER",
          "The tracked Pinball Map location changed while this removal was running. Reload the page to verify the lineup before trying again."
        );

      return ok({});
    }
  );
}

export type RemoveUnlinkedLineupEntryResult = Result<
  Record<string, never>,
  "VALIDATION" | "NOT_LINKED" | "PBM_REJECTED" | "PBM_AUTH_FAILED" | "SERVER"
>;

/**
 * Remove an entry no PinPoint machine is linked to (lineup spec §5.4) from the
 * tracked location's lineup: the same push as the machine page's removal, for
 * an entry with no machine to act through. The caller has authorized `lmx`
 * against `state`.
 *
 * A `not_found` is checked against a freshly re-fetched lineup rather than read
 * as "already gone", exactly as {@link removeMachineLineupEntry} does
 * (PP-rnup).
 */
export async function removeUnlinkedLineupEntry(args: {
  userId: string;
  state: PinballmapRuntimeState & { locationId: number };
  lmx: PbmLmx;
}): Promise<RemoveUnlinkedLineupEntryResult> {
  const { userId, state, lmx } = args;
  const titleId = lmx.machineId;

  // --- non-transactional effects, all BEFORE the transaction ---
  const linked = await getLinkedPinballMapCredentials(userId);
  if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);
  const { credentials } = linked;

  return withPinballMapMutationLease(
    state.locationId,
    state.configurationGeneration,
    async (lease) => {
      // Re-check under the lease, immediately before the outbound delete: a
      // machine linked since the page (or the authorize step) read the lineup
      // makes this entry that title's business, removed from its own page.
      const linkedNow = await db.query.machines.findFirst({
        where: eq(machines.pinballmapMachineId, titleId),
        columns: { id: true },
      });
      if (linkedNow)
        return err(
          "VALIDATION",
          "A PinPoint machine is linked to this entry now. Reload the page."
        );

      const client = await getPinballMapClient();
      let deletedLmxId = lmx.id;
      let written = await client.removeMachine({
        credentials,
        lmxId: deletedLmxId,
      });

      if (!written.ok && written.reason !== "not_found") {
        log.error(
          { reason: written.reason, action: "pinballmap.removeUnlinkedEntry" },
          "PinballMap remove rejected"
        );
        return await rejectPush(userId, linked, written);
      }

      if (!written.ok) {
        const verdict = await classifyRemoveNotFound({
          attemptedLmxId: deletedLmxId,
          pinballmapMachineId: titleId,
          expectedLocationId: state.locationId,
          mutationLeaseId: lease.id,
          userId,
        });
        if (verdict.kind === "location_changed")
          return err(
            "SERVER",
            "The tracked Pinball Map location changed while this removal was running. Reload the page and try again."
          );
        if (verdict.kind === "refuse")
          return err("PBM_REJECTED", verdict.message);
        if (verdict.kind === "retry") {
          deletedLmxId = verdict.lmxId;
          written = await client.removeMachine({
            credentials,
            lmxId: deletedLmxId,
          });
          if (!written.ok) {
            log.error(
              {
                reason: written.reason,
                action: "pinballmap.removeUnlinkedEntry",
              },
              "PinballMap remove rejected on the re-resolved lmx"
            );
            return await rejectPush(userId, linked, written);
          }
        }
        // `gone`: confirmed absent from a lineup just re-fetched — finish locally.
      }

      // --- transaction: local state only ---
      const committed = await db.transaction(async (tx) => {
        if (!(await mutationLeaseOwnsLocation(tx, lease))) return false;
        await editStoredSnapshot(tx, state.locationId, (snapshot) =>
          withLmxRemoved(snapshot, deletedLmxId, titleId)
        );
        // A machine that walked away from this entry is no longer owed its
        // cleanup alert once the entry is gone.
        await retireAbandonmentForLmx(tx, lmx.id);
        if (deletedLmxId !== lmx.id)
          await retireAbandonmentForLmx(tx, deletedLmxId);
        return true;
      });
      if (!committed)
        return err(
          "SERVER",
          "The tracked Pinball Map location changed while this removal was running. Reload the page to verify the lineup before trying again."
        );

      return ok({});
    }
  );
}
