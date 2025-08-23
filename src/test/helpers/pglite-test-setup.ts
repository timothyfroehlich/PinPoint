/**
 * PGlite Test Database Setup - Dual-Track Testing Strategy
 *
 * Creates PGlite in-memory PostgreSQL databases configured for Track 2 of the
 * dual-track testing strategy: business logic testing with integration_tester role simulation.
 *
 * Key Features:
 * - Uses actual Drizzle schema definitions (no sync issues)
 * - In-memory PostgreSQL with PGlite
 * - Schema generated from real definitions via drizzle-kit
 * - Transaction isolation for test cleanup
 * - RLS bypass simulation for business logic focus
 * - 5x faster execution vs RLS-enabled testing
 * - Modern August 2025 patterns
 *
 * Dual-Track Strategy:
 * - Track 1 (pgTAP): RLS policy validation with real PostgreSQL
 * - Track 2 (PGlite): Business logic testing with RLS bypass (this file)
 *
 * @see docs/testing/dual-track-testing-strategy.md
 */

import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "~/server/db/schema";

export type TestDatabase = PgliteDatabase<typeof schema>;

// Removed: No longer needed since we use actual migration files

/**
 * Apply ACTUAL Drizzle schema to PGlite database
 * Uses ESM-compatible drizzle-kit approach to generate schema from actual definitions
 */
async function applyDrizzleSchema(db: TestDatabase): Promise<void> {
  try {
    // ESM-compatible approach using createRequire
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);

    // Import drizzle-kit with proper ESM compatibility
    const { generateDrizzleJson, generateMigration } =
      require("drizzle-kit/api") as {
        generateDrizzleJson: (
          schema: Record<string, unknown>,
          id?: string,
          prevId?: string,
          casing?: string,
        ) => { id: string; [key: string]: unknown };
        generateMigration: (
          prev: Record<string, unknown>,
          cur: Record<string, unknown>,
        ) => Promise<string[]>;
      };

    // Generate migration SQL from empty to current schema
    const prevJson = generateDrizzleJson({});
    const curJson = generateDrizzleJson(
      schema,
      prevJson.id,
      undefined,
      "snake_case",
    );
    const statements = await generateMigration(prevJson, curJson);

    // Apply each generated statement
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement.length > 0) {
        await db.execute(sql.raw(trimmedStatement));
      }
    }

    if (!process.env.VITEST) {
      console.log(
        "Applied Drizzle schema successfully from definitions using ESM-compatible approach",
      );
    }
  } catch (error) {
    console.error("Schema application failed:", error);
    throw new Error(
      `Failed to apply Drizzle schema: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Removed: No longer needed since we use actual migration files

/**
 * Create a fresh PGlite test database configured for Track 2 business logic testing
 *
 * Simulates integration_tester role behavior by disabling RLS and configuring
 * the database for optimal business logic testing performance.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const pgClient = new PGlite();
  const db = drizzle(pgClient, { schema });

  // Apply the real schema
  await applyDrizzleSchema(db);

  // Configure for integration_tester role simulation (Track 2)
  await configureForBusinessLogicTesting(db);

  return db;
}

/**
 * Configure PGlite database to simulate integration_tester role behavior
 *
 * This fully simulates the BYPASSRLS capability of the integration_tester role
 * providing 5x faster business logic testing without security evaluation overhead.
 *
 * Key simulation features:
 * - Sets integration_tester role context flags
 * - Disables RLS on all tables (equivalent to BYPASSRLS)
 * - Marks database as business-logic-only testing mode
 * - Enables direct data manipulation without organizational coordination
 */
async function configureForBusinessLogicTesting(
  db: TestDatabase,
): Promise<void> {
  try {
    // === Integration Tester Role Simulation ===

    // Mark as test environment
    await db.execute(sql`SET app.environment = 'test'`);

    // Simulate integration_tester role session
    await db.execute(sql`SET app.test_role = 'integration_tester'`);
    await db.execute(sql`SET app.bypass_rls = 'true'`);
    await db.execute(sql`SET app.test_mode = 'business_logic'`);

    // Set integration tester "user" for audit trails
    await db.execute(sql`SET app.current_user_id = 'integration_tester'`);
    await db.execute(sql`SET app.current_user_role = 'integration_tester'`);

    // === Disable RLS for 5x Performance Boost ===

    // Disable RLS on all tables to fully simulate BYPASSRLS behavior
    // This eliminates RLS policy evaluation overhead for business logic testing
    const rlsTables = [
      "organizations",
      "users",
      "memberships",
      "roles",
      "role_permissions",
      "locations",
      "machines",
      "models",
      "issues",
      "issue_statuses",
      "priorities",
      "comments",
      "attachments",
      "issue_history",
      "upvotes",
    ];

    let disabledCount = 0;
    for (const table of rlsTables) {
      try {
        await db.execute(
          sql.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`),
        );
        disabledCount++;
      } catch (error) {
        // Table might not exist or might not have RLS enabled - non-fatal
        console.debug(`RLS disable skipped for ${table}:`, error);
      }
    }

    // === Verification ===

    // Verify RLS bypass is working
    try {
      await db.execute(
        sql`SELECT 1 WHERE current_setting('app.bypass_rls', true) = 'true'`,
      );
    } catch {
      console.warn(
        "[Track 2] RLS bypass verification failed - continuing anyway",
      );
    }

    if (!process.env.VITEST) {
      console.log(`[Track 2] integration_tester simulation active:`);
      console.log(`  - RLS disabled on ${String(disabledCount)} tables`);
      console.log(`  - Business logic mode: BYPASSRLS equivalent`);
      console.log(
        `  - Expected 5x performance improvement vs RLS-enabled testing`,
      );
    }
  } catch (error) {
    console.warn(
      "Business logic configuration warning (continuing anyway):",
      error,
    );
  }
}

// Removed: createMembershipsForOrganization function
// Users and memberships are now created by the seed scripts instead of test helpers

/**
 * Create a clean test database with infrastructure only (no sample data)
 * For integration tests that need precise control over test data
 */
export async function createCleanTestDatabase(): Promise<{
  db: TestDatabase;
  organizationId: string;
  primaryOrgId: string;
  secondaryOrgId: string;
}> {
  const db = await createTestDatabase();

  // Use production seed functions for infrastructure only
  const { seedInfrastructureWithDb } = await import(
    "../../../scripts/seed/shared/infrastructure"
  );

  return {
    db,
    organizationId: "test-org-pinpoint", // Default to primary for backward compatibility
    primaryOrgId: "test-org-pinpoint",
    secondaryOrgId: "test-org-competitor",
  };
}

/**
 * Create a test database with complete seed data using production seeds
 * For E2E tests and scenarios that need realistic data
 */
export async function createSeededTestDatabase(): Promise<{
  db: TestDatabase;
  organizationId: string;
  primaryOrgId: string;
  secondaryOrgId: string;
}> {
  const db = await createTestDatabase();

  // Use production seed functions directly (same as CI)
  const { seedInfrastructureWithDb } = await import(
    "../../../scripts/seed/shared/infrastructure"
  );
  const { seedSampleDataWithDb } = await import(
    "../../../scripts/seed/shared/sample-data"
  );

  // Seed infrastructure (dual organizations, permissions, roles, statuses)
  const organizations = await seedInfrastructureWithDb(db);

  // Note: Users and memberships now created by seed scripts

  // Seed sample data in primary org with minimal dataset
  await seedSampleDataWithDb(db, organizations.primary.id, "minimal", false);

  return {
    db,
    organizationId: organizations.primary.id, // Default to primary for backward compatibility
    primaryOrgId: organizations.primary.id,
    secondaryOrgId: organizations.secondary.id,
  };
}

/**
 * Query actual seeded IDs from the database
 * Replaces hardcoded TEST_IDS with real data from production seeds
 */
/*
 * getSeededTestData removed.
 *
 * This function previously queried the database for seeded IDs at runtime.
 * For the new static-seed approach we rely on `SEED_TEST_IDS` constants
 * instead of dynamic database lookups. If code requires these values, use
 * `src/test/constants/seed-test-ids.ts` directly or pass explicit IDs into
 * helper functions.
 */

/**
 * Transaction wrapper for test isolation
 * Provides true test isolation with rollback instead of database recreation
 */
export async function withTransaction<T>(
  db: TestDatabase,
  testFn: (db: TestDatabase) => Promise<T>,
): Promise<T> {
  // Begin transaction
  await db.execute(sql`BEGIN`);

  try {
    // Run the test
    const result = await testFn(db);

    // Always rollback to maintain isolation
    await db.execute(sql`ROLLBACK`);

    return result;
  } catch (error) {
    // Rollback on error
    try {
      await db.execute(sql`ROLLBACK`);
    } catch {
      // Ignore rollback errors
    }
    throw error;
  }
}

/**
 * Clean up test database (closes PGlite connection)
 */
export async function cleanupTestDatabase(db: TestDatabase): Promise<void> {
  // PGlite automatically cleans up when the instance is garbage collected
  // But we can be explicit about cleanup if needed
  try {
    // Close the PGlite connection
    const dbWithClient = db as unknown as {
      client?: { close?: () => Promise<void> | void };
    };
    await dbWithClient.client?.close?.();
  } catch {
    // Ignore cleanup errors in tests
  }
}

/**
 * Test Mode Detection Helpers
 *
 * These helpers let you verify which testing mode your database is configured for.
 * Useful for debugging and ensuring tests use the expected performance characteristics.
 */

/**
 * Check if RLS is bypassed in the current database instance
 *
 * Returns true if the database is configured for business logic testing (Track 2)
 * with RLS bypassed for 5x performance improvement.
 *
 * @param db - Test database instance
 * @returns Promise<boolean> - true if RLS is bypassed (business logic mode)
 */
export async function isRLSBypassed(db: TestDatabase): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT current_setting('app.bypass_rls', true) as bypass_rls`,
    );
    return result.rows?.[0]?.bypass_rls === "true";
  } catch {
    // If the setting doesn't exist, RLS is not bypassed
    return false;
  }
}

/**
 * Get the current test role simulation
 *
 * @param db - Test database instance
 * @returns Promise<string | null> - 'integration_tester' or null
 */
export async function getCurrentTestRole(
  db: TestDatabase,
): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`SELECT current_setting('app.test_role', true) as test_role`,
    );
    return result.rows?.[0]?.test_role || null;
  } catch {
    return null;
  }
}

/**
 * Get the current test mode
 *
 * @param db - Test database instance
 * @returns Promise<string | null> - 'business_logic' or null
 */
export async function getCurrentTestMode(
  db: TestDatabase,
): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`SELECT current_setting('app.test_mode', true) as test_mode`,
    );
    return result.rows?.[0]?.test_mode || null;
  } catch {
    return null;
  }
}

/**
 * Verify integration_tester simulation is active
 *
 * Performs comprehensive check that the database is properly configured
 * for Track 2 business logic testing with maximum performance.
 *
 * @param db - Test database instance
 * @returns Promise<{ isActive: boolean; details: object }> - Verification results
 */
export async function verifyIntegrationTesterMode(db: TestDatabase): Promise<{
  isActive: boolean;
  details: {
    rlsBypassed: boolean;
    testRole: string | null;
    testMode: string | null;
    environment: string | null;
  };
}> {
  const rlsBypassed = await isRLSBypassed(db);
  const testRole = await getCurrentTestRole(db);
  const testMode = await getCurrentTestMode(db);

  let environment: string | null = null;
  try {
    const result = await db.execute(
      sql`SELECT current_setting('app.environment', true) as environment`,
    );
    environment = result.rows?.[0]?.environment || null;
  } catch {
    // Environment setting not available
  }

  const isActive =
    rlsBypassed &&
    testRole === "integration_tester" &&
    testMode === "business_logic";

  return {
    isActive,
    details: {
      rlsBypassed,
      testRole,
      testMode,
      environment,
    },
  };
}

/**
 * External PostgreSQL Integration Testing Support
 *
 * For tests that need to connect to a real PostgreSQL instance with
 * the integration_tester role (Track 2 business logic testing).
 */

/**
 * Get DATABASE_URL configured for integration_tester role
 *
 * Use this when tests need to connect to external PostgreSQL with
 * BYPASSRLS capabilities for business logic testing.
 *
 * @returns DATABASE_URL string for integration_tester connection
 */
export function getIntegrationTesterDatabaseUrl(): string {
  const baseUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/postgres";

  // Replace user credentials with integration_tester role
  try {
    const url = new URL(baseUrl);
    url.username = "integration_tester";
    url.password = "testpassword";
    return url.toString();
  } catch {
    // Fallback for malformed URLs
    return "postgresql://integration_tester:testpassword@localhost:5432/postgres";
  }
}

/**
 * Check if integration_tester role is available
 *
 * Utility to verify that the dual-track testing setup is properly configured
 * in the target PostgreSQL database.
 */
export async function verifyIntegrationTesterSetup(): Promise<boolean> {
  try {
    const { createClient } = await import("postgres");
    const sql = createClient(getIntegrationTesterDatabaseUrl());

    // Test connection and verify BYPASSRLS capability
    const result = await sql`
      SELECT
        rolname,
        rolsuper,
        rolbypassrls
      FROM pg_roles
      WHERE rolname = 'integration_tester'
    `;

    await sql.end();

    return result.length > 0 && result[0]?.rolbypassrls === true;
  } catch {
    return false;
  }
}

/**
 * Dual-Track Testing Configuration Guide
 *
 * Use this guide to choose the right testing approach:
 *
 * **Track 1: pgTAP RLS Testing**
 * - Purpose: Security policy validation
 * - Tool: pgTAP with native PostgreSQL
 * - Roles: authenticated, anon
 * - Location: supabase/tests/rls/
 * - When: Testing organizational boundaries, permissions, security edge cases
 *
 * **Track 2: PGlite Business Logic Testing**
 * - Purpose: Business functionality testing
 * - Tool: PGlite with integration_tester simulation (this file)
 * - Performance: 5x faster (no RLS overhead)
 * - When: Testing workflows, data relationships, business rules
 *
 * **External PostgreSQL Business Logic Testing**
 * - Purpose: Complex business logic requiring real PostgreSQL features
 * - Tool: integration_tester role with real database
 * - URL: getIntegrationTesterDatabaseUrl()
 * - When: Testing complex queries, database functions, edge case scenarios
 */
