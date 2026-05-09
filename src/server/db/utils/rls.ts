/**
 * RLS Context Utilities
 *
 * Provides session context binding used by integration tests to simulate
 * RLS-enforced database contexts.
 *
 * NOTE: App code does NOT enforce RLS via Drizzle. The Drizzle connection
 * user has BYPASSRLS, so RLS policies are never evaluated for application
 * queries. Authorization is handled by checkPermission() in server actions
 * per NON-NEGOTIABLE #14.
 *
 * Pattern based on September 2024 implementation (commit c52e7732).
 */

import { sql } from "drizzle-orm";
import { type Db, type Tx } from "~/server/db";
import { type UserRole } from "~/lib/types";

export interface UserContext {
  id: string;
  role: UserRole;
}

/**
 * Execute database operations with user context for RLS enforcement.
 *
 * Sets PostgreSQL session variables that RLS policies can check:
 * - request.user_id: Current user's UUID
 * - request.user_role: Current user's role (admin|member|guest)
 *
 * Used by integration tests to simulate RLS-enforced contexts. App code does NOT enforce
 * RLS via Drizzle (the connection user has BYPASSRLS); authorization is handled by
 * checkPermission() in server actions per NON-NEGOTIABLE #14.
 *
 * @example
 * ```typescript
 * export async function createIssueAction(formData: FormData) {
 *   const user = await getAuthenticatedUser();
 *   const userContext = await getUserContext(user.id);
 *
 *   return withUserContext(db, userContext, async (tx) => {
 *     return createIssue(tx, { ... });
 *   });
 * }
 * ```
 */
export async function withUserContext<T>(
  db: Db,
  user: UserContext,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set user context for RLS policies
    // Uses parameterized queries for SQL injection protection
    await tx.execute(
      sql`SELECT set_config('request.user_id', ${user.id}, true)`
    );
    await tx.execute(
      sql`SELECT set_config('request.user_role', ${user.role}, true)`
    );

    // Execute the query with context
    return await fn(tx);
  });
}
