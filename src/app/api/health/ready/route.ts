/**
 * Health Check Endpoint - Database Readiness Verification
 *
 * Verifies that the database has been properly seeded with minimum required data.
 * Uses row count validation (no data exposure) with minimum thresholds.
 *
 * Security:
 * - Only available in development/test environments
 * - Does not expose actual database records
 * - Uses optimized SQL (single query with COUNT)
 *
 * Used by:
 * - Playwright E2E tests (e2e/global-setup.ts)
 * - Local development verification
 *
 * Returns:
 * - 200 OK when database meets minimum thresholds
 * - 503 Service Unavailable when seeding is incomplete
 * - 404 Not Found in production
 */

import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { env } from "~/env";
// Health check endpoint needs direct DB access for seeding verification (dev/test only)
// eslint-disable-next-line no-restricted-imports
import { getGlobalDatabaseProvider } from "~/server/db/provider";

/**
 * Minimum row counts for critical tables
 * Based on seed data in supabase/seeds/dev/
 */
const MINIMUM_THRESHOLDS = {
  organizations: 2, // dev/01-infrastructure.sql: APC + PinPoint
  users: 3, // dev/03-users.sql + scripts/create-dev-users.ts: Tim, Alice, Bob
  memberships: 3, // One per user
  roles: 6, // Global + org-specific roles
  priorities: 8, // Urgent, High, Medium, Low, etc.
  issue_statuses: 14, // Backlog, Todo, In Progress, Done, etc.
  machines: 7, // Various test machines
  issues: 10, // Sample issues for testing
} as const;

export async function GET(): Promise<NextResponse> {
  // Only available in development/test environments
  if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Health check not available in production" },
      { status: 404 },
    );
  }

  try {
    const db = getGlobalDatabaseProvider().getClient();

    // Single optimized query: count rows in all critical tables
    // Uses UNION ALL to combine results in one query
    const countResults = await db.execute<{ table: string; count: number }>(sql`
      SELECT 'organizations' AS table, COUNT(*)::int AS count FROM organizations
      UNION ALL
      SELECT 'users' AS table, COUNT(*)::int AS count FROM users
      UNION ALL
      SELECT 'memberships' AS table, COUNT(*)::int AS count FROM memberships
      UNION ALL
      SELECT 'roles' AS table, COUNT(*)::int AS count FROM roles
      UNION ALL
      SELECT 'priorities' AS table, COUNT(*)::int AS count FROM priorities
      UNION ALL
      SELECT 'issue_statuses' AS table, COUNT(*)::int AS count FROM issue_statuses
      UNION ALL
      SELECT 'machines' AS table, COUNT(*)::int AS count FROM machines
      UNION ALL
      SELECT 'issues' AS table, COUNT(*)::int AS count FROM issues
    `);

    // Convert results to lookup map
    const rows = Array.from(countResults);
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      // CodeQL [js/prototype-pollution-utility]: False positive - row.table is from controlled SQL query results
      acc[row.table] = row.count;
      return acc;
    }, {});

    // Check each table against minimum threshold
    // Return boolean only (not actual counts for security)
    const checks = Object.entries(MINIMUM_THRESHOLDS).reduce<
      Record<string, boolean>
    >((acc, [table, minCount]) => {
      const actualCount = counts[table] ?? 0;
      // CodeQL [js/prototype-pollution-utility]: False positive - table is from compile-time constant MINIMUM_THRESHOLDS
      acc[table] = actualCount >= minCount;
      return acc;
    }, {});

    // Database is ready if ALL checks pass
    const ready = Object.values(checks).every((passed) => passed);

    if (ready) {
      return NextResponse.json(
        {
          ready: true,
          checks,
          message: "Database is seeded and ready",
        },
        { status: 200 },
      );
    }

    // Not ready - provide check status for debugging
    return NextResponse.json(
      {
        ready: false,
        checks,
        message:
          "Database seeding incomplete - some tables below minimum thresholds",
      },
      { status: 503 },
    );
  } catch (error) {
    // Database connection error or query failure
    return NextResponse.json(
      {
        ready: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Database health check failed",
      },
      { status: 503 },
    );
  }
}
