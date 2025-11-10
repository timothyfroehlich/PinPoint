import { sql } from "drizzle-orm";

import type { DrizzleClient } from "~/server/db/drizzle";

/**
 * Bind organization context to the current transaction for RLS policies.
 * Must be executed within a transaction to avoid leaking session state.
 */
export async function bindRLSContext(
  tx: DrizzleClient,
  organizationId: string,
): Promise<void> {
  try {
    // PostgreSQL doesn't allow parameters in DDL commands like SET LOCAL
    // We need to use sql.raw() with proper escaping for security
    await tx.execute(
      sql.raw(
        `SET LOCAL app.current_organization_id = '${organizationId.replace(/'/g, "''")}'`,
      ),
    );
  } catch (error) {
    console.error("Failed to set RLS organization context:", error);
    throw new Error(
      `Failed query: SET LOCAL app.current_organization_id = '${organizationId}'`,
    );
  }
}

/**
 * Execute a function within an RLS-bound transaction for the given organization.
 * Ensures the entire operation runs with the correct organization context.
 */
export async function withOrgRLS<T>(
  db: DrizzleClient,
  organizationId: string,
  fn: (tx: DrizzleClient) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await bindRLSContext(tx as unknown as DrizzleClient, organizationId);
    return await fn(tx as unknown as DrizzleClient);
  });
}
