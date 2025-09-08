/**
 * PGlite Test Database Setup - Database Initialization Fixes (TASK_003)
 *
 * Creates PGlite in-memory PostgreSQL databases with proper initialization order:
 * 1. Apply migrations (create tables)
 * 2. Verify tables exist
 * 3. Configure for business logic testing
 * 4. Seed sample data
 *
 * This addresses systematic database initialization failures that prevent
 * integration tests from running. Implements TASK_003 specifications.
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
import { pushSchema } from "drizzle-kit/api";
import { createDrizzle } from "~/server/db/client-factory";

import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "~/server/db/schema";

export type TestDatabase = PgliteDatabase<typeof schema>;

// Removed: No longer needed since we use actual migration files

/**
 * Apply database schema to create all tables from Drizzle definitions
 * STEP 1 of TASK_003: Create tables → Verify → Configure → Seed
 */
async function applyDrizzleSchema(db: TestDatabase): Promise<void> {
  console.log("[DB_INIT] Applying Drizzle schema to create tables...");

  try {
    // Use pushSchema from drizzle-kit/api to apply schema definitions
    const { apply } = await pushSchema(schema, db);
    await apply();

    console.log("[DB_INIT] ✅ Schema applied successfully");
  } catch (error) {
    console.error("[DB_INIT] ❌ Schema application failed:", error);
    throw new Error(
      `Database schema creation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Verify that all required tables were created by migrations
 * STEP 2 of TASK_003: Ensure tables exist before proceeding
 */
async function verifyMigrationComplete(db: TestDatabase): Promise<void> {
  console.log("[DB_INIT] Verifying migration completion...");

  const requiredTables = [
    "organizations",
    "users",
    "memberships",
    "roles",
    "permissions",
    "locations",
    "machines",
    "models",
    "issues",
    "priorities",
    "issue_statuses",
    "comments",
    "attachments",
    "upvotes",
    "collections",
    "notifications",
  ];

  for (const tableName of requiredTables) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = ${tableName} AND table_schema = 'public'
      `);

      if (Number(result.rows[0]?.count) === 0) {
        throw new Error(`Required table missing: ${tableName}`);
      }

      console.log(`[VERIFY] ✅ Table exists: ${tableName}`);
    } catch (error) {
      console.error(
        `[VERIFY] ❌ Table verification failed: ${tableName}`,
        error,
      );
      throw new Error(`Database setup incomplete: ${tableName} table missing`);
    }
  }

  console.log("[DB_INIT] ✅ All required tables verified");
}

// Removed: No longer needed since we use actual migration files

/**
 * Create a fresh PGlite test database with proper initialization order
 * TASK_003 Implementation: Migrate → Verify → Configure → (Seed handled by higher-level functions)
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  console.log("[DB_INIT] Creating PGlite instance...");
  const pgClient = new PGlite();
  const db = createDrizzle(pgClient, true) as TestDatabase;

  try {
    // STEP 1: Apply schema FIRST (create tables)
    await applyDrizzleSchema(db);

    // STEP 2: Verify tables exist before proceeding
    await verifyMigrationComplete(db);

    // STEP 3: Configure for business logic testing (disable RLS on existing tables)
    console.log("[DB_INIT] Configuring for business logic testing...");
    await configureForBusinessLogicTesting(db);

    console.log("[DB_INIT] ✅ Database setup complete");
    return db;
  } catch (error) {
    console.error("[DB_INIT] ❌ Database setup failed:", error);
    // Clean up on failure
    await pgClient.close();
    throw error;
  }
}

/**
 * Configure PGlite database for business logic testing
 * STEP 3 of TASK_003: Safe RLS configuration (only on existing tables)
 */
async function configureForBusinessLogicTesting(
  db: TestDatabase,
): Promise<void> {
  console.log("[RLS_CONFIG] Configuring PGlite for business logic testing...");

  try {
    // Set session variables for business logic testing
    await db.execute(sql.raw(`SET app.environment = 'test'`));
    await db.execute(sql.raw(`SET app.test_role = 'integration_tester'`));
    await db.execute(sql.raw(`SET app.bypass_rls = 'true'`));
    await db.execute(sql.raw(`SET app.test_mode = 'business_logic'`));

    // Set integration tester context for audit trails
    await db.execute(sql.raw(`SET app.current_user_id = 'integration_tester'`));
    await db.execute(
      sql.raw(`SET app.current_user_role = 'integration_tester'`),
    );
    await db.execute(
      sql.raw(`SET app.current_organization_id = 'test-organization'`),
    );
    await db.execute(
      sql.raw(`SET app.current_user_email = 'integration_tester@test.dev'`),
    );

    // Get list of existing tables with RLS enabled (SAFE APPROACH)
    const tablesWithRLS = await db.execute(sql`
      SELECT schemaname, tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = true
      ORDER BY tablename
    `);

    console.log(`[RLS_CONFIG] Tables with RLS: ${tablesWithRLS.rows.length}`);

    // Safely disable RLS on existing tables only
    let disabledCount = 0;
    for (const row of tablesWithRLS.rows) {
      try {
        const tableName = row.tablename as string;
        await db.execute(
          sql.raw(`ALTER TABLE ${tableName} DISABLE ROW LEVEL SECURITY`),
        );
        console.log(`[RLS_CONFIG] ✅ Disabled RLS on ${tableName}`);
        disabledCount++;
      } catch (error) {
        console.warn(
          `[RLS_CONFIG] ⚠️ RLS disable skipped for ${tableName}:`,
          (error as Error).message,
        );
        // Continue with other tables - this is not fatal for business logic testing
      }
    }

    console.log(
      `[RLS_CONFIG] ✅ RLS disabled on ${disabledCount} tables for business logic testing`,
    );
  } catch (error) {
    console.warn(
      "[RLS_CONFIG] ⚠️ Business logic configuration warning (continuing anyway):",
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

  // Seed infrastructure (dual organizations, permissions, roles, statuses)
  const organizations = await seedInfrastructureWithDb(db);

  // Note: Users and memberships now created by seed scripts

  // NOTE: No sample data seeding - tests create their own precise data

  return {
    db,
    organizationId: organizations.primary.id, // Default to primary for backward compatibility
    primaryOrgId: organizations.primary.id,
    secondaryOrgId: organizations.secondary.id,
  };
}

/**
 * Create a test database with infrastructure only (no sample data)
 * For tests that create their own data or work with minimal fixtures
 * Avoids sample data creation failures while providing necessary infrastructure
 */
export async function createInfrastructureOnlyTestDatabase(): Promise<{
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
  // Seed only infrastructure (dual organizations, permissions, roles, statuses)
  const organizations = await seedInfrastructureWithDb(db);
  return {
    db,
    organizationId: organizations.primary.id, // Default to primary for backward compatibility
    primaryOrgId: organizations.primary.id,
    secondaryOrgId: organizations.secondary.id,
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
    return result.rows?.[0]?.test_role ?? null;
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
    process.env.DATABASE_URL ??
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
