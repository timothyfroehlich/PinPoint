/**
 * PinballMap linking — server actions for the create/edit catalog picker.
 *
 * Separated from the machine CRUD actions so the picker (a client component) can
 * import just the search/lookup actions. The catalog is non-sensitive mirrored
 * public PBM data; the actual link mutation is matrix-gated
 * (`machines.pinballmap.link`) inside the create/edit actions.
 *
 * The picker is two-step: pick a FAMILY (a PBM machine group, or a standalone
 * title), then — only when the family has multiple editions — pick the EDITION.
 */

"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db, type Tx } from "~/server/db";
import { machines, userProfiles, pinballmapState } from "~/server/db/schema";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import { getPinballMapWriteCredentials } from "~/lib/pinballmap/credentials";
import { withLmxAdded, withLmxRemoved } from "~/lib/pinballmap/snapshot-edit";
import { getPinballMapClient } from "~/lib/pinballmap/client";
import type { LocationSnapshot, PbmWriteFailure } from "~/lib/pinballmap/types";
import { log } from "~/lib/logger";
import {
  searchCatalogFamilies,
  listGroupEditions,
  getCatalogEntry,
  type CatalogEdition,
  type CatalogFamily,
} from "~/lib/pinballmap/catalog";
import {
  getPinballMapState,
  syncLocationSnapshot,
} from "~/lib/pinballmap/state";
import { PBM_MANUAL_SYNC_MIN_INTERVAL_MS } from "~/lib/pinballmap/config";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { pbmListingConflictMessage } from "~/lib/pinballmap/listing-conflict";
import { type Result, ok, err } from "~/lib/result";

export type { CatalogEdition, CatalogFamily } from "~/lib/pinballmap/catalog";

/** What the picker needs to preselect an existing link when editing a machine. */
export interface ResolvedPbmLink {
  family: CatalogFamily;
  /** The family's editions when it has more than one; empty otherwise. */
  editions: CatalogEdition[];
  /** The currently-linked edition's PBM machine id. */
  pinballmapMachineId: number;
}

/**
 * True when the caller may read the catalog. The catalog is non-sensitive
 * mirrored *public* PBM data, and the create/edit forms that host the picker are
 * already permission-gated above this seam, so authentication is the only gate
 * needed here — we deliberately skip a per-call role lookup. `getUser()` is kept
 * (CORE-SSR) to validate the session; the unauthenticated path quiet-degrades to
 * empty results / null rather than erroring.
 */
async function canReadCatalog(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

/** Search catalog families for the picker's first step. */
export async function searchPinballMapFamiliesAction(
  query: string
): Promise<CatalogFamily[]> {
  if (!(await canReadCatalog())) return [];
  return searchCatalogFamilies(query);
}

/** List a selected family's editions for the picker's second step. */
export async function listPinballMapEditionsAction(
  machineGroupId: number
): Promise<CatalogEdition[]> {
  if (!(await canReadCatalog())) return [];
  return listGroupEditions(machineGroupId);
}

/**
 * Resolve an already-linked machine id back to its family + editions so the edit
 * form can preselect the picker. Returns null for guests or an id no longer in
 * the mirror.
 */
export async function resolvePinballMapLinkAction(
  machineId: number
): Promise<ResolvedPbmLink | null> {
  if (!(await canReadCatalog())) return null;
  const entry = await getCatalogEntry(machineId);
  if (!entry) return null;

  // Standalone title: one edition, no second step.
  if (entry.machineGroupId === null) {
    return {
      family: {
        machineGroupId: null,
        pinballmapMachineId: entry.pinballmapMachineId,
        name: entry.name,
        manufacturer: entry.manufacturer,
        year: entry.year,
        editionCount: 1,
      },
      editions: [],
      pinballmapMachineId: entry.pinballmapMachineId,
    };
  }

  const editions = await listGroupEditions(entry.machineGroupId);
  const single = editions.length <= 1;
  return {
    family: {
      machineGroupId: entry.machineGroupId,
      pinballmapMachineId: single ? entry.pinballmapMachineId : null,
      name: entry.groupName ?? entry.name,
      manufacturer: entry.manufacturer,
      year: entry.year,
      editionCount: editions.length,
    },
    editions: single ? [] : editions,
    pinballmapMachineId: entry.pinballmapMachineId,
  };
}

/**
 * Shared preamble for every listing action: authenticate, load the target
 * machine, and confirm the caller holds `permission` on it. Returns the machine
 * row when permitted, or a failed Result to short-circuit the caller.
 *
 * The caller chooses the gate, because the two halves of the listing controls
 * are deliberately different capabilities: `machines.pinballmap.link` for the
 * read-side capture actions (link / verify — no PBM write, so owner-own-machine
 * / technician / admin), and `machines.pinballmap.push` for the outbound writes
 * that change what PinballMap shows the public.
 *
 * The machine must already carry a catalog link (`pinballmapMachineId`); a
 * listing handle presupposes a title (schema CHECK), and we resolve the lmx by
 * that title against the stored lineup.
 */
async function authorizeListingAction(
  formData: FormData,
  permission: "machines.pinballmap.link" | "machines.pinballmap.push"
): Promise<
  | { ok: true; userId: string; machine: typeof machines.$inferSelect }
  | { ok: false; result: ListingActionError }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, result: err("UNAUTHORIZED", "Sign in required") };

  const machineIdRaw = formData.get("machineId");
  const machineId = typeof machineIdRaw === "string" ? machineIdRaw : "";
  if (!machineId)
    return { ok: false, result: err("VALIDATION", "Missing machine") };

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
  });
  if (!machine)
    return { ok: false, result: err("NOT_FOUND", "Machine not found") };
  if (machine.pinballmapMachineId === null)
    return {
      ok: false,
      result: err(
        "VALIDATION",
        "Machine isn't linked to a PinballMap title yet"
      ),
    };

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);
  if (
    !checkPermission(permission, accessLevel, {
      userId: user.id,
      machineOwnerId: machine.ownerId,
    })
  )
    return { ok: false, result: err("UNAUTHORIZED", "Not allowed") };

  return { ok: true, userId: user.id, machine };
}

// Codes the shared preamble can emit; a subset of every listing action's union,
// so `return authed.result` typechecks in each caller.
type ListingActionError = Result<
  never,
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND"
>;

export type LinkPinballmapResult = Result<
  { lmxId: number },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "ABSENT" | "SERVER"
>;

/**
 * Capture the durable PinballMap listing handle (lmx) for a machine already on
 * PinballMap's public lineup — the "Link to this entry" action for APC's
 * already-listed fleet (state 2 → state 3). Read-only: it resolves the lmx from
 * the STORED location snapshot (PP-o355.16), never a per-render PBM call
 * (CORE-PBM-001); it syncs once only if we've never fetched a lineup. No PBM
 * *write* happens here — this is the anonymous, token-free half of the split.
 *
 * On success: stores `pinballmapLmxId` + flips `pinballmapListed` true, mirrors
 * a `linked` timeline event, and returns the captured lmx. ABSENT means the
 * title isn't on our location's lineup yet (nothing to link — list it instead).
 */
export async function linkPinballmapEntryAction(
  _prev: LinkPinballmapResult | undefined,
  formData: FormData
): Promise<LinkPinballmapResult> {
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.link"
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;
  // Narrowed by authorizeListingAction, but re-assert for the type checker.
  if (machine.pinballmapMachineId === null)
    return err("VALIDATION", "Machine isn't linked to a PinballMap title yet");

  // Idempotency guard: an already-listed + linked machine must not be re-linked.
  // A direct re-submit would rewrite the row and append a duplicate `linked`
  // timeline event; no-op back to the captured handle instead (state 3 is a
  // fixed point — nothing to capture that isn't already captured).
  if (machine.pinballmapListed && machine.pinballmapLmxId !== null)
    return ok({ lmxId: machine.pinballmapLmxId });

  // Read the freshest stored lineup; sync once if we've never captured one.
  let state = await getPinballMapState();
  if (!state?.snapshotJson) {
    await syncLocationSnapshot({ updatedBy: userId, trigger: "manual" });
    state = await getPinballMapState();
  }
  const snapshot = state?.snapshotJson;
  if (!snapshot) return err("SERVER", "Pinball Map lineup unavailable");

  const lmx = findLmxForMachine(snapshot, machine.pinballmapMachineId);
  if (!lmx)
    return err(
      "ABSENT",
      "This machine isn't on PinballMap's lineup for our location yet"
    );

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(machines)
        .set({ pinballmapLmxId: lmx.id, pinballmapListed: true })
        .where(eq(machines.id, machine.id));
      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: {
            kind: "pinballmap_listing",
            action: "linked",
            lmxId: lmx.id,
          },
          actorId: userId,
        },
        tx
      );
    });
  } catch (error) {
    // Partial-unique (one lister per title at our location): a duplicate cabinet
    // of this title is already the lister. VALIDATION, not SERVER — the user can
    // fix it by unlisting the other cabinet, and `SERVER` makes the UI treat a
    // correctable condition as a crash (PP-o355.15).
    //
    // The bare code is unambiguous here: this write touches only the listing
    // columns, so the listing index is the sole unique constraint it can
    // violate. This is the one action that reaches this collision in normal
    // use — create can't (it never lists), and the edit carry-over only rewrites
    // a value its own row already holds.
    if (isPgErrorCode(error, "23505")) {
      return err(
        "VALIDATION",
        await pbmListingConflictMessage(machine.pinballmapMachineId, machine.id)
      );
    }
    throw error;
  }

  revalidatePath(`/m/${machine.initials}`);
  return ok({ lmxId: lmx.id });
}

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
  /** No trustworthy evidence either way — do not claim an unlist happened. */
  | { kind: "refuse"; message: string };

async function classifyRemoveNotFound(args: {
  attemptedLmxId: number;
  pinballmapMachineId: number | null;
  snapshotSyncedAt: Date | null;
  userId: string;
}): Promise<NotFoundVerdict> {
  const { attemptedLmxId, pinballmapMachineId, snapshotSyncedAt, userId } =
    args;

  const isFresh = (syncedAt: Date | null): boolean =>
    syncedAt !== null &&
    Date.now() - syncedAt.getTime() < PBM_MANUAL_SYNC_MIN_INTERVAL_MS;

  if (!isFresh(snapshotSyncedAt)) {
    // Outcome is deliberately ignored: `throttled` means a concurrent refresh
    // just landed and `error` means PBM is unreachable, and the freshness check
    // below answers both correctly without re-deriving them here.
    await syncLocationSnapshot({ updatedBy: userId, trigger: "manual" });
  }

  const refreshed = await getPinballMapState();
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
      "Pinball Map still lists this machine but rejected the removal. Nothing was changed — an admin should check the listing on pinballmap.com.",
  };
}

/** Human-facing text for a PBM write failure, by reason. */
function pbmWriteFailureMessage(failure: PbmWriteFailure): string {
  switch (failure.reason) {
    case "rate_limited":
      return "Pinball Map is rate-limiting us. Try again in a few minutes.";
    case "unauthorized":
      return "Pinball Map rejected our operator account. An admin needs to re-provision it.";
    case "not_found":
      return "Pinball Map couldn't find that entry. It may already be gone.";
    case "rejected":
      return failure.message ?? "Pinball Map rejected the change.";
    case "transient":
      return "Pinball Map didn't respond properly. Try again.";
  }
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
async function editStoredSnapshot(
  tx: Tx,
  edit: (snapshot: LocationSnapshot) => LocationSnapshot
): Promise<void> {
  const [row] = await tx
    .select({ snapshotJson: pinballmapState.snapshotJson })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, "singleton"))
    .for("update");
  if (!row?.snapshotJson) return;
  await tx
    .update(pinballmapState)
    .set({ snapshotJson: edit(row.snapshotJson), updatedAt: new Date() })
    .where(eq(pinballmapState.id, "singleton"));
}

/**
 * The other cabinet of `pinballmapMachineId` that already holds this title's
 * listing, if any.
 *
 * Checked BEFORE the PBM write, not just via the 23505 backstop after it.
 * `addMachine` is find-or-create, so when the incumbent's listing is itself
 * desynced (`listed_locally_absent_on_pbm` — someone deleted the entry on
 * pinballmap.com) the POST genuinely CREATES a row on PBM's public lineup; the
 * local transaction then trips `machines_pinballmap_listed_unique` and rolls
 * everything back, orphaning a listing PinPoint has no handle for. Refusing up
 * front also avoids spending a PBM write on a request we already know we will
 * decline (CORE-PBM-001).
 */
async function findListingIncumbent(
  pinballmapMachineId: number,
  excludeMachineId: string
): Promise<{ id: string } | undefined> {
  return db.query.machines.findFirst({
    where: and(
      eq(machines.pinballmapMachineId, pinballmapMachineId),
      eq(machines.pinballmapListed, true),
      ne(machines.id, excludeMachineId)
    ),
    columns: { id: true },
  });
}

export type ListPinballmapResult = Result<
  { lmxId: number },
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_PROVISIONED"
  | "PBM_REJECTED"
  | "SERVER"
>;

/**
 * Add a matched machine to PinballMap's lineup for our location and capture the
 * lmx PBM mints (PP-o355.30). The genuine outbound write — distinct from
 * `linkPinballmapEntryAction`, which only captures a handle for an entry PBM
 * already shows.
 *
 * Gated on `machines.pinballmap.push` (CORE-ARCH-008).
 *
 * **Ordering is a hard requirement, not a style choice** (CORE-ARCH-011). Two
 * non-transactional effects run first — decrypting the operator credential and
 * the PBM HTTP call — and only their results enter the transaction. A tripwire
 * throws `SideEffectInTransactionError` if either is moved inside it.
 *
 * On a PBM rejection nothing is written locally: a listing we could not create
 * must not be reported as created (CORE-ARCH-012).
 */
export async function listMachineOnPinballMapAction(
  _prev: ListPinballmapResult | undefined,
  formData: FormData
): Promise<ListPinballmapResult> {
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.push"
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;
  const titleId = machine.pinballmapMachineId;
  if (titleId === null)
    return err("VALIDATION", "Machine isn't linked to a PinballMap title yet");

  // Idempotent: a machine already holding a listing has nothing to add.
  if (machine.pinballmapListed && machine.pinballmapLmxId !== null)
    return ok({ lmxId: machine.pinballmapLmxId });

  const state = await getPinballMapState();
  if (!state) return err("SERVER", "Pinball Map isn't configured yet");

  // One lister per title. Refuse BEFORE the PBM write — see
  // `findListingIncumbent` for why the 23505 backstop alone is not enough here.
  if (await findListingIncumbent(titleId, machine.id))
    return err(
      "VALIDATION",
      await pbmListingConflictMessage(titleId, machine.id)
    );

  // --- non-transactional effects, both BEFORE the transaction ---
  const credentials = await getPinballMapWriteCredentials();
  if (!credentials)
    return err(
      "NOT_PROVISIONED",
      "No Pinball Map operator account is set up yet, so PinPoint can't write to Pinball Map."
    );

  const client = await getPinballMapClient();
  const written = await client.addMachine({
    credentials,
    locationId: state.locationId,
    machineId: titleId,
  });
  if (!written.ok) {
    log.error(
      { reason: written.reason, action: "pinballmap.addMachine" },
      "PinballMap add rejected"
    );
    return err("PBM_REJECTED", pbmWriteFailureMessage(written));
  }
  const lmxId = written.lmxId;
  // --- transaction: local state only ---

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(machines)
        .set({ pinballmapLmxId: lmxId, pinballmapListed: true })
        .where(eq(machines.id, machine.id));
      await editStoredSnapshot(tx, (snapshot) =>
        withLmxAdded(snapshot, lmxId, titleId)
      );
      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: { kind: "pinballmap_listing", action: "listed", lmxId },
          actorId: userId,
        },
        tx
      );
    });
  } catch (error) {
    // One lister per title at our location. PBM's find-or-create already handed
    // us the shared lmx, so the honest report is that another cabinet holds it.
    if (isPgErrorCode(error, "23505")) {
      return err(
        "VALIDATION",
        await pbmListingConflictMessage(titleId, machine.id)
      );
    }
    throw error;
  }

  revalidatePath(`/m/${machine.initials}`);
  // The stored snapshot changed, and every machine's desync badge derives from
  // it — a sibling cabinet of this title reads differently now (same reason
  // `syncPinballMapNowAction` refreshes the whole subtree).
  revalidatePath("/m", "layout");
  return ok({ lmxId });
}

export type UnlistPinballmapResult = Result<
  Record<string, never>,
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_PROVISIONED"
  | "PBM_REJECTED"
  | "SERVER"
>;

/**
 * Remove a machine from PinballMap's lineup for our location and clear our
 * listing columns (PP-o355.30).
 *
 * Gated on `machines.pinballmap.push` (CORE-ARCH-008). Same ordering rule as
 * the list action: credential decrypt and PBM call before the transaction
 * (CORE-ARCH-011).
 *
 * **The stored-snapshot edit is not bookkeeping — it is the correctness of this
 * action.** Auto-link (PP-o355.20) re-lists any matched, unlisted cabinet whose
 * title appears on the stored lineup. Clearing our columns while leaving the
 * lmx in the snapshot means the next reconcile pass, or any save on this machine
 * inside the hour, silently re-lists it. Dropping the row we just deleted is
 * what makes an unlist stick.
 *
 * **Which lmx we delete is also correctness**, for the same reason. PBM re-mints
 * a title's row after a delete + re-add, so the id we stored can be dead while
 * the title is still on the lineup. Deleting the dead id removes nothing, and
 * auto-link puts the cabinet straight back. Two things guard that (PP-rnup):
 * the id is resolved from the stored lineup by title rather than taken from the
 * machine row, and a `not_found` reply is checked against a freshly re-fetched
 * lineup instead of being read as "already gone" — see `classifyRemoveNotFound`.
 */
export async function unlistMachineFromPinballMapAction(
  _prev: UnlistPinballmapResult | undefined,
  formData: FormData
): Promise<UnlistPinballmapResult> {
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.push"
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;

  const storedLmxId = machine.pinballmapLmxId;
  if (!machine.pinballmapListed || storedLmxId === null)
    return err("VALIDATION", "This machine isn't listed on Pinball Map.");

  const state = await getPinballMapState();
  if (!state) return err("SERVER", "Pinball Map isn't configured yet");

  // Delete the lmx the lineup ACTUALLY carries, not the handle we happen to
  // store. When PBM re-mints a row (delete + re-add outside its 7-day
  // resurrection window) our stored id goes stale — the `lmx_drifted` state
  // auto-link heals as `reconnected`. Unlisting on the stale id deletes nothing:
  // PBM answers `not_found`, we clear the local flag, and the title is still on
  // the public lineup, so the next auto-link pass re-lists the machine. The
  // human's unlist silently un-happens and the cabinet never left PinballMap.
  // Resolving through the snapshot by title is the same lookup auto-link uses,
  // so the two agree on which row is live.
  //
  // This narrows the window; it does not close it, because the snapshot can be
  // an hour stale and carry the same dead id as the machine row. `not_found` is
  // where that residue is caught — see `classifyRemoveNotFound`.
  const liveLmxId =
    (machine.pinballmapMachineId !== null && state.snapshotJson
      ? findLmxForMachine(state.snapshotJson, machine.pinballmapMachineId)?.id
      : undefined) ?? storedLmxId;

  // --- non-transactional effects, both BEFORE the transaction ---
  const credentials = await getPinballMapWriteCredentials();
  if (!credentials)
    return err(
      "NOT_PROVISIONED",
      "No Pinball Map operator account is set up yet, so PinPoint can't write to Pinball Map."
    );

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
    return err("PBM_REJECTED", pbmWriteFailureMessage(written));
  }

  // `not_found` is ambiguous — already gone, or our handle was stale and the
  // title is still listed under a re-minted id. `classifyRemoveNotFound` asks
  // the live lineup which one it is; taking the already-gone reading on faith
  // is what silently un-does a human unlist (PP-rnup).
  if (!written.ok) {
    const verdict = await classifyRemoveNotFound({
      attemptedLmxId: deletedLmxId,
      pinballmapMachineId: machine.pinballmapMachineId,
      snapshotSyncedAt: state.lastSyncedAt,
      userId,
    });

    if (verdict.kind === "refuse") {
      log.warn(
        {
          lmxId: deletedLmxId,
          machineId: machine.id,
          action: "pinballmap.removeMachine",
        },
        "PinballMap returned not_found and the live lineup could not confirm removal — refusing to clear"
      );
      return err("PBM_REJECTED", verdict.message);
    }

    if (verdict.kind === "retry") {
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
        return err("PBM_REJECTED", pbmWriteFailureMessage(written));
      }
    } else {
      // Confirmed absent from a lineup we just re-fetched. Finish the job
      // rather than refuse: the desired end state (not on PBM, not listed
      // locally) is already half-reached, and refusing would strand the
      // machine — every retry hits the same 404 and
      // `verifyPinballmapLinkAction` reports `stale` without clearing. Not
      // honesty-washing (CORE-ARCH-012): we now have positive evidence of the
      // state we are about to report, we just didn't have to do the deleting.
      log.info(
        {
          lmxId: deletedLmxId,
          machineId: machine.id,
          action: "pinballmap.removeMachine",
        },
        "PinballMap lmx confirmed absent from the live lineup — clearing the local listing"
      );
    }
  }
  // --- transaction: local state only ---

  // No 23505 catch: this write only CLEARS `pinballmapListed`, and a row
  // leaving the partial unique index cannot violate it.
  await db.transaction(async (tx) => {
    await tx
      .update(machines)
      .set({ pinballmapListed: false, pinballmapLmxId: null })
      .where(eq(machines.id, machine.id));
    await editStoredSnapshot(tx, (snapshot) =>
      withLmxRemoved(snapshot, deletedLmxId, machine.pinballmapMachineId)
    );
    await createMachineTimelineEvent(
      machine.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        // The lmx we actually deleted, which is the stored one except after a
        // re-mint. Recording the stale handle would make the timeline disagree
        // with what PinballMap saw.
        eventData: {
          kind: "pinballmap_listing",
          action: "unlisted",
          lmxId: deletedLmxId,
        },
        actorId: userId,
      },
      tx
    );
  });

  revalidatePath(`/m/${machine.initials}`);
  // See the list action: the shared snapshot changed, so sibling cabinets'
  // desync badges did too.
  revalidatePath("/m", "layout");
  return ok({});
}

export type VerifyPinballmapResult = Result<
  { state: "ok" | "stale" | "healed" },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER" | "THROTTLED"
>;

/**
 * On-demand "Verify" — re-check a machine's stored PinballMap link against a
 * FRESH lineup (this is the explicit "check now" affordance, so it always forces
 * a sync). Read-only, `machines.pinballmap.link`.
 *
 *  - stored lmx still present  → `ok`      (nothing to do)
 *  - title resolves to a NEW id → `healed`  (update the stored handle + timeline)
 *  - title absent from lineup   → `stale`   (leave the stored id; UI shows Reconnect)
 *
 * Crucially, a fresh sync is a PRECONDITION for any of those verdicts: "Verify"
 * promises the answer reflects PinballMap's CURRENT lineup. If the refresh can't
 * complete — the fetch errored, or the manual-refresh throttle (PP-hbi0) refused
 * it — we must NOT resolve against the possibly-stale STORED snapshot and claim
 * it's current (that silent stale-verify was the original bug). Instead we
 * surface the sync outcome (`SERVER` / `THROTTLED`) and leave the stored link
 * untouched.
 *
 * Continuous background desync detection stays in the hourly snapshot (PP-o355.11);
 * this is the user-triggered spot-check, so a single sync per click is within
 * conduct (CORE-PBM-001).
 */
export async function verifyPinballmapLinkAction(
  _prev: VerifyPinballmapResult | undefined,
  formData: FormData
): Promise<VerifyPinballmapResult> {
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.link"
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;
  if (machine.pinballmapMachineId === null)
    return err("VALIDATION", "Machine isn't linked to a PinballMap title yet");

  // Verify re-checks a listing we HOLD, and an unlisted cabinet holds none.
  // Without this guard, verifying one would silently LIST it: the schema CHECK
  // `machines_pinballmap_lmx_requires_listed` forces an unlisted row's
  // `pinballmapLmxId` to null, so the `lmx.id === machine.pinballmapLmxId`
  // comparison below can never match and every such verify falls into the heal
  // branch — which sets `pinballmapListed: true`. Listing is never a side effect
  // of a spot-check. Note this guard is NOT redundant with auto-link
  // (PP-o355.20): auto-link consults the tie guard before listing anything,
  // whereas this branch would list unconditionally, so removing the guard would
  // reintroduce exactly the duplicate-listing path auto-link is careful to
  // avoid. Refuse before the sync so a request we will not honour never spends a
  // manual-refresh slot (CORE-PBM-001).
  if (!machine.pinballmapListed)
    return err(
      "VALIDATION",
      "This machine isn't listed on Pinball Map, so there's no listing to re-check."
    );

  // Verify means "check right now" — force a fresh sync before resolving. Bail
  // out (rather than resolve against a stale snapshot) if the sync didn't land.
  const sync = await syncLocationSnapshot({
    updatedBy: userId,
    trigger: "manual",
  });
  if (!sync.ok) {
    if (sync.reason === "throttled")
      return err(
        "THROTTLED",
        "Pinball Map was refreshed moments ago. Wait a minute, then re-check this link."
      );
    return err(
      "SERVER",
      "Couldn't reach Pinball Map to re-check this link. Its listing status may be out of date — try again shortly."
    );
  }

  const snapshot = (await getPinballMapState())?.snapshotJson;
  if (!snapshot) return err("SERVER", "Pinball Map lineup unavailable");

  const lmx = findLmxForMachine(snapshot, machine.pinballmapMachineId);
  if (!lmx) return ok({ state: "stale" });
  if (lmx.id === machine.pinballmapLmxId) return ok({ state: "ok" });

  // Title now maps to a different lmx (PBM re-minted it) — heal the stored handle.
  //
  // This writes `pinballmapListed`, so the one-lister partial unique index
  // applies and a violation would escape as a 500 the way it did on the
  // create/update paths (PP-o355.15). The not-listed guard above closes the
  // concrete duplicate-cabinet path — reaching here means this machine is
  // already the sole listed row for its title, so it can only collide with a
  // concurrent write. Kept as a genuine backstop, not a load-bearing catch.
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(machines)
        .set({ pinballmapLmxId: lmx.id, pinballmapListed: true })
        .where(eq(machines.id, machine.id));
      await createMachineTimelineEvent(
        machine.id,
        {
          sourceType: "lifecycle",
          tag: "lifecycle",
          eventData: {
            kind: "pinballmap_listing",
            action: "reconnected",
            lmxId: lmx.id,
          },
          actorId: userId,
        },
        tx
      );
    });
  } catch (error: unknown) {
    // Bare code for the same reason as the link path above — this transaction
    // writes only listing columns, so any 23505 here is the one-lister index.
    // Exclude self from the incumbent lookup: this machine IS the listed row
    // for its title (the guard above guarantees it), so an unfiltered lookup
    // would name it and tell the operator to unlist what they're verifying.
    if (isPgErrorCode(error, "23505")) {
      return err(
        "VALIDATION",
        await pbmListingConflictMessage(machine.pinballmapMachineId, machine.id)
      );
    }
    throw error;
  }

  revalidatePath(`/m/${machine.initials}`);
  return ok({ state: "healed" });
}

/** Result of an on-demand "Sync now" — the machine count and writes applied. */
export type SyncPinballMapNowResult = Result<
  {
    machineCount: number;
    healed: number;
    linked: number;
    abandonmentsCleared: number;
  },
  "UNAUTHORIZED" | "SERVER" | "THROTTLED"
>;

/**
 * Manually refresh the stored PinballMap snapshot ("Sync now"), then reconcile
 * stored lmx drift. Technician+ (`machines.pinballmap.sync`, CORE-ARCH-008).
 *
 * Unlike the hourly cron, this does NOT gate on `state.enabled`: it's an
 * explicit human-initiated refresh, so the human is the caller who owns the
 * decision. Rate-limiting is NOT left to "a click is naturally slow" — it's
 * enforced at the `syncLocationSnapshot` seam (`trigger: "manual"`, PP-hbi0),
 * which refuses repeat refreshes inside `PBM_MANUAL_SYNC_MIN_INTERVAL_MS` and
 * surfaces `THROTTLED` here (CORE-PBM-001). Form-action shaped
 * `(prevState, formData)` so a `<form action={...}>` + `useActionState` button
 * (control room, PP-o355.7) can drop it in directly (CORE-ARCH-005/007).
 */
export async function syncPinballMapNowAction(
  _prevState: SyncPinballMapNowResult | undefined,
  _formData: FormData
): Promise<SyncPinballMapNowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Unauthorized. Please log in.");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (!profile) return err("UNAUTHORIZED", "User profile not found.");

  const accessLevel = getAccessLevel(profile.role);
  if (!checkPermission("machines.pinballmap.sync", accessLevel)) {
    return err(
      "UNAUTHORIZED",
      "Only technicians and admins can trigger a Pinball Map sync."
    );
  }

  try {
    const result = await syncLocationSnapshot({
      updatedBy: user.id,
      trigger: "manual",
    });
    if (!result.ok) {
      if (result.reason === "throttled") {
        return err(
          "THROTTLED",
          "Pinball Map was just refreshed. Please wait a moment before syncing again."
        );
      }
      return err("SERVER", result.error);
    }

    const { healed, linked, abandonmentsCleared } = await reconcileAfterSync();
    // Desync badges on machine Info cards derive from the stored snapshot, so
    // refresh the whole machine subtree after a successful sync.
    revalidatePath("/m", "layout");
    return ok({
      machineCount: result.machineCount,
      healed,
      linked,
      abandonmentsCleared,
    });
  } catch (error: unknown) {
    log.error({ err: error }, "Manual PinballMap sync failed");
    return err("SERVER", "Pinball Map sync failed. Please try again.");
  }
}
