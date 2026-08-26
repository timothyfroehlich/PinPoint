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

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db, type Tx } from "~/server/db";
import { machines, userProfiles, pinballmapState } from "~/server/db/schema";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import {
  listSurfacingAbandonedForMachine,
  retireAbandonmentForLmx,
} from "~/lib/pinballmap/abandoned-listings";
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
import { PBM_REFRESH_REFILL_MS } from "~/lib/pinballmap/config";
import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import type { PbmListingIntent } from "~/lib/pinballmap/listing-state";
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

/** Availability that forbids intent On (spec 6.2). Mirrors `listing-state.ts`. */
const INTENT_ON_BLOCKED_BY: readonly MachinePresenceStatus[] = [
  "pending_arrival",
  "removed",
];

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
  if (intent === null) return err("VALIDATION", "Unknown listing setting");

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
    Date.now() - syncedAt.getTime() < PBM_REFRESH_REFILL_MS;

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

export type ListPinballmapResult = Result<
  { lmxId: number },
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  // Availability forbids being on the lineup (6.2) — the same refusal the
  // intent toggle gives, on the push that would otherwise get there anyway.
  | "BLOCKED"
  | "NOT_PROVISIONED"
  | "PBM_REJECTED"
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
 * Gated on `machines.pinballmap.push` plus provisioned credentials (spec 8.2,
 * CORE-ARCH-008).
 *
 * **Ordering is a hard requirement, not a style choice** (CORE-ARCH-011). Two
 * non-transactional effects run first — decrypting the operator credential and
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
    await db.transaction(async (tx) => {
      await retireAbandonmentForLmx(tx, existing.id);
    });
    revalidatePath(`/m/${machine.initials}`);
    return ok({ lmxId: existing.id });
  }

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

  await db.transaction(async (tx) => {
    // PBM returns the EXISTING lmx when the entry is already on the lineup, so
    // an add can reclaim one a machine walked away from.
    await retireAbandonmentForLmx(tx, lmxId);
    // The stored lineup is what every control renders from, so it has to carry
    // the entry we just created — otherwise the page repaints as still Missing
    // and offers Add again, for up to an hour (CORE-ARCH-012).
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

  revalidatePath(`/m/${machine.initials}`);
  // The stored lineup changed, and every same-title cabinet's state derives
  // from it — a sibling reads differently now.
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

  // The submitted id is attacker-controlled, and the operator account it would
  // act through can edit the WHOLE location's lineup. Push is `member: "owner"`,
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
  const abandonedTitleId =
    explicitLmxId === null
      ? null
      : ((await listSurfacingAbandonedForMachine(machine.id)).find(
          (a) => a.lmxId === explicitLmxId
        )?.pinballmapMachineId ?? null);

  if (explicitLmxId !== null && abandonedTitleId === null)
    return err(
      "NOT_FOUND",
      "That entry is not one this machine left behind, so it is not this machine's to remove."
    );

  // Which title this removal is ABOUT: the abandoned entry's own, when we are
  // acting on one, and otherwise the cabinet's current title.
  const titleId = abandonedTitleId ?? machine.pinballmapMachineId;

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
      // The abandoned entry's title, not the cabinet's current one. Passing the
      // current title here would ask "has THIS machine's title been re-minted?"
      // about an entry under a different title — and a `retry` verdict would
      // then delete the cabinet's own live entry from the public lineup.
      pinballmapMachineId: titleId,
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
  await db.transaction(async (tx) => {
    await editStoredSnapshot(tx, (snapshot) =>
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
  });

  revalidatePath(`/m/${machine.initials}`);
  // See the add action: the shared lineup changed, so sibling cabinets read
  // differently now.
  revalidatePath("/m", "layout");
  return ok({});
}

export type RefreshPinballmapResult = Result<
  { machineCount: number; abandonmentsCleared: number },
  "UNAUTHORIZED" | "SERVER" | "THROTTLED"
>;

/**
 * Re-read what Pinball Map shows for the location — the control header's
 * Refresh button (spec 3.2, 8.3).
 *
 * Reading needs only page access, so this is gated on
 * `machines.pinballmap.sync`, which every signed-in member holds. That is safe
 * precisely because the rate limit does not depend on who asks: the token bucket
 * at the `syncLocationSnapshot` seam is global, so widening the audience widens
 * nobody's allowance (CORE-PBM-001). An empty bucket surfaces as `THROTTLED`,
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
