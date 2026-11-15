import "server-only";

import { and, count, inArray } from "drizzle-orm";
import { z } from "zod";

import { OPEN_STATUSES } from "~/lib/issues/status";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { getSiteUrl } from "~/lib/url";
import { db } from "~/server/db";
import { invitedUsers, issues, userProfiles } from "~/server/db/schema";

/**
 * `presence` takes a SET, not a single value (PP-u4ab.13).
 *
 * A single value cannot express the question the fleet linking pass (PP-h059)
 * actually runs on: "unlinked AND still plausibly in the collection". Without
 * it, `pinballmap: "unlinked"` also returns the cabinets that are `removed` or
 * `pending_arrival` — rows nobody will ever link, which therefore sit in every
 * page of that filter forever and hold `total` above zero permanently. The
 * model was left to notice and skip them by hand on each page.
 *
 * The single-value form is kept, not deprecated: it is what every existing
 * caller sends, and `presence: "off_the_floor"` stays the natural way to ask a
 * one-state question.
 *
 * `.min(1)` on the array is deliberate. An empty set would type-check, produce
 * `inArray(col, [])` — a predicate matching nothing — and hand back
 * `total: 0` for the whole collection, which reads as an authoritative "there
 * are none" rather than as the malformed filter it is (CORE-ARCH-012). Zod
 * rejects it instead.
 */
export const presenceFilterSchema = z.union([
  z.enum(VALID_MACHINE_PRESENCE_STATUSES),
  z.array(z.enum(VALID_MACHINE_PRESENCE_STATUSES)).min(1),
]);

export type PresenceFilter = z.infer<typeof presenceFilterSchema>;

export function resolvePresence(
  filter: PresenceFilter
): MachinePresenceStatus[] {
  return Array.isArray(filter) ? filter : [filter];
}

/** Absolute URL for a machine's detail page. */
export function machineUrl(initials: string): string {
  return `${getSiteUrl()}/m/${initials}`;
}

/** Absolute URL for an issue's detail page. */
export function issueUrl(machineInitials: string, issueNumber: number): string {
  return `${getSiteUrl()}/m/${machineInitials}/i/${issueNumber}`;
}

/**
 * Batch-resolve display names for a set of machines' owners (active or invited),
 * keyed by machine id. Two queries total regardless of machine count — never
 * emails (CORE-SEC-007). `null` when a machine has no owner.
 */
export async function getOwnerNamesByMachine(
  rows: readonly {
    id: string;
    ownerId: string | null;
    invitedOwnerId: string | null;
  }[]
): Promise<Map<string, string | null>> {
  const activeIds = [
    ...new Set(rows.flatMap((r) => (r.ownerId ? [r.ownerId] : []))),
  ];
  const invitedIds = [
    ...new Set(
      rows.flatMap((r) => (r.invitedOwnerId ? [r.invitedOwnerId] : []))
    ),
  ];

  const [activeRows, invitedRows] = await Promise.all([
    activeIds.length
      ? db.query.userProfiles.findMany({
          where: inArray(userProfiles.id, activeIds),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
    invitedIds.length
      ? db.query.invitedUsers.findMany({
          where: inArray(invitedUsers.id, invitedIds),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  // The generated column, not a re-concatenation — it is btrimmed, so a member
  // with no surname does not come back with a trailing space (PP-if48).
  const activeNames = new Map(activeRows.map((u) => [u.id, u.name]));
  const invitedNames = new Map(invitedRows.map((u) => [u.id, u.name]));

  return new Map(
    rows.map((r) => {
      const name = r.ownerId
        ? (activeNames.get(r.ownerId) ?? null)
        : r.invitedOwnerId
          ? (invitedNames.get(r.invitedOwnerId) ?? null)
          : null;
      return [r.id, name];
    })
  );
}

/**
 * Count open issues per machine (keyed by initials) in a single grouped query.
 * Machines with no open issues are simply absent from the map (caller defaults
 * to 0).
 */
export async function getOpenIssueCounts(
  initialsList: readonly string[]
): Promise<Map<string, number>> {
  if (initialsList.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      machineInitials: issues.machineInitials,
      openCount: count(),
    })
    .from(issues)
    .where(
      and(
        inArray(issues.machineInitials, [...initialsList]),
        inArray(issues.status, [...OPEN_STATUSES])
      )
    )
    .groupBy(issues.machineInitials);

  return new Map(rows.map((r) => [r.machineInitials, r.openCount]));
}
