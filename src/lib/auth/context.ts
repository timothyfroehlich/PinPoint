/**
 * User authentication context utilities
 *
 * Helpers for fetching user context at server action boundaries.
 */

import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { type UserContext } from "~/lib/types";

/**
 * Fetch user context for RLS enforcement.
 *
 * @param userId - User ID from Supabase auth
 * @returns UserContext with role, or null if user not found
 *
 * @example
 * ```typescript
 * const supabase = await createClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * const userContext = await getUserContext(user.id);
 * ```
 */
export async function getUserContext(
  userId: string
): Promise<UserContext | null> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: { id: true, role: true },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    role: profile.role,
  };
}
