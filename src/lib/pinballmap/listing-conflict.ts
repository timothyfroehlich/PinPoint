import "server-only";
import { and, eq, ne } from "drizzle-orm";
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
 *
 * **Only the create paths use this.** They are the only writes that can violate
 * either constraint, so they have to tell the two apart. Every other listing
 * write touches listing columns alone, so it matches the bare `23505` instead:
 * `getPostgresErrorConstraint` returns `undefined` on a driver exposing neither
 * spelling, and narrowing there would put a correctable conflict back to a 500.
 * Create pays a different price for that same gap — with no constraint name it
 * falls through to the initials message, the very misdiagnosis this module
 * exists to remove. Both drivers we run on supply the field, so the asymmetry is
 * latent rather than live; closing it needs a "do these initials actually
 * collide?" lookup to pick the message, which is more machinery than a
 * hypothetical third driver currently justifies.
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
