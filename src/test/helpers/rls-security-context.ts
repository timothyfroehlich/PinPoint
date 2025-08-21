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
  // PGlite does not support parameterized SET statements. Use raw SQL with safe escaping.
  const esc = (v: string) => v.replace(/'/g, "''");

  await db.execute(
    `SET app.current_organization_id = '${esc(context.organizationId)}'`,
  );
  await db.execute(`SET app.current_user_id = '${esc(context.userId)}'`);
  await db.execute(`SET app.current_user_role = '${esc(context.userRole)}'`);

  if (context.userEmail) {
    await db.execute(`SET app.current_user_email = '${esc(context.userEmail)}'`);
  }

  return await fn(db);
}

/**
 * Clear all RLS session variables to simulate anonymous/unauthenticated context.
 */
export async function clearRLSSecurityContext(db: TestDatabase): Promise<void> {
  // Use plain strings to avoid any driver quirks
  await db.execute(`RESET app.current_organization_id`);
  await db.execute(`RESET app.current_user_id`);
  await db.execute(`RESET app.current_user_role`);
  await db.execute(`RESET app.current_user_email`);
}
