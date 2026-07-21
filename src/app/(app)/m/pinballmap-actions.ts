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
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
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
import { findLmxForMachine } from "~/lib/pinballmap/resolve-lmx";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
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
 * Shared preamble for the listing read-actions: authenticate, load the target
 * machine, and confirm the caller may READ-link it (`machines.pinballmap.link`
 * — owner-own-machine / technician / admin). Returns the machine row when
 * permitted, or a failed Result to short-circuit the caller.
 *
 * The machine must already carry a catalog link (`pinballmapMachineId`); a
 * listing handle presupposes a title (schema CHECK), and we resolve the lmx by
 * that title against the stored lineup.
 */
async function authorizeListingRead(
  formData: FormData
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
    !checkPermission("machines.pinballmap.link", accessLevel, {
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
  const authed = await authorizeListingRead(formData);
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;
  // Narrowed by authorizeListingRead, but re-assert for the type checker.
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
    // of this title is already the lister. Graceful 2nd-cabinet handling is
    // PP-o355.15; here we surface a clear message rather than a 500.
    if (isPgErrorCode(error, "23505"))
      return err(
        "SERVER",
        "Another cabinet of this title is already linked as the PinballMap lister for our location"
      );
    throw error;
  }

  revalidatePath(`/m/${machine.initials}`);
  return ok({ lmxId: lmx.id });
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
  const authed = await authorizeListingRead(formData);
  if (!authed.ok) return authed.result;
  const { userId, machine } = authed;
  if (machine.pinballmapMachineId === null)
    return err("VALIDATION", "Machine isn't linked to a PinballMap title yet");

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

  revalidatePath(`/m/${machine.initials}`);
  return ok({ state: "healed" });
}

/** Result of an on-demand "Sync now" — the machine count and heals applied. */
export type SyncPinballMapNowResult = Result<
  { machineCount: number; healed: number },
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
 * (control room, PP-o355.7) can drop it in for progressive enhancement
 * (CORE-ARCH-002).
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

    const { healed } = await reconcileAfterSync();
    // Desync badges on machine Info cards derive from the stored snapshot, so
    // refresh the whole machine subtree after a successful sync.
    revalidatePath("/m", "layout");
    return ok({ machineCount: result.machineCount, healed });
  } catch (error: unknown) {
    log.error({ err: error }, "Manual PinballMap sync failed");
    return err("SERVER", "Pinball Map sync failed. Please try again.");
  }
}
