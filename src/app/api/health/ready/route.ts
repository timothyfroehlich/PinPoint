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

import { NextResponse } from "next/server";

import { env } from "~/env";
import { getSeedCounts, computeReadiness } from "~/server/ops/health-readiness";

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
    const counts = await getSeedCounts();
    const checks = computeReadiness(counts, MINIMUM_THRESHOLDS);

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
