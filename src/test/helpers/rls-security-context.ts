/**
 * RLS Security Context Helper
 *
 * Centralized helper to establish PostgreSQL session variables that RLS policies
 * depend on during integration tests. Use this to ensure database-level
 * multi-tenant boundaries are enforced consistently in tests.
 *
 * Security-test-architect guidance: set organization, user, and role context
 * via session variables before executing DB-dependent logic.
 */

import { sql } from "drizzle-orm";
import type { TestDatabase } from "./worker-scoped-db";

export interface RLSContext {
  organizationId: string;
  userId: string;
  userRole: string;
  userEmail?: string;
}

/**
 * Establish RLS session context, run the provided function, and return its result.
 *
 * Note: We don't RESET here. Tests run inside transactions via withIsolatedTest,
 * and SETs are transaction-scoped in Postgres, reverting on rollback.
 */
export async function withRLSSecurityContext<T>(
  db: TestDatabase,
  context: RLSContext,
  fn: (db: TestDatabase) => Promise<T>,
): Promise<T> {
  await db.execute(
    sql`SET app.current_organization_id = ${context.organizationId}`,
  );
  await db.execute(sql`SET app.current_user_id = ${context.userId}`);
  await db.execute(sql`SET app.current_user_role = ${context.userRole}`);

  if (context.userEmail) {
    await db.execute(sql`SET app.current_user_email = ${context.userEmail}`);
  }

  return await fn(db);
}

/**
 * Clear all RLS-related session variables to simulate an anonymous/unauthenticated user.
 */
export async function clearRLSSecurityContext(db: TestDatabase): Promise<void> {
  await db.execute(sql`RESET app.current_organization_id`);
  await db.execute(sql`RESET app.current_user_id`);
  await db.execute(sql`RESET app.current_user_role`);
  await db.execute(sql`RESET app.current_user_email`);
}
