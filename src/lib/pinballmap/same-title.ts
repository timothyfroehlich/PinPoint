import "server-only";

import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

import type { PbmIcIntent } from "./insider-connected";
import type { PbmSiblingInput } from "./listing-state";

/** One cabinet sharing a Pinball Map catalog title, as coverage reads it. */
export type SameTitleMachine = PbmSiblingInput & {
  icIntent: PbmIcIntent | null;
};

/**
 * Every cabinet sharing this catalog title, which decides Pinball Map coverage
 * (pinballmap spec §1, 4.7): coverage is what separates Covered (quiet) from
 * Lingering (out of sync). The machine Info and Manage tabs and the MCP
 * `get_machine` block all read it. Small by construction: the group is keyed
 * on one catalog title, so it is one cabinet in almost every case and a
 * handful in the worst.
 */
export async function getSameTitleMachines(
  pinballmapMachineId: number
): Promise<SameTitleMachine[]> {
  return db
    .select({
      id: machines.id,
      initials: machines.initials,
      name: machines.name,
      intent: machines.pinballmapIntent,
      icIntent: machines.pinballmapIcIntent,
    })
    .from(machines)
    .where(eq(machines.pinballmapMachineId, pinballmapMachineId));
}
