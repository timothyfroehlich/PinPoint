/**
 * PinballMap linking — server actions for the create/edit catalog picker.
 *
 * Separated from the machine CRUD actions so the picker (a client component) can
 * import just the search action. The catalog is non-sensitive mirrored public
 * PBM data; the actual link mutation is matrix-gated (`machines.pinballmap.link`)
 * inside the create/edit actions.
 */

"use server";

import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { getAccessLevel } from "~/lib/permissions/helpers";
import { searchCatalog } from "~/lib/pinballmap/catalog";

/** Trimmed catalog row the picker renders (no OPDB/IPDB — derived server-side on save). */
export interface CatalogPick {
  pinballmapMachineId: number;
  name: string;
  manufacturer: string | null;
  year: number | null;
}

/**
 * Search the local PBM catalog mirror for the linking picker.
 *
 * Gated to authenticated member+ users (anyone who can reach a machine form —
 * creators are tech/admin, editors include member-owners). Returns `[]` for
 * unauthenticated/guest callers or a blank query rather than throwing, so the
 * picker degrades quietly.
 */
export async function searchPinballMapCatalogAction(
  query: string
): Promise<CatalogPick[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  const accessLevel = getAccessLevel(profile?.role);
  if (accessLevel === "unauthenticated" || accessLevel === "guest") return [];

  const rows = await searchCatalog(query);
  return rows.map((r) => ({
    pinballmapMachineId: r.pinballmapMachineId,
    name: r.name,
    manufacturer: r.manufacturer,
    year: r.year,
  }));
}
