/**
 * Pinball Map Server Actions
 *
 * Server-side actions for managing Pinball Map integration.
 * All actions require authentication and appropriate permissions.
 */

"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines, pinballMapConfig, userProfiles } from "~/server/db/schema";
import { type Result, ok, err } from "~/lib/result";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log } from "~/lib/logger";
import { getAccessLevel, checkPermission } from "~/lib/permissions/helpers";
import { getPinballMapConfig } from "~/lib/pinball-map/config";
import {
  searchPbmMachines as searchPbmMachinesApi,
  getLocationMachines,
  addMachineToLocation,
  removeMachineFromLocation,
} from "~/lib/pinball-map/api";
import type {
  PbmMachine,
  PbmSyncReport,
  PbmSyncEntry,
  PbmExtraMachine,
  PbmSyncStatus,
} from "~/lib/pinball-map/types";
import {
  searchPbmMachinesSchema,
  linkPbmMachineSchema,
  addToPbmSchema,
  removeFromPbmSchema,
  updatePbmConfigSchema,
} from "./pinball-map-schemas";

async function getAuthenticatedUser(): Promise<{
  user: { id: string };
  profile: { id: string; role: "guest" | "member" | "technician" | "admin" };
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { id: true, role: true },
  });

  if (!profile) return null;

  return { user, profile };
}

/**
 * Search Pinball Map's canonical machine database.
 */
export async function searchPbmMachinesAction(
  query: string
): Promise<
  Result<
    PbmMachine[],
    "UNAUTHORIZED" | "VALIDATION" | "API_ERROR" | "AUTH_ERROR"
  >
> {
  const auth = await getAuthenticatedUser();
  if (!auth) return err("UNAUTHORIZED", "Please log in.");

  const accessLevel = getAccessLevel(auth.profile.role);
  // Any user who can edit machines can search PBM
  if (
    !checkPermission("pinball_map.manage", accessLevel, {
      userId: auth.user.id,
    })
  ) {
    // For search, we allow any tech/admin without ownership check
    if (!checkPermission("pinball_map.view", accessLevel)) {
      return err("UNAUTHORIZED", "Not authorized.");
    }
  }

  const parsed = searchPbmMachinesSchema.safeParse({ query });
  if (!parsed.success) {
    return err(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid input"
    );
  }

  return searchPbmMachinesApi(parsed.data.query);
}

/**
 * Link a PinPoint machine to a Pinball Map canonical machine model.
 */
export async function linkPbmMachineAction(
  machineId: string,
  pbmMachineId: number,
  pbmMachineName: string
): Promise<
  Result<void, "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "SERVER">
> {
  const auth = await getAuthenticatedUser();
  if (!auth) return err("UNAUTHORIZED", "Please log in.");

  const parsed = linkPbmMachineSchema.safeParse({
    machineId,
    pbmMachineId,
    pbmMachineName,
  });
  if (!parsed.success) {
    return err(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid input"
    );
  }

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, parsed.data.machineId),
    columns: { id: true, ownerId: true, initials: true },
  });

  if (!machine) return err("NOT_FOUND", "Machine not found.");

  const accessLevel = getAccessLevel(auth.profile.role);
  if (
    !checkPermission("pinball_map.manage", accessLevel, {
      userId: auth.user.id,
      machineOwnerId: machine.ownerId,
    })
  ) {
    return err("UNAUTHORIZED", "Not authorized to manage this machine.");
  }

  try {
    await db
      .update(machines)
      .set({
        pbmMachineId: parsed.data.pbmMachineId,
        pbmMachineName: parsed.data.pbmMachineName,
      })
      .where(eq(machines.id, parsed.data.machineId));

    revalidatePath(`/m/${machine.initials}`);
    revalidatePath("/pinball-map");

    return ok(undefined);
  } catch (error) {
    log.error(
      { error, action: "linkPbmMachineAction" },
      "Failed to link PBM machine"
    );
    return err("SERVER", "Failed to link machine. Please try again.");
  }
}

/**
 * Unlink a PinPoint machine from Pinball Map.
 * If the machine is currently listed on PBM, also removes it.
 */
export async function unlinkPbmMachineAction(
  machineId: string
): Promise<
  Result<void, "UNAUTHORIZED" | "NOT_FOUND" | "API_ERROR" | "SERVER">
> {
  const auth = await getAuthenticatedUser();
  if (!auth) return err("UNAUTHORIZED", "Please log in.");

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: {
      id: true,
      ownerId: true,
      initials: true,
      pbmLocationMachineXrefId: true,
    },
  });

  if (!machine) return err("NOT_FOUND", "Machine not found.");

  const accessLevel = getAccessLevel(auth.profile.role);
  if (
    !checkPermission("pinball_map.manage", accessLevel, {
      userId: auth.user.id,
      machineOwnerId: machine.ownerId,
    })
  ) {
    return err("UNAUTHORIZED", "Not authorized to manage this machine.");
  }

  try {
    // If currently listed on PBM, remove it first
    if (machine.pbmLocationMachineXrefId) {
      const config = await getPinballMapConfig();
      if (config.ok) {
        const removeResult = await removeMachineFromLocation({
          xrefId: machine.pbmLocationMachineXrefId,
          email: config.value.userEmail,
          token: config.value.userToken,
        });
        if (!removeResult.ok) {
          return err("API_ERROR", removeResult.message);
        }
      }
    }

    await db
      .update(machines)
      .set({
        pbmMachineId: null,
        pbmMachineName: null,
        pbmLocationMachineXrefId: null,
      })
      .where(eq(machines.id, machineId));

    revalidatePath(`/m/${machine.initials}`);
    revalidatePath("/pinball-map");

    return ok(undefined);
  } catch (error) {
    log.error(
      { error, action: "unlinkPbmMachineAction" },
      "Failed to unlink PBM machine"
    );
    return err("SERVER", "Failed to unlink machine. Please try again.");
  }
}

/**
 * Add a machine to the Pinball Map location listing.
 */
export async function addToPinballMapAction(
  machineId: string
): Promise<
  Result<
    { xrefId: number; presenceStatus: string },
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "NOT_LINKED"
    | "NOT_CONFIGURED"
    | "API_ERROR"
    | "AUTH_ERROR"
    | "SERVER"
  >
> {
  const auth = await getAuthenticatedUser();
  if (!auth) return err("UNAUTHORIZED", "Please log in.");

  const parsed = addToPbmSchema.safeParse({ machineId });
  if (!parsed.success) return err("NOT_FOUND", "Invalid machine ID.");

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, parsed.data.machineId),
    columns: {
      id: true,
      ownerId: true,
      initials: true,
      pbmMachineId: true,
      presenceStatus: true,
    },
  });

  if (!machine) return err("NOT_FOUND", "Machine not found.");

  const accessLevel = getAccessLevel(auth.profile.role);
  if (
    !checkPermission("pinball_map.manage", accessLevel, {
      userId: auth.user.id,
      machineOwnerId: machine.ownerId,
    })
  ) {
    return err("UNAUTHORIZED", "Not authorized to manage this machine.");
  }

  if (!machine.pbmMachineId) {
    return err(
      "NOT_LINKED",
      "Machine must be linked to a Pinball Map model first."
    );
  }

  const config = await getPinballMapConfig();
  if (!config.ok) return err("NOT_CONFIGURED", config.message);

  const result = await addMachineToLocation({
    locationId: config.value.locationId,
    machineId: machine.pbmMachineId,
    email: config.value.userEmail,
    token: config.value.userToken,
  });

  if (!result.ok) {
    return err(result.code, result.message);
  }

  try {
    await db
      .update(machines)
      .set({ pbmLocationMachineXrefId: result.value.xrefId })
      .where(eq(machines.id, parsed.data.machineId));

    revalidatePath(`/m/${machine.initials}`);
    revalidatePath("/pinball-map");

    return ok({
      xrefId: result.value.xrefId,
      presenceStatus: machine.presenceStatus,
    });
  } catch (error) {
    log.error(
      { error, action: "addToPinballMapAction" },
      "Failed to save PBM xref ID"
    );
    return err("SERVER", "Added to Pinball Map but failed to save locally.");
  }
}

/**
 * Remove a machine from the Pinball Map location listing.
 */
export async function removeFromPinballMapAction(
  machineId: string
): Promise<
  Result<
    { presenceStatus: string },
    | "UNAUTHORIZED"
    | "NOT_FOUND"
    | "NOT_CONFIGURED"
    | "API_ERROR"
    | "AUTH_ERROR"
    | "SERVER"
  >
> {
  const auth = await getAuthenticatedUser();
  if (!auth) return err("UNAUTHORIZED", "Please log in.");

  const parsed = removeFromPbmSchema.safeParse({ machineId });
  if (!parsed.success) return err("NOT_FOUND", "Invalid machine ID.");

  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, parsed.data.machineId),
    columns: {
      id: true,
      ownerId: true,
      initials: true,
      pbmLocationMachineXrefId: true,
      presenceStatus: true,
    },
  });

  if (!machine) return err("NOT_FOUND", "Machine not found.");
  if (!machine.pbmLocationMachineXrefId) {
    return err("NOT_FOUND", "Machine is not listed on Pinball Map.");
  }

  const accessLevel = getAccessLevel(auth.profile.role);
  if (
    !checkPermission("pinball_map.manage", accessLevel, {
      userId: auth.user.id,
      machineOwnerId: machine.ownerId,
    })
  ) {
    return err("UNAUTHORIZED", "Not authorized to manage this machine.");
  }

  const config = await getPinballMapConfig();
  if (!config.ok) return err("NOT_CONFIGURED", config.message);

  const result = await removeMachineFromLocation({
    xrefId: machine.pbmLocationMachineXrefId,
    email: config.value.userEmail,
    token: config.value.userToken,
  });

  if (!result.ok) {
    return err(result.code, result.message);
  }

  try {
    await db
      .update(machines)
      .set({ pbmLocationMachineXrefId: null })
      .where(eq(machines.id, parsed.data.machineId));

    revalidatePath(`/m/${machine.initials}`);
    revalidatePath("/pinball-map");

    return ok({ presenceStatus: machine.presenceStatus });
  } catch (error) {
    log.error(
      { error, action: "removeFromPinballMapAction" },
      "Failed to clear PBM xref ID"
    );
    return err(
      "SERVER",
      "Removed from Pinball Map but failed to update locally."
    );
  }
}

/**
 * Get Pinball Map sync report comparing PinPoint machines to PBM listing.
 */
export async function getPbmSyncReportAction(): Promise<
  Result<PbmSyncReport, "UNAUTHORIZED" | "NOT_CONFIGURED" | "API_ERROR">
> {
  const auth = await getAuthenticatedUser();
  if (!auth) return err("UNAUTHORIZED", "Please log in.");

  const accessLevel = getAccessLevel(auth.profile.role);
  if (!checkPermission("pinball_map.view", accessLevel)) {
    return err("UNAUTHORIZED", "Not authorized.");
  }

  const config = await getPinballMapConfig();
  if (!config.ok) return err("NOT_CONFIGURED", config.message);

  // Fetch PinPoint machines and PBM location machines in parallel
  const [allMachines, pbmResult] = await Promise.all([
    db.query.machines.findMany({
      columns: {
        id: true,
        name: true,
        initials: true,
        presenceStatus: true,
        pbmMachineId: true,
        pbmMachineName: true,
        pbmLocationMachineXrefId: true,
      },
    }),
    getLocationMachines(config.value.locationId),
  ]);

  if (!pbmResult.ok) {
    return err("API_ERROR", pbmResult.message);
  }

  const pbmMachines = pbmResult.value;

  // Build a set of PBM machine_ids currently at the location
  const pbmMachineIdSet = new Set(pbmMachines.map((m) => m.machine_id));
  // Track which PBM machines are matched to PinPoint machines
  const matchedPbmMachineIds = new Set<number>();

  const entries: PbmSyncEntry[] = allMachines.map((m) => {
    let syncStatus: PbmSyncStatus;
    const isOnFloor = m.presenceStatus === "on_the_floor";

    if (!m.pbmMachineId) {
      syncStatus = "not_linked";
    } else if (isOnFloor && pbmMachineIdSet.has(m.pbmMachineId)) {
      syncStatus = "in_sync";
      matchedPbmMachineIds.add(m.pbmMachineId);
    } else if (isOnFloor && !pbmMachineIdSet.has(m.pbmMachineId)) {
      syncStatus = "missing_from_pbm";
    } else if (!isOnFloor && pbmMachineIdSet.has(m.pbmMachineId)) {
      syncStatus = "extra_on_pbm";
      matchedPbmMachineIds.add(m.pbmMachineId);
    } else {
      // Not on floor, not on PBM — that's fine, in sync
      syncStatus = "in_sync";
      if (m.pbmMachineId && pbmMachineIdSet.has(m.pbmMachineId)) {
        matchedPbmMachineIds.add(m.pbmMachineId);
      }
    }

    return {
      machineId: m.id,
      machineName: m.name,
      machineInitials: m.initials,
      presenceStatus: m.presenceStatus,
      pbmMachineId: m.pbmMachineId,
      pbmMachineName: m.pbmMachineName,
      pbmLocationMachineXrefId: m.pbmLocationMachineXrefId,
      syncStatus,
    };
  });

  // Find PBM machines not matched to any PinPoint machine
  const extraOnPbm: PbmExtraMachine[] = pbmMachines
    .filter((pm) => !matchedPbmMachineIds.has(pm.machine_id))
    .map((pm) => ({
      xrefId: pm.id,
      machineId: pm.machine_id,
      name: pm.name,
      manufacturer: pm.manufacturer,
      year: pm.year,
    }));

  const summary = {
    inSync: entries.filter((e) => e.syncStatus === "in_sync").length,
    missingFromPbm: entries.filter((e) => e.syncStatus === "missing_from_pbm")
      .length,
    extraOnPbm: extraOnPbm.length,
    notLinked: entries.filter((e) => e.syncStatus === "not_linked").length,
  };

  return ok({ entries, extraOnPbm, summary });
}

/**
 * Update Pinball Map API credentials (admin only).
 */
export async function updatePbmConfigAction(
  _prevState:
    | Result<void, "UNAUTHORIZED" | "VALIDATION" | "SERVER">
    | undefined,
  formData: FormData
): Promise<Result<void, "UNAUTHORIZED" | "VALIDATION" | "SERVER">> {
  const auth = await getAuthenticatedUser();
  if (!auth) return err("UNAUTHORIZED", "Please log in.");

  const accessLevel = getAccessLevel(auth.profile.role);
  if (!checkPermission("pinball_map.config", accessLevel)) {
    return err("UNAUTHORIZED", "Only admins can manage PBM credentials.");
  }

  const rawData = {
    locationId: Number(formData.get("locationId")),
    userEmail: formData.get("userEmail"),
    userToken: formData.get("userToken"),
  };

  const parsed = updatePbmConfigSchema.safeParse(rawData);
  if (!parsed.success) {
    return err(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid input"
    );
  }

  try {
    // Upsert: insert or update the single config row
    await db
      .insert(pinballMapConfig)
      .values({
        id: 1,
        locationId: parsed.data.locationId,
        userEmail: parsed.data.userEmail,
        userToken: parsed.data.userToken,
      })
      .onConflictDoUpdate({
        target: pinballMapConfig.id,
        set: {
          locationId: parsed.data.locationId,
          userEmail: parsed.data.userEmail,
          userToken: parsed.data.userToken,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/pinball-map");
    return ok(undefined);
  } catch (error) {
    log.error(
      { error, action: "updatePbmConfigAction" },
      "Failed to update PBM config"
    );
    return err("SERVER", "Failed to save credentials. Please try again.");
  }
}
