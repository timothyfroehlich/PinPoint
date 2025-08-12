/**
 * Integration Test Seed Functions
 *
 * Production seed adapters for PGlite integration testing.
 * Uses ACTUAL production seed functions with realistic data from sample-issues.json.
 *
 * Key Features:
 * - 4 machines + 10 realistic issues (vs previous 1 machine + 1 issue)
 * - Uses production seedInfrastructure() and seedSampleData() functions
 * - No Supabase Auth dependencies (PostgreSQL-only mode)
 * - Same seed logic as production for consistency
 * - Deterministic TEST_IDs preserved for compatibility
 */

import type { drizzle } from "drizzle-orm/pglite";

type TestDatabase = ReturnType<typeof drizzle>;

/**
 * Standard test data IDs - deterministic and consistent across tests
 */
export const TEST_IDS = {
  organization: "test-org-1",
  location: "test-location-1",
  model: "test-model-1",
  machine: "test-machine-1",
  priority: "test-priority-1",
  status: "test-status-1",
  issue: "test-issue-1",
  admin_role: "test-admin-role",
  member_role: "test-member-role",
} as const;

export interface TestOrganization {
  id: string;
  name: string;
  subdomain: string;
}

/**
 * Production seed infrastructure adapter
 * Wraps the production seedInfrastructure() function for PGlite usage
 */
async function seedProductionInfrastructure(
  db: TestDatabase,
): Promise<{ id: string; name: string; subdomain: string }> {
  // Dynamically import production seed function
  const { seedInfrastructureWithDb } = await import(
    "../../../scripts/seed/shared/infrastructure"
  );

  // Call production function with our PGlite database instance
  return await seedInfrastructureWithDb(db);
}

/**
 * Production sample data adapter
 * Wraps the production seedSampleData() function for PGlite usage
 */
async function seedProductionSampleData(
  db: TestDatabase,
  organizationId: string,
): Promise<void> {
  // Dynamically import production seed function
  const { seedSampleDataWithDb } = await import(
    "../../../scripts/seed/shared/sample-data"
  );

  // Call production function with minimal data and skipAuthUsers = true
  await seedSampleDataWithDb(db, organizationId, "minimal", true);
}

// Remove custom implementation - now using production seeds

// Remove custom implementation - now using production seeds

/**
 * Seed infrastructure for testing using PRODUCTION seed functions
 * Now uses the actual seedInfrastructure() from production for consistency
 */
export async function seedTestInfrastructure(
  db: TestDatabase,
): Promise<TestOrganization> {
  // Use production seed infrastructure function
  return await seedProductionInfrastructure(db);
}

/**
 * Seed sample data for testing using PRODUCTION seed functions
 * Now provides 4 machines + 10 realistic issues from sample-issues.json
 */
export async function seedTestSampleData(
  db: TestDatabase,
  organizationId: string,
): Promise<void> {
  // Use production seed sample data function with minimal dataset
  await seedProductionSampleData(db, organizationId);
}

/**
 * Complete test data setup - combines infrastructure and sample data
 * This is the main entry point for test setup
 */
export async function seedCompleteTestData(
  db: TestDatabase,
): Promise<TestOrganization> {
  const organization = await seedTestInfrastructure(db);
  await seedTestSampleData(db, organization.id);
  return organization;
}
