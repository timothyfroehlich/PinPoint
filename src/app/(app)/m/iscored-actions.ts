"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getGameroomGames } from "~/lib/iscored/client";
import { isIscoredConfigured } from "~/lib/iscored/config";
import type { IscoredGame } from "~/lib/iscored/types";

export type GetIscoredGamesResult =
  { games: IscoredGame[] } | { error: string };

export interface GetIscoredGamesOptions {
  machineId?: string | null;
}

/**
 * Server action to retrieve the full gameroom games list from iScored.
 *
 * Auth-gated and permission-gated (CORE-SEC-001, CORE-ARCH-008): requires
 * machine creation or editing authorization (`machines.create` or `machines.edit`).
 * When editing an existing machine, passing `machineId` allows machine owners
 * with the member role to access the picker under `machines.edit` owner permissions.
 * Returns `{ games: IscoredGame[] }` on success, or `{ error: string }` on failure.
 */
export async function getIscoredGamesAction(
  options?: GetIscoredGamesOptions
): Promise<GetIscoredGamesResult> {
  const machineId = options?.machineId;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  if (!profile) {
    return { error: "User profile not found" };
  }

  const accessLevel = getAccessLevel(profile.role);
  const canCreate = checkPermission("machines.create", accessLevel);
  let canEdit = checkPermission("machines.edit", accessLevel);

  if (!canCreate && !canEdit && machineId) {
    try {
      const machine = await db.query.machines.findFirst({
        where: eq(machines.id, machineId),
        columns: { ownerId: true },
      });
      if (machine) {
        canEdit = checkPermission("machines.edit", accessLevel, {
          userId: user.id,
          machineOwnerId: machine.ownerId,
        });
      }
    } catch {
      // If DB lookup fails (e.g. invalid UUID format), treat as not found
    }
  }

  if (!canCreate && !canEdit) {
    return { error: "Permission denied" };
  }

  if (!isIscoredConfigured()) {
    return { error: "iScored is not configured" };
  }

  try {
    const games = await getGameroomGames();
    return { games };
  } catch {
    return { error: "Failed to fetch iScored games" };
  }
}
