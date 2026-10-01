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

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db, type Tx } from "~/server/db";
import {
  machines,
  pinballmapAbandonedListings,
  pinballmapState,
  userProfiles,
} from "~/server/db/schema";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import { importPinballMapCommentsAfterCoverageChange } from "~/lib/pinballmap/comment-import";
import {
  listSurfacingAbandonedForMachine,
  recordAbandonedListing,
  retireAbandonmentForLmx,
} from "~/lib/pinballmap/abandoned-listings";
import {
  getLinkedPinballMapCredentials,
  getPinballMapLinkStatus,
  markPinballMapLinkNeedsRelink,
  type LinkedPinballMapCredentials,
} from "~/lib/pinballmap/user-credentials";
import {
  withLmxAdded,
  withLmxIcEnabled,
  withLmxRemoved,
} from "~/lib/pinballmap/snapshot-edit";
import { getPinballMapClient } from "~/lib/pinballmap/client";
import type {
  LocationSnapshot,
  PbmCredentials,
  PbmLmx,
  PbmWriteFailure,
} from "~/lib/pinballmap/types";
import { log } from "~/lib/logger";
import {
  searchCatalogFamilies,
  listGroupEditions,
  getCatalogEntry,
  type CatalogEdition,
  type CatalogFamily,
} from "~/lib/pinballmap/catalog";
import {
  claimPinballMapMutationLease,
  getPinballMapState,
  releasePinballMapMutationLease,
  syncLocationSnapshot,
  type PinballMapMutationLease,
} from "~/lib/pinballmap/state";
import { PBM_REFRESH_REFILL_MS } from "~/lib/pinballmap/config";
import { getMachinePresenceLabel } from "~/lib/machines/presence";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import {
  insiderConnectedTarget,
  type PbmIcIntent,
} from "~/lib/pinballmap/insider-connected";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import {
  INVALID_WHEN_ON,
  type PbmListingIntent,
} from "~/lib/pinballmap/listing-state";
import { type Result, ok, err } from "~/lib/result";
import type { PinballmapRuntimeState } from "~/lib/types";
import { setMachineIcIntent, updateMachinePbmLink } from "~/services/machines";
import { loadLineupData } from "~/lib/pinballmap/lineup-data";

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
 * Whether Pinball Map's catalog marks a title Insider Connected eligible — the
 * New Machine page shows the switch only for one that is (pinballmap 3.8,
 * 4.11). Public catalog data, so the same read gate as the picker; false for a
 * guest or an id no longer in the mirror.
 */
export async function getPinballMapTitleIcEligibleAction(
  pinballmapMachineId: number
): Promise<boolean> {
  if (!(await canReadCatalog())) return false;
  const entry = await getCatalogEntry(pinballmapMachineId);
  return entry?.icEligible ?? false;
}

/**
 * Shared preamble for every listing action: authenticate, load the target
 * machine, and confirm the caller holds `permission` on it. Returns the machine
 * row when permitted, or a failed Result to short-circuit the caller.
 *
 * The caller chooses the gate, because the two halves of the control are
 * deliberately different capabilities: `machines.pinballmap.link` for setting
 * intent, which writes only to PinPoint, and `machines.pinballmap.push` for the
 * outbound writes that change what Pinball Map shows the public. Both resolve to
 * the same tier today (spec 8.1/8.2) — they are kept separate because the
 * credential requirement is not the same, and because a future tightening of one
 * should not silently move the other.
 *
 * `requireLink` defaults to true: everything that touches the lineup resolves
 * its entry by catalog title against the stored snapshot, so a machine with no
 * title has nothing to act on. Setting intent Off or Don't sync is the exception
 * and passes false.
 */
async function authorizeListingAction(
  formData: FormData,
  permission: "machines.pinballmap.link" | "machines.pinballmap.push",
  opts?: { requireLink?: boolean }
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
  if ((opts?.requireLink ?? true) && machine.pinballmapMachineId === null)
    return {
      ok: false,
      result: err(
        "VALIDATION",
        "Machine isn't linked to a Pinball Map title yet"
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

export type SetPinballmapIntentResult = Result<
  { intent: PbmListingIntent },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "BLOCKED"
>;

/** Availability that forbids intent On (spec 6.2). Re-exports `INVALID_WHEN_ON`. */
const INTENT_ON_BLOCKED_BY = INVALID_WHEN_ON;

/**
 * Set a machine's listing intent — the tri-state toggle (spec 4.1, 8.1).
 *
 * Local only: nothing is sent to Pinball Map, so this needs no operator
 * credential and no confirmation, and it is instantly reversible. Whether the
 * lineup then agrees is a separate observation the control renders beside it,
 * and a separate push to resolve (4.3).
 *
 * Refuses On while availability is pending arrival or removed (6.2). The control
 * already disables that position, so reaching here means a stale page or a
 * direct call; refusing beats writing a row the DB would have to allow and the
 * UI would then have to explain.
 *
 * The reverse direction is deliberately NOT guarded: changing availability on an
 * intent-On machine is allowed and renders the Alert state (6.2). Availability
 * never rewrites intent, and intent never rewrites availability (6.1).
 */
export async function setPinballmapIntentAction(
  _prev: SetPinballmapIntentResult | undefined,
  formData: FormData
): Promise<SetPinballmapIntentResult> {
  const raw = formData.get("intent");
  const intent =
    raw === "on" || raw === "off" || raw === "no_sync" ? raw : null;
  if (intent === null) return err("VALIDATION", "Unknown lineup setting");

  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.link",
    // Off and Don't sync are meaningful without a catalog title — they both say
    // "this cabinet is not going on the lineup". Only On presupposes one.
    { requireLink: intent === "on" }
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;

  if (machine.pinballmapIntent === intent) return ok({ intent });

  if (
    intent === "on" &&
    INTENT_ON_BLOCKED_BY.includes(machine.presenceStatus)
  ) {
    // Same wording as the note beside the disabled toggle
    // (`derivePbmListingView`'s `blockedReason`) — this is the backstop for a
    // request that got past that toggle, so a reader who somehow sees both
    // should not have to reconcile two descriptions of one rule.
    return err(
      "BLOCKED",
      `Blocked by Availability: ${getMachinePresenceLabel(machine.presenceStatus)}`
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(machines)
      .set({ pinballmapIntent: intent })
      .where(eq(machines.id, machine.id));
    await createMachineTimelineEvent(
      machine.id,
      {
        sourceType: "lifecycle",
        tag: "lifecycle",
        eventData: { kind: "pinballmap_intent", intent },
        actorId: userId,
      },
      tx
    );
  });

  // Turning On makes this cabinet a covering one, owed its entry's comments
  // (spec 7.1). Copies already imported stay when it turns Off.
  if (intent === "on") await importPinballMapCommentsAfterCoverageChange();

  revalidatePath(`/m/${machine.initials}`);
  // Coverage is a property of the whole same-title group, so a sibling's page
  // reads differently now — it may have just gained or lost its cover (4.7).
  revalidatePath("/m", "layout");
  return ok({ intent });
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

/** Returned when the pushing member has no usable Pinball Map link (8.2). */
const NOT_LINKED_MESSAGE =
  "Link your Pinball Map account in Settings to change the lineup from here.";

/**
 * Turn a rejected push into the action's error. When Pinball Map refused the
 * token itself, the member's link is marked failed (spec 8.5) — that rejection
 * is the only time PinPoint learns a token is dead; it never polls — and the
 * error carries its own code, because the machine page then shows a standing
 * "authentication failed" note and a second, transient copy would repeat it.
 */
async function pushRejected(
  userId: string,
  linked: LinkedPinballMapCredentials,
  failure: PbmWriteFailure
): Promise<Result<never, "PBM_REJECTED" | "PBM_AUTH_FAILED">> {
  if (failure.reason === "unauthorized") {
    await markPinballMapLinkNeedsRelink(userId, linked.tokenVaultId);
    revalidatePath("/settings");
    // The link status decides the push buttons on every machine page and the
    // lineup page, as on link/unlink. The machine page's control also hides
    // the transient error for this code and relies on re-rendering into its
    // standing note.
    revalidatePath("/m", "layout");
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
async function editStoredSnapshot(
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
    .where(eq(pinballmapState.id, "singleton"))
    .for("update");
  if (row?.locationId !== expectedLocationId || !row.snapshotJson) return;
  await tx
    .update(pinballmapState)
    .set({
      snapshotJson: edit(row.snapshotJson),
      snapshotRevision: sql`${pinballmapState.snapshotRevision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(pinballmapState.id, "singleton"));
}

async function mutationLeaseOwnsLocation(
  tx: Tx,
  lease: PinballMapMutationLease
): Promise<boolean> {
  const [row] = await tx
    .select({
      locationId: pinballmapState.locationId,
      configurationGeneration: pinballmapState.configurationGeneration,
      mutationLeaseId: pinballmapState.mutationLeaseId,
    })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, "singleton"))
    .for("update");
  return (
    row !== undefined &&
    row.locationId === lease.trackedLocationId &&
    row.configurationGeneration === lease.configurationGeneration &&
    row.mutationLeaseId === lease.id
  );
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
    .where(eq(pinballmapState.id, "singleton"))
    .for("update");
  return (
    row?.locationId === locationId &&
    row.configurationGeneration === configurationGeneration
  );
}

export type ListPinballmapResult = Result<
  { lmxId: number },
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  // Availability forbids being on the lineup (6.2) — the same refusal the
  // intent toggle gives, on the push that would otherwise get there anyway.
  | "BLOCKED"
  | "NOT_LINKED"
  | "PBM_REJECTED"
  | "PBM_AUTH_FAILED"
  | "SERVER"
>;

/**
 * Add a machine's title to the location's Pinball Map lineup (spec 4.3), and
 * record the entry PBM mints or hands back.
 *
 * Offered only from the Missing state — intent is already On and the lineup does
 * not agree — so this action does NOT touch intent. That separation is the point
 * of the two-line control: the toggle says what should be true, the push makes
 * Pinball Map match, and neither silently performs the other.
 *
 * Gated on `machines.pinballmap.push` plus the member's linked Pinball Map
 * account (spec 8.2, CORE-ARCH-008).
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
export async function addMachineToPinballMapAction(
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
    return err("VALIDATION", "Machine isn't linked to a Pinball Map title yet");

  // The same availability rule the intent toggle enforces (6.2). Setting intent
  // On and pushing the entry are two steps, and only the first was guarded — so
  // a cabinet set On while it was on the floor and later marked Removed derives
  // as Missing (intent On, entry absent, checked before the advisory branch) and
  // offers Add. One click would publish an absent machine to the public lineup,
  // over copy that says Pinball Map only lists games that are present.
  if (INTENT_ON_BLOCKED_BY.includes(machine.presenceStatus))
    return err(
      "BLOCKED",
      `Blocked by Availability: ${getMachinePresenceLabel(machine.presenceStatus)}`
    );

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
    revalidatePath(`/m/${machine.initials}`);
    return ok({ lmxId: existing.id });
  }

  // --- non-transactional effects, both BEFORE the transaction ---
  const linked = await getLinkedPinballMapCredentials(userId);
  if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);

  const lease = await claimPinballMapMutationLease(
    locationId,
    configurationGeneration
  );
  if (!lease)
    return err(
      "SERVER",
      "The tracked Pinball Map location is being changed. Reload the page and try again."
    );

  let icUnclear = false;
  let addedLmxId: number;
  try {
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
      return await pushRejected(userId, linked, written);
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
        machine.id,
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
          machine.id,
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

    revalidatePath(`/m/${machine.initials}`);
    // The stored lineup changed, and every same-title cabinet's state derives
    // from it — a sibling reads differently now.
    revalidatePath("/m", "layout");
    addedLmxId = lmxId;
  } finally {
    await releasePinballMapMutationLease(lease.id);
  }

  // Outside the lease: the re-read claims its own place at the sync chokepoint.
  if (icUnclear) await reReadAfterUnclearIc(userId);
  return ok({ lmxId: addedLmxId });
}

export type UnlistPinballmapResult = Result<
  Record<string, never>,
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_LINKED"
  | "PBM_REJECTED"
  | "PBM_AUTH_FAILED"
  | "SERVER"
>;

/**
 * Take a machine's title off the location's Pinball Map lineup (spec 4.3).
 *
 * Offered from Lingering — intent is Off and the lineup still shows the entry —
 * and from the abandoned-entry alert, where the cabinet has retitled away
 * entirely. It does NOT touch intent, for the same reason the add action does
 * not: the toggle is the operator's statement, this is the push that makes
 * Pinball Map agree.
 *
 * **Removal does not require the entry to be covered** (4.3). An entry nobody
 * wants is exactly the one worth taking down, and requiring coverage first would
 * mean turning a cabinet On to remove it.
 *
 * Gated on `machines.pinballmap.push` plus credentials (spec 8.2). Same ordering
 * rule as the add action: credential decrypt and PBM call before the transaction
 * (CORE-ARCH-011).
 *
 * **The stored-snapshot edit is not bookkeeping — it is the correctness of this
 * action.** Every control renders from the stored lineup, so leaving the deleted
 * entry in it repaints the page as still Lingering and offers Remove again on an
 * entry that is already gone (CORE-ARCH-012).
 *
 * **Which lmx we delete is also correctness.** PBM re-mints a title's row after
 * a delete plus a re-add outside their 7-day window, so a stale id deletes
 * nothing while the title stays on the public lineup. Two things guard that
 * (PP-rnup): the id is resolved from the stored lineup by title, and a
 * `not_found` reply is checked against a freshly re-fetched lineup rather than
 * read as "already gone" — see `classifyRemoveNotFound`.
 */
export async function removeMachineFromPinballMapAction(
  _prev: UnlistPinballmapResult | undefined,
  formData: FormData
): Promise<UnlistPinballmapResult> {
  // An explicit lmx wins: the abandoned-entry alert names an entry whose title
  // this cabinet no longer carries, so resolving by the machine's CURRENT title
  // would find the wrong row or none at all.
  const explicitLmxRaw = formData.get("lmxId");
  const explicitLmxId =
    typeof explicitLmxRaw === "string" && /^\d+$/.test(explicitLmxRaw)
      ? Number(explicitLmxRaw)
      : null;

  // A machine can reach the abandoned-entry path with no link at all — clearing
  // the title or marking the cabinet uncataloged is one of the ways an entry
  // gets abandoned in the first place — so the link requirement, which exists
  // because title resolution needs a title, does not apply when the caller
  // brought the entry's own id.
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.push",
    explicitLmxId !== null ? { requireLink: false } : undefined
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;

  const state = await getPinballMapState();
  if (state?.locationId === null || state?.locationId === undefined)
    return err("SERVER", "Pinball Map isn't configured yet");

  // The scope check and PBM delete are one configuration-sensitive operation.
  // Claim before evaluating the orphan predicate so a switch cannot turn an
  // old-location orphan into current-location sibling business halfway through
  // the removal (spec 2.5, 10.9, 10.12).
  const lease = await claimPinballMapMutationLease(
    state.locationId,
    state.configurationGeneration
  );
  if (!lease)
    return err(
      "SERVER",
      "The tracked Pinball Map location is being changed. Reload the page and try again."
    );

  try {
    // The submitted id is attacker-controlled, and the member's linked Pinball
    // Map account it would act through can edit the WHOLE location's lineup
    // (Pinball Map is publicly editable). Push is `member: "owner"`,
    // so without this an owner of any one cabinet could post any lmx on the
    // lineup and delete a game they have nothing to do with. The abandonment
    // records are the allowlist: an entry is this machine's business only if this
    // machine is the one that walked away from it.
    //
    // The record also carries the title the entry was listed under, which is the
    // context the rest of this action needs — `machine.pinballmapMachineId` is
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
            await listSurfacingAbandonedForMachine(machine.id, state.locationId)
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
    const removalLocationId = abandonedRecord?.locationId ?? state.locationId;
    const isCrossLocation =
      abandonedRecord !== null &&
      abandonedRecord.locationId !== state.locationId;

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
      return await pushRejected(userId, linked, written);
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
          return await pushRejected(userId, linked, written);
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
      // `classifyRemoveNotFound` refresh. That is the failure this action's
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

    revalidatePath(`/m/${machine.initials}`);
    // See the add action: the shared lineup changed, so sibling cabinets read
    // differently now.
    revalidatePath("/m", "layout");
    return ok({});
  } finally {
    await releasePinballMapMutationLease(lease.id);
  }
}

/**
 * Shared preamble for acting on an entry no PinPoint machine is linked to
 * (lineup spec §5.4): authenticate, find the entry on the stored lineup, confirm
 * nothing is linked to its title, and check the push gate (pinballmap §8.2).
 *
 * Push is owner-scoped for members, and an unlinked entry has no machine to own.
 * So the gate is the capability without ownership (technician or admin), or
 * ownership of a machine that walked away from this exact entry — the same
 * allowlist the machine page's removal uses (pinballmap §2.5). A linked entry is
 * refused: it is its title's business, removed from its cabinets' pages.
 */
async function authorizeUnlinkedEntryAction(formData: FormData): Promise<
  | {
      ok: true;
      userId: string;
      state: PinballmapRuntimeState & { locationId: number };
      lmx: PbmLmx;
    }
  | {
      ok: false;
      result: Result<
        never,
        "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
      >;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, result: err("UNAUTHORIZED", "Sign in required") };

  const lmxRaw = formData.get("lmxId");
  if (typeof lmxRaw !== "string" || !/^\d+$/.test(lmxRaw))
    return { ok: false, result: err("VALIDATION", "Missing entry") };
  const lmxId = Number(lmxRaw);

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);

  const state = await getPinballMapState();
  if (state?.locationId == null)
    return {
      ok: false,
      result: err("SERVER", "Pinball Map isn't configured yet"),
    };
  const locationId = state.locationId;

  const lmx = state.snapshotJson?.lmxes.find((entry) => entry.id === lmxId);
  if (lmx === undefined)
    return {
      ok: false,
      result: err("NOT_FOUND", "That entry is no longer on the lineup."),
    };

  const linked = await db.query.machines.findFirst({
    where: eq(machines.pinballmapMachineId, lmx.machineId),
    columns: { id: true },
  });
  if (linked)
    return {
      ok: false,
      result: err(
        "VALIDATION",
        "A PinPoint machine is linked to this entry now. Reload the page."
      ),
    };

  let allowed = checkPermission("machines.pinballmap.push", accessLevel);
  if (!allowed) {
    const walkedAway = await db
      .select({ ownerId: machines.ownerId })
      .from(pinballmapAbandonedListings)
      .innerJoin(
        machines,
        eq(machines.id, pinballmapAbandonedListings.machineId)
      )
      .where(
        and(
          eq(pinballmapAbandonedListings.lmxId, lmxId),
          eq(pinballmapAbandonedListings.locationId, locationId)
        )
      );
    allowed = walkedAway.some((row) =>
      checkPermission("machines.pinballmap.push", accessLevel, {
        userId: user.id,
        machineOwnerId: row.ownerId,
      })
    );
  }
  if (!allowed)
    return { ok: false, result: err("UNAUTHORIZED", "Not allowed") };

  return { ok: true, userId: user.id, state: { ...state, locationId }, lmx };
}

export type RemoveUnlinkedEntryResult = Result<
  Record<string, never>,
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_LINKED"
  | "PBM_REJECTED"
  | "PBM_AUTH_FAILED"
  | "SERVER"
>;

/**
 * **Remove from Pinball Map** for an entry no PinPoint machine is linked to
 * (lineup spec §5.4). The same push as the machine page's removal (pinballmap
 * §4.3), for an entry with no machine to act through.
 *
 * Gated by {@link authorizeUnlinkedEntryAction} plus the member's linked
 * account (pinballmap §8.2); the caller confirms first with the entry's comment count
 * (§4.5, §4.6). Credential decrypt and the PBM call run before the transaction
 * (CORE-ARCH-011).
 *
 * A `not_found` is checked against a freshly re-fetched lineup rather than read
 * as "already gone", exactly as `removeMachineFromPinballMapAction` does
 * (PP-rnup), and the stored lineup is edited so the page stops offering the
 * removal of an entry that is gone (CORE-ARCH-012).
 */
export async function removeUnlinkedPinballmapEntryAction(
  _prev: RemoveUnlinkedEntryResult | undefined,
  formData: FormData
): Promise<RemoveUnlinkedEntryResult> {
  const authed = await authorizeUnlinkedEntryAction(formData);
  if (!authed.ok) return authed.result;
  const { userId, state, lmx } = authed;
  const titleId = lmx.machineId;

  // --- non-transactional effects, all BEFORE the transaction ---
  const linked = await getLinkedPinballMapCredentials(userId);
  if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);
  const { credentials } = linked;

  const lease = await claimPinballMapMutationLease(
    state.locationId,
    state.configurationGeneration
  );
  if (!lease)
    return err(
      "SERVER",
      "The tracked Pinball Map location is being changed. Reload the page and try again."
    );

  try {
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
      return await pushRejected(userId, linked, written);
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
          return await pushRejected(userId, linked, written);
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

    revalidatePath("/m", "layout");
    return ok({});
  } finally {
    await releasePinballMapMutationLease(lease.id);
  }
}

export type LinkPinballmapEntryResult = Result<
  { pinballmapMachineId: number; intent: PbmListingIntent },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "CONFLICT" | "SERVER"
>;

/**
 * **Link** an entry on the lineup page (lineup spec §5.4, §5.7): match a
 * PinPoint machine to the entry's catalog title. A person picks the machine;
 * nothing is guessed (pinballmap §2.2).
 *
 * The match itself is `updateMachinePbmLink`, the same service the MCP linking
 * tool uses, so re-matching a machine follows the standard reset and
 * abandoned-entry rules (pinballmap §2.3, §2.5). Gated on the machine-linking
 * capability for the chosen machine (§8.1). Writes only to PinPoint.
 *
 * The entry is already on the lineup, so the match then sets the machine On
 * (pinballmap §2.3) unless it is set to Don't sync or its availability forbids
 * On (§6.2). That is a second, intent-only update: the re-match itself still
 * resets intent as §2.3 describes, and a failure between the two is reported
 * rather than left looking like the link did it all (CORE-ARCH-012).
 */
export async function linkMachineToPinballmapEntryAction(
  _prev: LinkPinballmapEntryResult | undefined,
  formData: FormData
): Promise<LinkPinballmapEntryResult> {
  const titleRaw = formData.get("pinballmapMachineId");
  if (typeof titleRaw !== "string" || !/^\d+$/.test(titleRaw))
    return err("VALIDATION", "Missing Pinball Map title");
  const pinballmapMachineId = Number(titleRaw);

  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.link",
    { requireLink: false }
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;

  if (machine.pinballmapExcluded)
    return err(
      "VALIDATION",
      "This machine is marked as not in Pinball Map's catalog. Change that on its page first."
    );
  // The page compares machines not marked Removed (lineup §1), and the picker
  // never offers one; refuse a stale or hand-built request the same way.
  if (machine.presenceStatus === "removed")
    return err("VALIDATION", "This machine is marked Removed.");
  if (machine.pinballmapMachineId === pinballmapMachineId)
    return ok({ pinballmapMachineId, intent: machine.pinballmapIntent });

  const updated = await updateMachinePbmLink({
    machineId: machine.id,
    actorUserId: userId,
    selection: { pinballmapMachineId },
  });
  if (!updated.ok) {
    if (updated.reason === "not_found")
      return err("NOT_FOUND", updated.message);
    if (updated.reason === "conflict") return err("CONFLICT", updated.message);
    return err("VALIDATION", updated.message);
  }

  let intent = updated.columns.pinballmapIntent;
  if (
    intent === "off" &&
    !INTENT_ON_BLOCKED_BY.includes(machine.presenceStatus)
  ) {
    const setOn = await updateMachinePbmLink({
      machineId: machine.id,
      actorUserId: userId,
      selection: { intent: "on" },
    });
    if (!setOn.ok) {
      revalidatePath(`/m/${machine.initials}`);
      revalidatePath("/m", "layout");
      return err(
        "SERVER",
        `Linked ${machine.initials}, but setting it On the lineup failed: ${setOn.message} Set it On from its Manage tab.`
      );
    }
    intent = setOn.columns.pinballmapIntent;
  }

  revalidatePath(`/m/${machine.initials}`);
  revalidatePath("/m", "layout");
  return ok({ pinballmapMachineId, intent });
}

export type SetInsiderConnectedIntentResult = Result<
  { icIntent: PbmIcIntent | null },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND"
>;

/**
 * Record whether this cabinet should be Insider Connected (spec 3.8), or clear
 * the intent with `no_sync` (the toggle's Don't sync position, stored NULL).
 * Writes only to PinPoint, like the listing intent toggle: no credentials
 * needed, no confirmation, instantly reversible. A difference from Pinball Map
 * shows as Out of sync and is pushed by the status row (4.3).
 *
 * Refused for a title Pinball Map's catalog does not mark eligible, since the
 * switch is not shown there and the push could never carry it.
 */
export async function setInsiderConnectedIntentAction(
  _prev: SetInsiderConnectedIntentResult | undefined,
  formData: FormData
): Promise<SetInsiderConnectedIntentResult> {
  const raw = formData.get("icIntent");
  if (raw !== "on" && raw !== "off" && raw !== "no_sync")
    return err("VALIDATION", "Unknown Insider Connected setting");
  const icIntent = raw === "no_sync" ? null : raw;

  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.link"
  );
  if (!authed.ok) return authed.result;
  const { machine } = authed;

  const result = await setMachineIcIntent({ machineId: machine.id, icIntent });
  if (!result.ok) return err("VALIDATION", result.message);

  if (result.changed) {
    revalidatePath(`/m/${machine.initials}`);
    // Same-title cabinets share the entry's target, so their pages change too.
    revalidatePath("/m", "layout");
  }
  return ok({ icIntent });
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
  lease: NonNullable<Awaited<ReturnType<typeof claimPinballMapMutationLease>>>;
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
 * outside the lease, since the refresh claims its own place.
 */
async function reReadAfterUnclearIc(userId: string): Promise<boolean> {
  const refreshed = await syncLocationSnapshot({
    updatedBy: userId,
    trigger: "manual",
  });
  if (refreshed.ok) await reconcileAfterSync();
  revalidatePath("/m", "layout");
  return refreshed.ok;
}

export type UpdateInsiderConnectedResult = Result<
  { icEnabled: boolean },
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "NOT_LINKED"
  | "PBM_REJECTED"
  | "PBM_AUTH_FAILED"
  // The write may or may not have landed. Not retried; the lineup is re-read
  // so the page shows what Pinball Map actually has (spec 3.8).
  | "PBM_UNCLEAR"
  | "SERVER"
>;

/**
 * **Update Pinball Map** (spec 4.3): push the entry's Insider Connected target
 * when it is the only thing out of sync. The target comes from stored intents
 * (On wins across same-title cabinets), never from the request, so a stale
 * page cannot send the wrong value.
 *
 * Needs the push capability plus the member's linked account (8.2); the entry must be on the
 * lineup and the title eligible. Each is re-checked here against stored state.
 */
export async function updateInsiderConnectedAction(
  _prev: UpdateInsiderConnectedResult | undefined,
  formData: FormData
): Promise<UpdateInsiderConnectedResult> {
  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.push"
  );
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;
  const titleId = machine.pinballmapMachineId;
  if (titleId === null)
    return err("VALIDATION", "Machine isn't linked to a Pinball Map title yet");

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

  const lease = await claimPinballMapMutationLease(
    locationId,
    state.configurationGeneration
  );
  if (!lease)
    return err(
      "SERVER",
      "The tracked Pinball Map location is being changed. Reload the page and try again."
    );

  let outcome: IcPushOutcome;
  try {
    outcome = await pushInsiderConnected({
      credentials: linked.credentials,
      lease,
      locationId,
      lmxId: lmx.id,
      target,
    });
  } finally {
    await releasePinballMapMutationLease(lease.id);
  }

  switch (outcome.kind) {
    case "applied":
      revalidatePath(`/m/${machine.initials}`);
      revalidatePath("/m", "layout");
      return ok({ icEnabled: target === "on" });
    case "rejected":
      return await pushRejected(userId, linked, outcome.failure);
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

export type RemovalCommentCheckResult = Result<
  {
    count: number;
    checkedAt: Date;
    freshness: "current" | "last_known";
    failure: "throttled" | "failed" | null;
  },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

/**
 * Check the comment count when an operator opens a remove confirmation.
 * Page rendering stays on the stored snapshot; only this deliberate click may
 * spend from the shared manual-refresh allowance (spec 3.4, 4.6).
 *
 * Takes a `machineId` for a machine's own entry or one it left behind, or an
 * `lmxId` alone for an entry no PinPoint machine is linked to (lineup spec
 * §5.4), under the same gate as the removal it confirms.
 */
export async function checkRemovalCommentsAction(
  formData: FormData
): Promise<RemovalCommentCheckResult> {
  const explicitLmxRaw = formData.get("lmxId");
  const explicitLmxId =
    typeof explicitLmxRaw === "string" && /^\d+$/.test(explicitLmxRaw)
      ? Number(explicitLmxRaw)
      : null;

  if (!formData.has("machineId")) {
    const authed = await authorizeUnlinkedEntryAction(formData);
    if (!authed.ok) return authed.result;
    return countRemovalComments({
      state: authed.state,
      userId: authed.userId,
      entryId: authed.lmx.id,
      titleId: authed.lmx.machineId,
    });
  }

  const authed = await authorizeListingAction(
    formData,
    "machines.pinballmap.push",
    explicitLmxId !== null ? { requireLink: false } : undefined
  );
  if (!authed.ok) return authed.result;
  const { machine, userId } = authed;

  const state = await getPinballMapState();
  if (state?.locationId == null)
    return err("SERVER", "Pinball Map isn't configured yet.");

  const abandoned =
    explicitLmxId === null
      ? null
      : (
          await listSurfacingAbandonedForMachine(machine.id, state.locationId)
        ).find((row) => row.lmxId === explicitLmxId);
  if (explicitLmxId !== null && !abandoned)
    return err("NOT_FOUND", "This entry is no longer available to remove.");
  if (abandoned && abandoned.locationId !== state.locationId)
    return err("SERVER", "This entry belongs to a different location.");

  const entryId =
    explicitLmxId ??
    (machine.pinballmapMachineId === null
      ? null
      : ((state.snapshotJson
          ? findLmxForMachine(state.snapshotJson, machine.pinballmapMachineId)
              ?.id
          : null) ?? null));
  if (entryId === null)
    return err("NOT_FOUND", "This entry is no longer on the lineup.");

  return countRemovalComments({
    state: { ...state, locationId: state.locationId },
    userId,
    entryId,
    titleId: abandoned?.pinballmapMachineId ?? machine.pinballmapMachineId,
  });
}

/**
 * The comment count a remove confirmation shows (spec 4.6): the stored count
 * when the lineup is under 5 minutes old, otherwise a refresh first, falling
 * back to the last-known count and its age when the refresh cannot run.
 */
async function countRemovalComments(args: {
  state: PinballmapRuntimeState & { locationId: number };
  userId: string;
  entryId: number;
  /** The entry's title, to find it again if a refresh re-mints its id. */
  titleId: number | null;
}): Promise<RemovalCommentCheckResult> {
  const { state, userId, entryId, titleId } = args;
  const initialEntry = state.snapshotJson?.lmxes.find(
    (entry) => entry.id === entryId
  );
  const initialCheckedAt = state.lastSyncedAt;
  const now = Date.now();
  const isFresh =
    initialEntry !== undefined &&
    initialCheckedAt !== null &&
    now - initialCheckedAt.getTime() <= 5 * 60 * 1000;
  if (isFresh)
    return ok({
      count: initialEntry.conditions.length,
      checkedAt: initialCheckedAt,
      freshness: "current",
      failure: null,
    });

  const refreshed = await syncLocationSnapshot({
    updatedBy: userId,
    trigger: "manual",
  });
  if (refreshed.ok) await reconcileAfterSync();
  // A refresh changes the shared lineup; even a failed attempt can spend the
  // header's allowance. Keep other machine pages and the header in step.
  revalidatePath("/m", "layout");
  // Another human or the hourly sync may have refreshed while our attempt was
  // busy or throttled. Prefer that new observation over a stale fallback.
  const latest = await getPinballMapState();
  if (latest?.locationId !== state.locationId)
    return err(
      "SERVER",
      "The tracked location changed. Reload before removing."
    );
  const latestEntry =
    latest.snapshotJson && titleId !== null
      ? findLmxForMachine(latest.snapshotJson, titleId)
      : undefined;
  if (
    latest.lastSyncedAt !== null &&
    latest.lastSyncedAt.getTime() > (initialCheckedAt?.getTime() ?? 0) &&
    now - latest.lastSyncedAt.getTime() <= 5 * 60 * 1000
  ) {
    if (!latestEntry)
      return err("NOT_FOUND", "This entry is no longer on the lineup.");
    return ok({
      count: latestEntry.conditions.length,
      checkedAt: latest.lastSyncedAt,
      freshness: "current",
      failure: null,
    });
  }
  if (refreshed.ok)
    return err("SERVER", "The refreshed lineup is unavailable. Try again.");
  if (!initialEntry || !initialCheckedAt)
    return err("SERVER", "No last-known comment count is available.");
  return ok({
    count: initialEntry.conditions.length,
    checkedAt: initialCheckedAt,
    freshness: "last_known",
    failure: refreshed.reason === "throttled" ? "throttled" : "failed",
  });
}

export type RefreshPinballmapResult = Result<
  { machineCount: number; abandonmentsCleared: number },
  "UNAUTHORIZED" | "SERVER" | "THROTTLED"
>;

/**
 * Re-read what Pinball Map shows for the location — the control header's
 * Refresh button (spec 3.2, 8.3).
 *
 * Manual reading requires signed-in membership plus page access, so this is
 * gated on `machines.pinballmap.sync`, which every signed-in member holds. That
 * is safe precisely because the rate limit does not depend on which eligible
 * member asks: the token bucket at the `syncLocationSnapshot` seam is global
 * (CORE-PBM-001). An empty bucket surfaces as `THROTTLED`,
 * which the header shows as a disabled button with a countdown rather than an
 * error nobody could have avoided.
 *
 * `syncLocationSnapshot` itself refuses an unconfigured location before it
 * spends the shared allowance. Form-action shaped `(prevState,
 * formData)` so a `useActionState` button drops it in directly
 * (CORE-ARCH-005/007).
 */
export async function refreshPinballmapLineupAction(
  _prevState: RefreshPinballmapResult | undefined,
  _formData: FormData
): Promise<RefreshPinballmapResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("UNAUTHORIZED", "Sign in required");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (!profile) return err("UNAUTHORIZED", "User profile not found.");

  if (
    !checkPermission("machines.pinballmap.sync", getAccessLevel(profile.role))
  )
    return err("UNAUTHORIZED", "Not allowed");

  try {
    const result = await syncLocationSnapshot({
      updatedBy: user.id,
      trigger: "manual",
    });
    if (!result.ok) {
      if (result.reason === "not_configured") {
        return err("SERVER", "Pinball Map isn't configured yet");
      }
      if (result.reason === "throttled") {
        const minutes = Math.max(
          1,
          Math.ceil(result.retryAfterMs / (60 * 1000))
        );
        // The bucket moved even though the lineup did not — a token was spent
        // on the attempt (PP-hbi0), and the remove path spends them too. Without
        // this the header keeps rendering the count it was built with, so the
        // button says refreshes remain while every press is refused.
        revalidatePath("/m", "layout");
        return err(
          "THROTTLED",
          `Pinball Map was refreshed recently. Try again in about ${String(minutes)} minute${minutes === 1 ? "" : "s"}.`
        );
      }
      if (result.reason === "superseded") {
        revalidatePath("/m", "layout");
        return err(
          "SERVER",
          "The tracked Pinball Map location changed while this refresh was running. Reload the page and try again."
        );
      }
      if (result.reason === "busy") {
        return err(
          "SERVER",
          "A Pinball Map change is already running. Reload the page and try again."
        );
      }
      return err("SERVER", result.error);
    }

    const { abandonmentsCleared } = await reconcileAfterSync();
    // Every machine's state derives from the stored lineup, so the whole
    // subtree is stale once it changes.
    revalidatePath("/m", "layout");
    return ok({ machineCount: result.machineCount, abandonmentsCleared });
  } catch (error: unknown) {
    log.error({ err: error }, "Manual PinballMap refresh failed");
    return err("SERVER", "Pinball Map refresh failed. Please try again.");
  }
}

/** A stored lineup older than this is refreshed before confirming (spec 3.7). */
const CONFIRM_FRESH_MS = 5 * 60 * 1000;

/** An entry the Confirm lineup dialog warns about (spec 3.7). */
export interface ConfirmLineupEntry {
  key: string;
  name: string;
  /** To add (Missing), To remove (Lingering), or an unmatched entry. */
  kind: "to_add" | "to_remove" | "not_linked";
}

export type CheckConfirmLineupResult = Result<
  {
    entryCount: number;
    /** The snapshot the list was built from; ISO string. */
    lastRefreshedAt: string | null;
    /** The pre-confirm refresh was needed and did not succeed. */
    refreshFailed: boolean;
    entries: ConfirmLineupEntry[];
  },
  "UNAUTHORIZED" | "NOT_LINKED" | "SERVER"
>;

export type ConfirmLineupResult = Result<
  Record<string, never>,
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "NOT_LINKED"
  | "PBM_REJECTED"
  | "PBM_AUTH_FAILED"
  | "SERVER"
>;

async function authorizeConfirmLineup(): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: Result<never, "UNAUTHORIZED"> }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, result: err("UNAUTHORIZED", "Sign in required") };
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (
    !checkPermission(
      "machines.pinballmap.confirm",
      getAccessLevel(profile?.role)
    )
  )
    return { ok: false, result: err("UNAUTHORIZED", "Not allowed") };
  return { ok: true, userId: user.id };
}

/**
 * Open the Confirm lineup dialog (spec 3.7): refresh a stored lineup over five
 * minutes old, then list what is out of sync or unmatched.
 *
 * The refresh is an ordinary manual one, through the shared allowance
 * (CORE-PBM-001). When it is throttled or fails, the dialog still opens on the
 * last good snapshot and says how old it is, so the person decides whether to
 * proceed.
 */
export async function checkConfirmLineupAction(): Promise<CheckConfirmLineupResult> {
  const authed = await authorizeConfirmLineup();
  if (!authed.ok) return authed.result;

  const state = await getPinballMapState();
  if (state?.locationId == null || !state.snapshotJson)
    return err("SERVER", "Pinball Map hasn't been refreshed yet.");
  // The confirmation runs as the person's own linked account (spec 3.7, 8.4).
  const link = await getPinballMapLinkStatus(authed.userId);
  if (link.status !== "linked") return err("NOT_LINKED", NOT_LINKED_MESSAGE);

  let refreshFailed = false;
  const age =
    state.lastSyncedAt === null
      ? Infinity
      : Date.now() - state.lastSyncedAt.getTime();
  if (age > CONFIRM_FRESH_MS) {
    try {
      const result = await syncLocationSnapshot({
        updatedBy: authed.userId,
        trigger: "manual",
      });
      if (result.ok) {
        await reconcileAfterSync();
        revalidatePath("/m", "layout");
      } else if (
        result.reason === "superseded" ||
        result.reason === "not_configured"
      ) {
        revalidatePath("/m", "layout");
        return err(
          "SERVER",
          "The tracked Pinball Map location changed. Reload the page."
        );
      } else {
        // A throttled attempt still spent a token and a failure recorded its
        // status, so the header is stale either way (as in the Refresh action).
        revalidatePath("/m", "layout");
        refreshFailed = true;
      }
    } catch (error: unknown) {
      log.error({ err: error }, "Pre-confirm PinballMap refresh failed");
      revalidatePath("/m", "layout");
      refreshFailed = true;
    }
  }

  const { state: current, comparison } = await loadLineupData();
  if (comparison.status !== "ready" || !current?.snapshotJson)
    return err("SERVER", "Pinball Map hasn't been refreshed yet.");

  const entries: ConfirmLineupEntry[] = [];
  for (const row of comparison.sections.out_of_sync) {
    if (row.tag === "to_update") continue;
    entries.push({ key: row.key, name: row.title.name, kind: row.tag });
  }
  for (const row of comparison.sections.pinball_map_only)
    entries.push({ key: row.key, name: row.title.name, kind: "not_linked" });

  return ok({
    entryCount: current.snapshotJson.lmxes.length,
    lastRefreshedAt: current.lastSyncedAt?.toISOString() ?? null,
    refreshFailed,
    entries,
  });
}

/** `YYYY-MM-DD` within a day of the server's UTC date. */
function isPlausibleToday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed) &&
    Math.abs(parsed - Date.now()) <= 36 * 60 * 60 * 1000
  );
}

/**
 * Tell Pinball Map the tracked location's whole lineup is accurate as of today
 * (spec 3.7). A venue-level statement: it adds, removes, and refreshes nothing.
 *
 * On success the stored snapshot's last-updated date moves to `today`, the
 * confirming person's local date, so the header reflects the confirmation
 * before the next refresh reads Pinball Map's own value.
 */
export async function confirmPinballmapLineupAction(
  _prev: ConfirmLineupResult | undefined,
  formData: FormData
): Promise<ConfirmLineupResult> {
  const authed = await authorizeConfirmLineup();
  if (!authed.ok) return authed.result;

  const todayRaw = formData.get("today");
  const today = typeof todayRaw === "string" ? todayRaw : "";
  if (!isPlausibleToday(today)) return err("VALIDATION", "Invalid date");

  const state = await getPinballMapState();
  if (state?.locationId == null || !state.snapshotJson)
    return err("SERVER", "Pinball Map hasn't been refreshed yet.");
  const locationId = state.locationId;

  const linked = await getLinkedPinballMapCredentials(authed.userId);
  if (!linked) return err("NOT_LINKED", NOT_LINKED_MESSAGE);

  const lease = await claimPinballMapMutationLease(
    locationId,
    state.configurationGeneration
  );
  if (!lease)
    return err(
      "SERVER",
      "The tracked Pinball Map location is being changed. Reload the page and try again."
    );

  try {
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
      return pushRejected(authed.userId, linked, written);
    }
    log.info(
      { userId: authed.userId, locationId, action: "pinballmap.confirmLineup" },
      "Confirmed the Pinball Map lineup"
    );

    await db.transaction(async (tx) => {
      if (!(await mutationLeaseOwnsLocation(tx, lease))) return;
      await editStoredSnapshot(tx, locationId, (snapshot) => ({
        ...snapshot,
        dateLastUpdated: today,
      }));
    });

    revalidatePath("/m", "layout");
    return ok({});
  } finally {
    await releasePinballMapMutationLease(lease.id);
  }
}
