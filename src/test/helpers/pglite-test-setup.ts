/**
 * PGlite Test Database Setup
 *
 * Creates PGlite in-memory PostgreSQL databases with ACTUAL Drizzle schema.
 * Uses real schema definitions programmatically via drizzle-kit generation.
 *
 * Key Features:
 * - Uses actual Drizzle schema definitions (no sync issues)
 * - In-memory PostgreSQL with PGlite
 * - Schema generated from real definitions via drizzle-kit
 * - Transaction isolation for test cleanup
 * - Modern August 2025 patterns
 */

import { PGlite } from "@electric-sql/pglite";
import { sql, eq, and } from "drizzle-orm";
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
 * Create a fresh PGlite test database with real Drizzle schema applied
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const pgClient = new PGlite();
  const db = drizzle(pgClient, { schema });

  // Apply the real schema
  await applyDrizzleSchema(db);

  return db;
}

/**
 * Create minimal users for PostgreSQL-only testing
 * Enables issue creation which requires createdById references
 */
async function createMinimalUsersForTesting(
  db: TestDatabase,
  organizationId: string,
): Promise<void> {
  // Create users that match the sample data expectations for PostgreSQL-only mode
  const testUsers = [
    // Dev users for testing
    {
      id: "test-user-admin",
      email: "admin@dev.local",
      name: "Dev Admin",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "test-user-member",
      email: "member@dev.local",
      name: "Dev Member",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "test-user-player",
      email: "player@dev.local",
      name: "Dev Player",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // Pinball personalities that sample data references
    {
      id: "test-user-roger",
      email: "roger.sharpe@pinpoint.dev",
      name: "Roger Sharpe",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "test-user-gary",
      email: "gary.stern@pinpoint.dev",
      name: "Gary Stern",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "test-user-harry",
      email: "harry.williams@pinpoint.dev",
      name: "Harry Williams",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "test-user-escher",
      email: "escher.lefkoff@pinpoint.dev",
      name: "Escher Lefkoff",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "test-user-tim",
      email: "timfroehlich@pinpoint.dev",
      name: "Tim Froehlich",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.insert(schema.users).values(testUsers);

  // Create memberships linking users to organization
  const adminRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.organizationId, organizationId),
      eq(schema.roles.name, "Admin"),
    ),
  });

  const memberRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.organizationId, organizationId),
      eq(schema.roles.name, "Member"),
    ),
  });

  if (adminRole && memberRole) {
    await db.insert(schema.memberships).values([
      {
        id: "test-membership-admin",
        userId: "test-user-admin",
        organizationId,
        roleId: adminRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "test-membership-member",
        userId: "test-user-member",
        organizationId,
        roleId: memberRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "test-membership-player",
        userId: "test-user-player",
        organizationId,
        roleId: memberRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "test-membership-roger",
        userId: "test-user-roger",
        organizationId,
        roleId: adminRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "test-membership-gary",
        userId: "test-user-gary",
        organizationId,
        roleId: memberRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "test-membership-harry",
        userId: "test-user-harry",
        organizationId,
        roleId: memberRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "test-membership-escher",
        userId: "test-user-escher",
        organizationId,
        roleId: memberRole.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "test-membership-tim",
        userId: "test-user-tim",
        organizationId,
        roleId: adminRole.id, // Make Tim an admin
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  if (!process.env.VITEST) {
    console.log("[TEST] Created minimal users for PostgreSQL-only testing");
  }
}

/**
 * Create a test database with complete seed data using production seeds
 * This is the main entry point for integration tests
 */
export async function createSeededTestDatabase(): Promise<{
  db: TestDatabase;
  organizationId: string;
}> {
  const db = await createTestDatabase();

  // Use production seed functions directly (same as CI)
  const { seedInfrastructureWithDb } = await import(
    "../../../scripts/seed/shared/infrastructure"
  );
  const { seedSampleDataWithDb } = await import(
    "../../../scripts/seed/shared/sample-data"
  );

  // Seed infrastructure (organizations, permissions, roles, statuses)
  const organization = await seedInfrastructureWithDb(db);

  // Create minimal users for PostgreSQL-only mode so issues can be created
  await createMinimalUsersForTesting(db, organization.id);

  // Seed sample data with minimal dataset and skipAuthUsers = false (now that we have users)
  await seedSampleDataWithDb(db, organization.id, "minimal", false);

  return {
    db,
    organizationId: organization.id,
  };
}

/**
 * Query actual seeded IDs from the database
 * Replaces hardcoded TEST_IDS with real data from production seeds
 */
export async function getSeededTestData(
  db: TestDatabase,
  organizationId: string,
): Promise<{
  organization: string;
  location: string | undefined;
  machine: string | undefined;
  model: string | undefined;
  priority: string | undefined;
  status: string | undefined;
  issue: string | undefined;
  adminRole: string | undefined;
  memberRole: string | undefined;
  user: string | undefined;
}> {
  // Get the first location
  const location = await db.query.locations.findFirst({
    where: eq(schema.locations.organizationId, organizationId),
  });

  // Get the first machine
  const machine = await db.query.machines.findFirst({
    where: eq(schema.machines.organizationId, organizationId),
  });

  // Get the first model
  const model = await db.query.models.findFirst();

  // Get the first priority
  const priority = await db.query.priorities.findFirst({
    where: eq(schema.priorities.organizationId, organizationId),
  });

  // Get the first status
  const status = await db.query.issueStatuses.findFirst({
    where: eq(schema.issueStatuses.organizationId, organizationId),
  });

  // Get the first issue
  const issue = await db.query.issues.findFirst({
    where: eq(schema.issues.organizationId, organizationId),
  });

  // Get admin role
  const adminRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.organizationId, organizationId),
      eq(schema.roles.name, "Admin"),
    ),
  });

  // Get member role
  const memberRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.organizationId, organizationId),
      eq(schema.roles.name, "Member"),
    ),
  });

  // Get a consistent test user (prefer admin for permissions)
  const userId = machine?.ownerId ?? issue?.createdById ?? "test-user-admin";

  return {
    organization: organizationId,
    location: location?.id,
    machine: machine?.id,
    model: model?.id,
    priority: priority?.id,
    status: status?.id,
    issue: issue?.id,
    adminRole: adminRole?.id,
    memberRole: memberRole?.id,
    user: userId,
  };
}

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
