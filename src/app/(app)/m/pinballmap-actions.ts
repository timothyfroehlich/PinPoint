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
import { userProfiles } from "~/server/db/schema";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { type Result, ok, err } from "~/lib/result";
import { syncLocationSnapshot } from "~/lib/pinballmap/state";
import { reconcileAfterSync } from "~/lib/pinballmap/sync";
import { log } from "~/lib/logger";
import {
  searchCatalogFamilies,
  listGroupEditions,
  getCatalogEntry,
  type CatalogEdition,
  type CatalogFamily,
} from "~/lib/pinballmap/catalog";

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

/** Result of an on-demand "Sync now" — the machine count and heals applied. */
export type SyncPinballMapNowResult = Result<
  { machineCount: number; healed: number },
  "UNAUTHORIZED" | "SERVER"
>;

/**
 * Manually refresh the stored PinballMap snapshot ("Sync now"), then reconcile
 * stored lmx drift. Technician+ (`machines.pinballmap.sync`, CORE-ARCH-008).
 *
 * Unlike the hourly cron, this does NOT gate on `state.enabled`: it's an
 * explicit human-initiated refresh, so the human is the caller who owns the
 * decision (CORE-PBM-001 is respected — a click is naturally rate-limited, and
 * the permission is technician+). Form-action shaped `(prevState, formData)` so
 * a `<form action={...}>` + `useActionState` button (control room, PP-o355.7)
 * can drop it in for progressive enhancement (CORE-ARCH-002).
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
      "Only technicians and admins can trigger a PinballMap sync."
    );
  }

  try {
    const result = await syncLocationSnapshot({ updatedBy: user.id });
    if (!result.ok) return err("SERVER", result.error);

    const { healed } = await reconcileAfterSync();
    // Desync badges on machine Info cards derive from the stored snapshot, so
    // refresh the whole machine subtree after a successful sync.
    revalidatePath("/m", "layout");
    return ok({ machineCount: result.machineCount, healed });
  } catch (error: unknown) {
    log.error({ err: error }, "Manual PinballMap sync failed");
    return err("SERVER", "PinballMap sync failed. Please try again.");
  }
}
