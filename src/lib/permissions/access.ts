/**
 * Server-only permission access helpers.
 *
 * These helpers touch the database, so they live apart from the pure,
 * client-safe functions in `./helpers` (which are imported by client
 * components). Keeping the `db` import out of `./helpers` prevents the
 * server-only postgres client from leaking into the client bundle.
 */

import "server-only";

import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { type AccessLevel } from "./matrix";
import { getAccessLevel } from "./helpers";

/**
 * Resolve a user's access level by looking up their profile role.
 *
 * Returns `"unauthenticated"` when the user has no profile/role (matching
 * `getAccessLevel`'s handling of an undefined role).
 */
export async function getUserAccessLevel(userId: string): Promise<AccessLevel> {
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { role: true },
  });

  return getAccessLevel(userProfile?.role);
}
