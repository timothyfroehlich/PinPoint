import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

/**
 * Explaining a duplicate-listing collision (PP-o355.15).
 *
 * The partial unique index `machines_pinballmap_listed_unique` (migration 0052)
 * enforces one PinballMap lister per catalog title at our location. PBM's
 * `POST /location_machine_xrefs` is find-or-create on `(location_id,
 * machine_id)`, so two cabinets of one title physically cannot hold distinct
 * lmx rows here.
 *
 * **Which writes can trip it.** Only a write that sets `pinballmap_listed` true
 * puts a row in that partial index, and since PP-o355.29 that is exclusively
 * the paths that talk to PBM: `linkPinballmapEntryAction` and the verify/heal
 * transaction. `createMachineAction` always writes the column false, so it can
 * only ever raise the *initials* 23505 and needs no disambiguation; the carry-
 * over in `updateMachineAction` re-writes a value the row already holds, which
 * cannot collide with itself. That is why this module no longer exports a
 * constraint-name matcher — the callers that needed one no longer exist, and
 * the surviving callers can match the bare code unambiguously. (Matching on the
 * name was also driver-dependent: postgres-js spells it `constraint_name`,
 * PGlite `constraint`, and a driver exposing neither would have downgraded a
 * correctable conflict to a 500.)
 */

/**
 * Message for a duplicate-listing collision, naming the cabinet that already
 * holds the listing so the fix is obvious.
 *
 * This is a BACKSTOP. Once auto-link consumes `resolveListingHolder`
 * (PP-o355.20), that rule is the primary guard and stops us picking when
 * cabinets are indistinguishable; this catches what a race — or a hand-driven
 * "list this one" on both cabinets — can still slip through.
 *
 * `excludeMachineId` is the machine the failed write was targeting, when the
 * caller has one. Without it the lookup can resolve the incumbent to that very
 * machine — the verify/heal path only ever runs on a machine that already holds
 * the listing — and the message then tells the operator to unlist the cabinet
 * they are looking at. The conflict is always with some OTHER row, so exclude
 * self and fall back to the generic phrasing when nothing else matches.
 */
export async function pbmListingConflictMessage(
  pinballmapMachineId: number | null | undefined,
  excludeMachineId?: string
): Promise<string> {
  const incumbent =
    pinballmapMachineId == null
      ? undefined
      : await db.query.machines.findFirst({
          where: and(
            eq(machines.pinballmapMachineId, pinballmapMachineId),
            eq(machines.pinballmapListed, true),
            ...(excludeMachineId === undefined
              ? []
              : [ne(machines.id, excludeMachineId)])
          ),
          columns: { name: true, initials: true },
        });

  const holder = incumbent
    ? `${incumbent.name} (${incumbent.initials})`
    : "Another cabinet of this title";

  return `${holder} already holds the PinballMap listing for this title at our location. Only one cabinet per title can hold it — unlist that one first.`;
}
