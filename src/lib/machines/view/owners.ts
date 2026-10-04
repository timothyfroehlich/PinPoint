import "server-only";

import { inArray } from "drizzle-orm";
import type { DbTransaction } from "~/server/db";
import { invitedUsers, userProfiles } from "~/server/db/schema";

/** The owner filter value for machines with no owner. */
export const UNASSIGNED_OWNER_ID = "unassigned";
export const UNASSIGNED_OWNER_NAME = "Unassigned";
/**
 * The owner filter value for whoever is viewing (machine-views §4.2). It is
 * resolved per viewer when the filter runs, so one URL or Saved View means
 * each signed-in person's own machines, and nothing for anonymous visitors.
 */
export const ME_OWNER_ID = "me";
export const ME_OWNER_NAME = "Me";

// Postgres rejects a malformed uuid literal, so only UUID-shaped values are
// looked up; anything else cannot name a person.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The owner filter values among `ids` that still name someone, with their
 * display names: an account, an invited person, Unassigned, or Me when
 * `viewerId` names a signed-in viewer. An owner
 * value is valid whether or not that person owns anything on the Surface
 * being viewed, so a filter outside a tab's scope survives and matches
 * nothing there (list-views §10.14, §10.18). Names only, never emails
 * (CORE-SEC-007).
 */
export async function getExistingMachineViewOwners(
  tx: DbTransaction,
  ids: readonly string[],
  viewerId: string | null
): Promise<Map<string, string>> {
  const existing = new Map<string, string>();
  if (viewerId !== null && ids.includes(ME_OWNER_ID)) {
    existing.set(ME_OWNER_ID, ME_OWNER_NAME);
  }
  if (ids.includes(UNASSIGNED_OWNER_ID)) {
    existing.set(UNASSIGNED_OWNER_ID, UNASSIGNED_OWNER_NAME);
  }
  const personIds = [...new Set(ids)].filter((id) => UUID_PATTERN.test(id));
  if (personIds.length === 0) return existing;
  const [accounts, invited] = await Promise.all([
    tx
      .select({ id: userProfiles.id, name: userProfiles.name })
      .from(userProfiles)
      .where(inArray(userProfiles.id, personIds)),
    tx
      .select({ id: invitedUsers.id, name: invitedUsers.name })
      .from(invitedUsers)
      .where(inArray(invitedUsers.id, personIds)),
  ]);
  for (const person of [...accounts, ...invited]) {
    existing.set(person.id, person.name);
  }
  return existing;
}
