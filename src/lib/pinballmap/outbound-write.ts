/**
 * Outbound Pinball Map writes — the domain half of the lineup push actions in
 * `m/pinballmap-actions.ts` (spec 4.3, 3.7, 3.8).
 *
 * The actions own authentication, input parsing, cache revalidation and the
 * form's return shape; everything from reading the tracked location to the
 * local transaction lives here. Each flow returns a `Result` whose error codes
 * the actions pass straight through. A `PBM_AUTH_FAILED` error means the
 * member's link was just marked failed (spec 8.5), so the caller revalidates
 * the pages that read the link status.
 *
 * Every flow follows the same ordering rule (CORE-ARCH-011): the credential
 * decrypt and the PBM HTTP call run before the transaction, and only their
 * results enter it. Every flow that writes to PBM holds the mutation lease
 * (`withPinballMapMutationLease`) across the call and the local commit, and
 * commits only while the lease still owns the tracked location
 * (`mutationLeaseOwnsLocation`).
 *
 * The removals live in `./outbound-remove`, which shares the plumbing exported
 * here.
 */
import "server-only";

import { eq, sql } from "drizzle-orm";

import { db, type Tx } from "~/server/db";
import { machines, pinballmapState } from "~/server/db/schema";
import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import {
  recordAbandonedListing,
  retireAbandonmentForLmx,
} from "~/lib/pinballmap/abandoned-listings";
import { getCatalogEntry } from "~/lib/pinballmap/catalog";
import { getPinballMapClient } from "~/lib/pinballmap/client";
import {
  insiderConnectedTarget,
  type PbmIcIntent,
} from "~/lib/pinballmap/insider-connected";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import { withLmxAdded, withLmxIcEnabled } from "~/lib/pinballmap/snapshot-edit";
import {
  mutationLeaseOwnsLocation,
  withPinballMapMutationLease,
} from "~/lib/pinballmap/mutation-lease";
import {
  PINBALLMAP_STATE_ID,
  getPinballMapState,
  syncLocationSnapshot,
  type PinballMapMutationLease,
} from "~/lib/pinballmap/state";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import type {
  LocationSnapshot,
  PbmCredentials,
  PbmWriteFailure,
} from "~/lib/pinballmap/types";
import {
  getLinkedPinballMapCredentials,
  markPinballMapLinkNeedsRelink,
  type LinkedPinballMapCredentials,
} from "~/lib/pinballmap/user-credentials";

/** Returned when the pushing member has no usable Pinball Map link (8.2). */
export const NOT_LINKED_MESSAGE =
  "Link your Pinball Map account in Settings to change the lineup from here.";

/** Human-facing text for a PBM write failure, by reason. */
function pbmWriteFailureMessage(failure: PbmWriteFailure): string {
  switch (failure.reason) {
    case "rate_limited":
      return "Pinball Map is rate-limiting us. Try again in a few minutes.";
    case "unauthorized":
      return "Pinball Map authentication failed. Reconnect your account in Settings.";
    case "api_token":
      return "Pinball Map refused PinPoint's API access. An admin needs to check the integration.";
    case "not_found":
      return "Pinball Map couldn't find that entry. It may already be gone.";
    case "rejected":
      return failure.message ?? "Pinball Map rejected the change.";
    case "transient":
      return "Pinball Map didn't respond properly. Try again.";
  }
}

/**
 * Turn a rejected push into the flow's error. When Pinball Map refused the
 * token itself, the member's link is marked failed (spec 8.5) — that rejection
 * is the only time PinPoint learns a token is dead; it never polls — and the
 * error carries its own code, because the machine page then shows a standing
 * "authentication failed" note and a second, transient copy would repeat it.
 *
 * The caller revalidates on `PBM_AUTH_FAILED`: the link status decides the
 * push buttons on every machine page, the lineup page and Settings.
 */
export async function rejectPush(
  userId: string,
  linked: LinkedPinballMapCredentials,
  failure: PbmWriteFailure
): Promise<Result<never, "PBM_REJECTED" | "PBM_AUTH_FAILED">> {
  if (failure.reason === "unauthorized") {
    await markPinballMapLinkNeedsRelink(userId, linked.tokenVaultId);
    return err("PBM_AUTH_FAILED", pbmWriteFailureMessage(failure));
  }
  return err("PBM_REJECTED", pbmWriteFailureMessage(failure));
}

/**
 * Apply `edit` to the stored location snapshot, against a row this transaction
 * holds a lock on.
 *
 * The copy the action read before its PBM call is NOT safe to write back. The
 * credential decrypt and the HTTP round-trip sit in between — and the live
 * client serializes writes behind a process-wide queue — so two list/unlist
 * actions, or an hourly cron sync, routinely overlap that window. Writing the
 * whole `snapshot_json` blob from a pre-call copy silently drops the other
 * writer's edit, leaving a machine listed locally but absent from the stored
 * lineup: exactly the `listed_locally_absent_on_pbm` desync these edits exist to
 * prevent. Re-reading `FOR UPDATE` serializes the read-modify-write on the
 * singleton's row lock.
 *
 * A null snapshot (never synced) is left alone — there is no lineup to correct.
 */
export async function editStoredSnapshot(
  tx: Tx,
  expectedLocationId: number,
  edit: (snapshot: LocationSnapshot) => LocationSnapshot
): Promise<void> {
  const [row] = await tx
    .select({
      locationId: pinballmapState.locationId,
      snapshotJson: pinballmapState.snapshotJson,
    })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, PINBALLMAP_STATE_ID))
    .for("update");
  if (row?.locationId !== expectedLocationId || !row.snapshotJson) return;
  await tx
    .update(pinballmapState)
    .set({
      snapshotJson: edit(row.snapshotJson),
      snapshotRevision: sql`${pinballmapState.snapshotRevision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(pinballmapState.id, PINBALLMAP_STATE_ID));
}

async function locationGenerationIsCurrent(
  tx: Tx,
  locationId: number,
  configurationGeneration: number
): Promise<boolean> {
  const [row] = await tx
    .select({
      locationId: pinballmapState.locationId,
      configurationGeneration: pinballmapState.configurationGeneration,
    })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, PINBALLMAP_STATE_ID))
    .for("update");
  return (
    row?.locationId === locationId &&
    row.configurationGeneration === configurationGeneration
  );
}

/**
 * The entry's Insider Connected target from every cabinet sharing its title,
 * read fresh rather than trusted from the page (3.8: On wins).
 */
async function entryIcTarget(titleId: number): Promise<PbmIcIntent | null> {
  const rows = await db
    .select({ icIntent: machines.pinballmapIcIntent })
    .from(machines)
    .where(eq(machines.pinballmapMachineId, titleId));
  return insiderConnectedTarget(rows.map((row) => row.icIntent));
}

type IcPushOutcome =
  | { kind: "applied" }
  | { kind: "rejected"; failure: PbmWriteFailure }
  | { kind: "unclear" }
  | { kind: "lease_lost" };

/**
 * Send an entry's Insider Connected target to Pinball Map and store what it
 * reports. Runs inside the caller's mutation lease, with the PBM call before
 * the transaction (CORE-ARCH-011).
 *
 * **Sends the target value, never a flip.** PBM's `ic_toggle` inverts the
 * setting when called without `ic_enabled`, so a flip from a stale page or a
 * double click would undo the intent. With the target in the request the write
 * is idempotent, so it is sent even when the stored lineup already matches: the
 * stored lineup can be an hour stale.
 *
 * A transient failure, or a success with no state in the body, is `unclear`:
 * the caller re-reads the lineup instead of retrying (3.8).
 */
async function pushInsiderConnected(args: {
  credentials: PbmCredentials;
  lease: PinballMapMutationLease;
  locationId: number;
  lmxId: number;
  target: PbmIcIntent;
}): Promise<IcPushOutcome> {
  const { credentials, lease, locationId, lmxId, target } = args;
  const client = await getPinballMapClient();
  const written = await client.setInsiderConnected({
    credentials,
    lmxId,
    enabled: target === "on",
  });

  if (!written.ok && written.reason !== "transient") {
    log.error(
      { reason: written.reason, action: "pinballmap.setInsiderConnected" },
      "PinballMap Insider Connected change rejected"
    );
    return { kind: "rejected", failure: written };
  }
  if (!written.ok || written.icEnabled === null) {
    log.warn(
      { lmxId, action: "pinballmap.setInsiderConnected" },
      "PinballMap Insider Connected outcome unclear — re-reading the lineup instead of retrying"
    );
    return { kind: "unclear" };
  }

  const reported = written.icEnabled;
  // --- transaction: local state only ---
  const committed = await db.transaction(async (tx) => {
    if (!(await mutationLeaseOwnsLocation(tx, lease))) return false;
    await editStoredSnapshot(tx, locationId, (snapshot) =>
      withLmxIcEnabled(snapshot, lmxId, reported)
    );
    return true;
  });
  return committed ? { kind: "applied" } : { kind: "lease_lost" };
}

/**
 * After an unclear Insider Connected outcome: re-read the lineup through the
 * sync chokepoint so the page shows what Pinball Map actually has. Called
 * outside the lease, since the refresh claims its own place. The shared lineup
 * may have changed either way, so every caller revalidates the `/m` layout.
 */
async function reReadAfterUnclearIc(userId: string): Promise<boolean> {
  const refreshed = await syncLocationSnapshot({
    updatedBy: userId,
    trigger: "manual",
  });
  if (refreshed.ok) await reconcileAfterSync();
  return refreshed.ok;
}

export type AddLineupEntryResult = Result<
  {
    lmxId: number;
    /**
     * The stored lineup already carried the title, so nothing was sent and
     * the stored lineup is unchanged — only the machine's own page reads
     * differently (its abandonment record was retired).
     */
    alreadyListed: boolean;
  },
  "NOT_LINKED" | "PBM_REJECTED" | "PBM_AUTH_FAILED" | "SERVER"
>;

/**
 * Add a title to the tracked location's Pinball Map lineup (spec 4.3), record
 * the entry PBM mints or hands back, and apply the entry's Insider Connected
 * target.
 *
 * **Ordering is a hard requirement, not a style choice** (CORE-ARCH-011). Two
 * non-transactional effects run first — decrypting the member's credential and
 * the PBM HTTP call — and only their results enter the transaction. A tripwire
 * throws `SideEffectInTransactionError` if either is moved inside it.
 *
 * On a PBM rejection nothing is written locally: an entry we could not create
 * must not be reported as created (CORE-ARCH-012).
 *
 * There is no incumbent check any more. Under the coverage model several
 * same-title cabinets may be On at once and PBM's add is find-or-create, so a
 * second cabinet pressing Add gets the existing entry back — which is the
 * correct outcome, not a collision to refuse.
 */
export async function addLineupEntry(args: {
  userId: string;
  machineId: string;
  titleId: number;
}): Promise<AddLineupEntryResult> {
  const { userId, machineId, titleId } = args;

  const state = await getPinballMapState();
  if (state?.locationId === null || state?.locationId === undefined)
    return err("SERVER", "Pinball Map isn't configured yet");
  const locationId = state.locationId;
  const configurationGeneration = state.configurationGeneration;

  // Idempotent: the lineup already carries this title, so there is nothing to
  // add and the entry it already has is the answer. Spending a write call on
  // PBM's find-or-create to be told the same thing would be traffic against
  // someone else's service for no result (CORE-PBM-001).
  //
  // The abandonment still has to be retired, and this is the reason it is not
  // left to the hourly pass: some machine walked away from this exact entry,
  // and its page is telling its owner to take down an entry that a cabinet
  // now covers (CORE-ARCH-012).
  const existing = state.snapshotJson
    ? findLmxForMachine(state.snapshotJson, titleId)
    : null;
  if (existing) {
    const committed = await db.transaction(async (tx) => {
      if (
        !(await locationGenerationIsCurrent(
          tx,
          locationId,
          configurationGeneration
        ))
      ) {
        return false;
      }
      await retireAbandonmentForLmx(tx, existing.id);
      return true;
    });
    if (!committed)
      return err(
        "SERVER",
        "The tracked Pinball Map location changed while this addition was running. Reload the page and try again."
      );
    return ok({ lmxId: existing.id, alreadyListed: true });
  }

  // --- non-transactional effects, both BEFORE the transaction ---
  const linked = await getLinkedPinballMapCredentials(userId);
  if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);

  const leased = await withPinballMapMutationLease(
    locationId,
    configurationGeneration,
    async (lease) => {
      const client = await getPinballMapClient();
      const written = await client.addMachine({
        credentials: linked.credentials,
        locationId,
        machineId: titleId,
      });
      if (!written.ok) {
        log.error(
          { reason: written.reason, action: "pinballmap.addMachine" },
          "PinballMap add rejected"
        );
        return await rejectPush(userId, linked, written);
      }
      const lmxId = written.lmxId;
      // --- transaction: local state only ---

      const committed = await db.transaction(async (tx) => {
        if (!(await mutationLeaseOwnsLocation(tx, lease))) return false;
        // PBM returns the EXISTING lmx when the entry is already on the lineup, so
        // an add can reclaim one a machine walked away from.
        await retireAbandonmentForLmx(tx, lmxId);
        // The stored lineup is what every control renders from, so it has to carry
        // the entry we just created — otherwise the page repaints as still Missing
        // and offers Add again, for up to an hour (CORE-ARCH-012).
        await editStoredSnapshot(tx, locationId, (snapshot) =>
          withLmxAdded(snapshot, lmxId, titleId)
        );
        await createMachineTimelineEvent(
          machineId,
          {
            sourceType: "lifecycle",
            tag: "lifecycle",
            eventData: { kind: "pinballmap_listing", action: "listed", lmxId },
            actorId: userId,
          },
          tx
        );
        return true;
      });

      if (!committed) {
        // The only normal way to lose the lease is an invocation outliving its
        // recovery window. Do not report a listing we could not attach locally;
        // retain its exact old-location handle as an actionable cleanup record.
        await db.transaction(async (tx) => {
          await recordAbandonedListing(
            tx,
            machineId,
            { lmxId, pinballmapMachineId: titleId, locationId },
            userId
          );
        });
        return err(
          "SERVER",
          "The tracked Pinball Map location changed while this addition was running. The old-location entry was saved for cleanup; reload the page."
        );
      }

      // Adding also applies the entry's Insider Connected target (4.3), so one
      // push leaves Pinball Map matching both intents. A failure here does not
      // undo the add: the page then shows Insider Connected differs, with its
      // own Update push.
      const icTarget = (await getCatalogEntry(titleId))?.icEligible
        ? await entryIcTarget(titleId)
        : null;
      let icUnclear = false;
      if (icTarget !== null) {
        const icOutcome = await pushInsiderConnected({
          credentials: linked.credentials,
          lease,
          locationId,
          lmxId,
          target: icTarget,
        });
        icUnclear = icOutcome.kind === "unclear";
      }

      return ok({ lmxId, icUnclear });
    }
  );
  if (!leased.ok) return leased;

  // Outside the lease: the re-read claims its own place at the sync chokepoint.
  if (leased.value.icUnclear) await reReadAfterUnclearIc(userId);
  return ok({ lmxId: leased.value.lmxId, alreadyListed: false });
}

export type PushEntryInsiderConnectedResult = Result<
  { icEnabled: boolean },
  | "VALIDATION"
  | "NOT_LINKED"
  | "PBM_REJECTED"
  | "PBM_AUTH_FAILED"
  // The write may or may not have landed. Not retried; the lineup is re-read
  // so the page shows what Pinball Map actually has (spec 3.8). The caller
  // revalidates the `/m` layout, since that re-read changed the shared lineup.
  | "PBM_UNCLEAR"
  | "SERVER"
>;

/**
 * Push the Insider Connected target of `titleId`'s entry (spec 4.3). The target
 * comes from stored intents (On wins across same-title cabinets), never from
 * the request, so a stale page cannot send the wrong value.
 *
 * The entry must be on the lineup and the title eligible; each is re-checked
 * here against stored state, and the member's linked account is required
 * (8.2).
 */
export async function pushEntryInsiderConnected(args: {
  userId: string;
  titleId: number;
}): Promise<PushEntryInsiderConnectedResult> {
  const { userId, titleId } = args;

  const state = await getPinballMapState();
  if (state?.locationId === null || state?.locationId === undefined)
    return err("SERVER", "Pinball Map isn't configured yet");
  const locationId = state.locationId;
  const lmx = state.snapshotJson
    ? findLmxForMachine(state.snapshotJson, titleId)
    : null;
  if (!lmx)
    return err(
      "VALIDATION",
      "This machine's entry is not on the location's lineup."
    );

  const catalogEntry = await getCatalogEntry(titleId);
  if (!catalogEntry?.icEligible)
    return err(
      "VALIDATION",
      "Pinball Map doesn't offer Insider Connected for this game."
    );

  const target = await entryIcTarget(titleId);
  if (target === null)
    return err(
      "VALIDATION",
      "No Insider Connected setting has been chosen for this game."
    );

  // --- non-transactional effects, both BEFORE the transaction ---
  const linked = await getLinkedPinballMapCredentials(userId);
  if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);

  const leased = await withPinballMapMutationLease(
    locationId,
    state.configurationGeneration,
    async (lease) =>
      ok(
        await pushInsiderConnected({
          credentials: linked.credentials,
          lease,
          locationId,
          lmxId: lmx.id,
          target,
        })
      )
  );
  if (!leased.ok) return leased;
  const outcome = leased.value;

  switch (outcome.kind) {
    case "applied":
      return ok({ icEnabled: target === "on" });
    case "rejected":
      return await rejectPush(userId, linked, outcome.failure);
    case "lease_lost":
      return err(
        "SERVER",
        "The tracked Pinball Map location changed while this change was running. Reload the page."
      );
    case "unclear": {
      const reRead = await reReadAfterUnclearIc(userId);
      return err(
        "PBM_UNCLEAR",
        reRead
          ? "Pinball Map didn't confirm the change. The setting shown is what it reports now."
          : "Pinball Map didn't confirm the change, and PinPoint couldn't re-read it. Refresh to see the current setting."
      );
    }
  }
}

export type ConfirmLocationLineupResult = Result<
  Record<string, never>,
  "NOT_LINKED" | "PBM_REJECTED" | "PBM_AUTH_FAILED" | "SERVER"
>;

/**
 * Tell Pinball Map the tracked location's whole lineup is accurate as of
 * `today` (spec 3.7). A venue-level statement: it adds, removes, and refreshes
 * nothing.
 *
 * On success the stored snapshot's last-updated date moves to `today`, the
 * site's current calendar day, so the header reflects the confirmation
 * before the next refresh reads Pinball Map's own value.
 */
export async function confirmLocationLineup(args: {
  userId: string;
  today: string;
}): Promise<ConfirmLocationLineupResult> {
  const { userId, today } = args;

  const state = await getPinballMapState();
  if (state?.locationId == null || !state.snapshotJson)
    return err("SERVER", "Pinball Map hasn't been refreshed yet.");
  const locationId = state.locationId;

  const linked = await getLinkedPinballMapCredentials(userId);
  if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);

  return withPinballMapMutationLease(
    locationId,
    state.configurationGeneration,
    async (lease) => {
      const client = await getPinballMapClient();
      const written = await client.confirmLineup({
        credentials: linked.credentials,
        locationId,
      });
      if (!written.ok) {
        log.error(
          { reason: written.reason, action: "pinballmap.confirmLineup" },
          "PinballMap lineup confirmation rejected"
        );
        // The shared message names an entry; this call is about the location.
        if (written.reason === "not_found")
          return err(
            "PBM_REJECTED",
            "Pinball Map couldn't find the tracked location."
          );
        return await rejectPush(userId, linked, written);
      }
      log.info(
        { userId, locationId, action: "pinballmap.confirmLineup" },
        "Confirmed the Pinball Map lineup"
      );

      await db.transaction(async (tx) => {
        if (!(await mutationLeaseOwnsLocation(tx, lease))) return;
        await editStoredSnapshot(tx, locationId, (snapshot) => ({
          ...snapshot,
          dateLastUpdated: today,
        }));
      });

      return ok({});
    }
  );
}
