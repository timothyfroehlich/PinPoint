import "server-only";

import { inArray } from "drizzle-orm";
import type { DbTransaction } from "~/server/db";
import { invitedUsers, userProfiles } from "~/server/db/schema";
import {
  ME_PERSON_ID,
  ME_PERSON_NAME,
  UNASSIGNED_PERSON_ID,
  UNASSIGNED_PERSON_NAME,
} from "./url-state";

// Postgres rejects a malformed uuid literal, so only UUID-shaped values are
// looked up; anything else cannot name a person.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The person filter values among `ids` that still name someone, with their
 * display names: an account, an invited person, Unassigned, or Me when
 * `viewerId` names a signed-in viewer. A person value is valid whether or
 * not that person has anything on the Surface being viewed, so a filter
 * outside a tab's scope survives and matches nothing there (list-views
 * §10.14, §10.18). Names only, never emails (CORE-SEC-007).
 */
export async function getExistingPeople(
  tx: DbTransaction,
  ids: readonly string[],
  viewerId: string | null
): Promise<Map<string, string>> {
  const existing = new Map<string, string>();
  if (viewerId !== null && ids.includes(ME_PERSON_ID)) {
    existing.set(ME_PERSON_ID, ME_PERSON_NAME);
  }
  if (ids.includes(UNASSIGNED_PERSON_ID)) {
    existing.set(UNASSIGNED_PERSON_ID, UNASSIGNED_PERSON_NAME);
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
