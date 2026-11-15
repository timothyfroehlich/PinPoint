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
 *
 * The lineup push actions (add, remove, Insider Connected, confirm) keep
 * authentication, input parsing, revalidation and the form's return shape here.
 * The orchestration they run — the mutation lease, the PBM call, the stored-
 * lineup edit — lives in `~/lib/pinballmap/outbound-write`,
 * `~/lib/pinballmap/outbound-remove` and `~/lib/pinballmap/removal-comments`.
 */

"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  machines,
  pinballmapAbandonedListings,
  userProfiles,
} from "~/server/db/schema";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import { importPinballMapCommentsAfterCoverageChange } from "~/lib/pinballmap/comment-import";
import { listSurfacingAbandonedForMachine } from "~/lib/pinballmap/abandoned-listings";
import { getPinballMapLinkStatus } from "~/lib/pinballmap/user-credentials";
import type { PbmLmx } from "~/lib/pinballmap/types";
import {
  reportError,
  serverActionError,
} from "~/lib/observability/report-error";
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
import { getMachinePresenceLabel } from "~/lib/machines/presence";
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import type { PbmIcIntent } from "~/lib/pinballmap/insider-connected";
import {
  NOT_LINKED_MESSAGE,
  addLineupEntry,
  confirmLocationLineup,
  pushEntryInsiderConnected,
} from "~/lib/pinballmap/outbound-write";
import {
  removeMachineLineupEntry,
  removeUnlinkedLineupEntry,
} from "~/lib/pinballmap/outbound-remove";
import {
  countRemovalComments,
  type RemovalCommentCount,
} from "~/lib/pinballmap/removal-comments";
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
import { siteDayOf } from "~/lib/time-zone";

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
  // A Server Action's argument is untrusted: a NaN or fractional id reached
  // Postgres as an integer bind and threw (Sentry PINPOINT-34).
  if (!Number.isSafeInteger(pinballmapMachineId)) return false;
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
 * Revalidate after a push the member's own link refused. A `PBM_AUTH_FAILED`
 * error means the outbound flow just marked the link failed (spec 8.5), and
 * the link status decides Settings and the push buttons on every machine page
 * and the lineup page, as on link/unlink. The machine page's control also
 * hides the transient error for this code and relies on re-rendering into its
 * standing note.
 */
function revalidateIfLinkFailed<C extends string>(
  result: Result<unknown, C>,
  // Only a flow that can report `PBM_AUTH_FAILED` may be passed: a result
  // whose codes lack it (or a renamed code) needs a `never` argument, so the
  // call fails to compile instead of silently skipping the revalidation.
  ..._canFailAuth: "PBM_AUTH_FAILED" extends C ? [] : [never]
): void {
  if (!result.ok && result.code === "PBM_AUTH_FAILED") {
    revalidatePath("/settings");
    revalidatePath("/m", "layout");
  }
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
 * The push itself — the lease, the PBM call before the transaction
 * (CORE-ARCH-011), the stored-lineup edit and the Insider Connected follow-up —
 * is `addLineupEntry` (`~/lib/pinballmap/outbound-write`).
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

  const added = await addLineupEntry({
    userId,
    machineId: machine.id,
    titleId,
  });
  if (!added.ok) {
    revalidateIfLinkFailed(added);
    return added;
  }

  revalidatePath(`/m/${machine.initials}`);
  // The stored lineup changed, and every same-title cabinet's state derives
  // from it — a sibling reads differently now. Not when the title was already
  // listed: nothing was sent and the stored lineup is unchanged.
  if (!added.value.alreadyListed) revalidatePath("/m", "layout");
  return ok({ lmxId: added.value.lmxId });
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
 * Gated on `machines.pinballmap.push` plus credentials (spec 8.2). The push —
 * which lmx to delete, the `not_found` check against a re-fetched lineup
 * (PP-rnup) and the stored-lineup edit — is `removeMachineLineupEntry`
 * (`~/lib/pinballmap/outbound-remove`).
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

  // The explicit id is checked against this machine's abandonment records
  // under the mutation lease, inside the flow (spec 2.5).
  const removed = await removeMachineLineupEntry({
    userId,
    machine,
    explicitLmxId,
  });
  if (!removed.ok) {
    revalidateIfLinkFailed(removed);
    return removed;
  }

  revalidatePath(`/m/${machine.initials}`);
  // See the add action: the shared lineup changed, so sibling cabinets read
  // differently now.
  revalidatePath("/m", "layout");
  return ok({});
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
 * removal of an entry that is gone (CORE-ARCH-012). The push is
 * `removeUnlinkedLineupEntry` (`~/lib/pinballmap/outbound-remove`).
 */
export async function removeUnlinkedPinballmapEntryAction(
  _prev: RemoveUnlinkedEntryResult | undefined,
  formData: FormData
): Promise<RemoveUnlinkedEntryResult> {
  const authed = await authorizeUnlinkedEntryAction(formData);
  if (!authed.ok) return authed.result;
  const { userId, state, lmx } = authed;

  const removed = await removeUnlinkedLineupEntry({ userId, state, lmx });
  if (!removed.ok) {
    revalidateIfLinkFailed(removed);
    return removed;
  }

  revalidatePath("/m", "layout");
  return ok({});
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
 * lineup and the title eligible. `pushEntryInsiderConnected`
 * (`~/lib/pinballmap/outbound-write`) re-checks each against stored state.
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

  const pushed = await pushEntryInsiderConnected({ userId, titleId });
  if (!pushed.ok) {
    revalidateIfLinkFailed(pushed);
    // The flow re-read the lineup, which changed the shared snapshot.
    if (pushed.code === "PBM_UNCLEAR") revalidatePath("/m", "layout");
    return pushed;
  }

  revalidatePath(`/m/${machine.initials}`);
  revalidatePath("/m", "layout");
  return ok(pushed.value);
}

export type RemovalCommentCheckResult = Result<
  RemovalCommentCount,
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
    return countRemovalCommentsAndRevalidate({
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

  return countRemovalCommentsAndRevalidate({
    state: { ...state, locationId: state.locationId },
    userId,
    entryId,
    titleId: abandoned?.pinballmapMachineId ?? machine.pinballmapMachineId,
  });
}

async function countRemovalCommentsAndRevalidate(
  args: Parameters<typeof countRemovalComments>[0]
): Promise<RemovalCommentCheckResult> {
  const { result, refreshAttempted } = await countRemovalComments(args);
  // A refresh changes the shared lineup; even a failed attempt can spend the
  // header's allowance. Keep other machine pages and the header in step.
  if (refreshAttempted) revalidatePath("/m", "layout");
  return result;
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
    return serverActionError(
      error,
      "SERVER",
      "Pinball Map refresh failed. Please try again.",
      { action: "refreshPinballmapLineupAction" }
    );
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
  "UNAUTHORIZED" | "NOT_LINKED" | "PBM_REJECTED" | "PBM_AUTH_FAILED" | "SERVER"
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
      reportError(error, {
        action: "checkConfirmLineupAction.refresh",
        bestEffort: true,
      });
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

/**
 * Tell Pinball Map the tracked location's whole lineup is accurate as of today
 * (spec 3.7). A venue-level statement: it adds, removes, and refreshes nothing.
 *
 * On success the stored snapshot's last-updated date moves to today's site
 * day (America/Chicago), so the header reflects the confirmation before the
 * next refresh reads Pinball Map's own value.
 */
export async function confirmPinballmapLineupAction(): Promise<ConfirmLineupResult> {
  const authed = await authorizeConfirmLineup();
  if (!authed.ok) return authed.result;

  const confirmed = await confirmLocationLineup({
    userId: authed.userId,
    today: siteDayOf(new Date()),
  });
  if (!confirmed.ok) {
    revalidateIfLinkFailed(confirmed);
    return confirmed;
  }

  revalidatePath("/m", "layout");
  return ok({});
}
