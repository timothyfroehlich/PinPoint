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

  // Read the freshest stored lineup; sync once if we've never captured one.
  let state = await getPinballMapState();
  if (!state?.snapshotJson) {
    await syncLocationSnapshot();
    state = await getPinballMapState();
  }
  const snapshot = state?.snapshotJson;
  if (!snapshot) return err("SERVER", "PinballMap lineup unavailable");

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
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
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

  // Verify means "check right now" — force a fresh sync before resolving.
  await syncLocationSnapshot();
  const snapshot = (await getPinballMapState())?.snapshotJson;
  if (!snapshot) return err("SERVER", "PinballMap lineup unavailable");

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
