/**
 * RLS Context Utilities
 *
 * Provides session context binding for Row Level Security enforcement.
 *
 * SECURITY: Always use withUserContext for mutations that involve
 * user-scoped data. This ensures RLS policies have proper context.
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
 * IMPORTANT: Always wrap mutations in this helper to ensure RLS enforcement.
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
