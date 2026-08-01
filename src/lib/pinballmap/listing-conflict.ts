import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import {
  isPgErrorCode,
  getPostgresErrorConstraint,
} from "~/lib/db/postgres-errors";

/**
 * Recognising and explaining a duplicate-listing collision (PP-o355.15).
 *
 * Shared by every path that writes `pinballmapListed` — `createMachineAction`,
 * `updateMachineAction`, `linkPinballmapEntryAction`, and the verify/heal
 * transaction. They previously disagreed about what the same failure meant
 * (wrong message / no catch / `SERVER`), which is precisely the drift a single
 * implementation prevents.
 */

/**
 * Name of the partial unique index enforcing one PinballMap lister per catalog
 * title at our location (migration 0052). PBM's `POST /location_machine_xrefs`
 * is find-or-create on `(location_id, machine_id)`, so two cabinets of one title
 * physically cannot hold distinct lmx rows here.
 */
const PBM_LISTED_UNIQUE = "machines_pinballmap_listed_unique";

/**
 * True when a failed write is specifically a duplicate-listing collision.
 *
 * `machines` has TWO unique constraints — `machines_initials_unique` and the
 * partial listing index — and both raise SQLSTATE 23505. A bare code check
 * cannot tell them apart, which is why the machine write paths used to answer
 * every 23505 with "Initials are already taken".
 */
export function isPbmListingConflict(error: unknown): boolean {
  return (
    isPgErrorCode(error, "23505") &&
    getPostgresErrorConstraint(error) === PBM_LISTED_UNIQUE
  );
}

/**
 * Message for a duplicate-listing collision, naming the cabinet that already
 * holds the listing so the fix is obvious.
 *
 * This is a BACKSTOP. Once auto-link consumes `resolveListingHolder`
 * (PP-o355.20), that rule is the primary guard and stops us picking when
 * cabinets are indistinguishable; this catches what a race — or a hand-driven
 * "list this one" on both cabinets — can still slip through.
 */
export async function pbmListingConflictMessage(
  pinballmapMachineId: number | null | undefined
): Promise<string> {
  const incumbent =
    pinballmapMachineId == null
      ? undefined
      : await db.query.machines.findFirst({
          where: and(
            eq(machines.pinballmapMachineId, pinballmapMachineId),
            eq(machines.pinballmapListed, true)
          ),
          columns: { name: true, initials: true },
        });

  const holder = incumbent
    ? `${incumbent.name} (${incumbent.initials})`
    : "Another cabinet of this title";

  return `${holder} already holds the PinballMap listing for this title at our location. Only one cabinet per title can hold it — unlist that one first.`;
}
