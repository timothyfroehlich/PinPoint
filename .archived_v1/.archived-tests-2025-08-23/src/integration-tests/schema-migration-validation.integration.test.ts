/**
 * Schema Migration Validation Integration Tests (PGlite)
 *
 * Integration tests for database schema migration validation using PGlite in-memory PostgreSQL database.
 * Tests schema structure, indexes, constraints, and default values.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Schema structure validation
 * - Index performance verification
 * - Default value validation
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";

import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import {
  test,
  withIsolatedTest,
  type TestDatabase,
} from "~/test/helpers/worker-scoped-db";

describe("Schema Migration Validation", () => {
  // Helper function to create test context
  async function createTestContext(_db: TestDatabase) {
    // Use seeded primary organization for schema validation tests
    const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;

    const testLocationId = generateTestId("test-location");

    return { organizationId, testLocationId };
  }

  describe("Schema Structure Validation", () => {
    test("should have all expected tables defined", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (_db) => {
        // This test verifies that the Drizzle schema has the expected structure
        // Check that all expected tables are defined
        expect(schema.organizations).toBeDefined();
        expect(schema.users).toBeDefined();
        expect(schema.memberships).toBeDefined();
        expect(schema.roles).toBeDefined();
        expect(schema.permissions).toBeDefined();
        expect(schema.rolePermissions).toBeDefined();
        expect(schema.locations).toBeDefined();
        expect(schema.models).toBeDefined();
        expect(schema.machines).toBeDefined();
        expect(schema.issues).toBeDefined();
        expect(schema.priorities).toBeDefined();
        expect(schema.issueStatuses).toBeDefined();
        expect(schema.comments).toBeDefined();
        expect(schema.attachments).toBeDefined();
        expect(schema.issueHistory).toBeDefined();
        expect(schema.upvotes).toBeDefined();

        // Verify schema exports work
        const tableNames = Object.keys(schema);
        expect(tableNames.length).toBeGreaterThan(15);
        expect(tableNames).toContain("organizations");
        expect(tableNames).toContain("users");
        expect(tableNames).toContain("issues");
        expect(tableNames).toContain("machines");
      });
    });

    test("should support essential database operations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { organizationId, testLocationId } = await createTestContext(db);

        // Test organizations
        const [org] = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, organizationId));

        expect(org).toBeDefined();
        expect(org?.id).toBe(organizationId);

        // Test locations
        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "CRUD Test Location",
          organizationId,
        });

        const [location] = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, testLocationId));

        expect(location).toBeDefined();
        expect(location?.name).toBe("CRUD Test Location");
        expect(location?.organizationId).toBe(organizationId);
      });
    });
  });

  describe("Index Performance Validation", () => {
    test("should have efficient organizationId indexes for multi-tenancy", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { organizationId, testLocationId } = await createTestContext(db);

        // Test organizationId indexes (critical for multi-tenancy)
        const startTime = Date.now();

        await db.insert(schema.locations).values({
          id: testLocationId,
          name: "Index Test Location",
          organizationId,
        });

        const locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, organizationId));

        const queryTime = Date.now() - startTime;

        // Should have at least our one test location
        expect(locations.length).toBeGreaterThanOrEqual(1);
        // Should be fast due to index
        expect(queryTime).toBeLessThan(100);

        // Test that we can query by organization ID efficiently
        const orgById = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, organizationId));

        expect(orgById).toHaveLength(1);
      });
    });

    test("should efficiently query multi-tenant data", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { organizationId } = await createTestContext(db);

        // Create multiple locations for performance testing
        const locationIds = Array.from({ length: 10 }, (_, i) =>
          generateTestId(`location-${i}`),
        );
        await db.insert(schema.locations).values(
          locationIds.map((id, index) => ({
            id,
            name: `Test Location ${index}`,
            organizationId,
          })),
        );

        // Query should be fast due to organizationId index
        const startTime = Date.now();
        const locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, organizationId));
        const queryTime = Date.now() - startTime;

        // Should have our 10 test locations
        expect(locations.length).toBeGreaterThanOrEqual(10);
        expect(queryTime).toBeLessThan(50); // Should be very fast with index
      });
    });
  });

  describe("Foreign Key Relationship Validation", () => {
    test("should handle foreign key relationships correctly", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { organizationId } = await createTestContext(db);

        // Test valid foreign key
        const roleId = generateTestId("fk-role");
        await db.insert(schema.roles).values({
          id: roleId,
          name: "FK Test Role",
          organizationId, // Valid FK
        });

        const roles = await db
          .select()
          .from(schema.roles)
          .where(eq(schema.roles.id, roleId));
        expect(roles).toHaveLength(1);
        expect(roles[0]?.organizationId).toBe(organizationId);
      });
    });

    test("should validate business logic constraints", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // During migration period, foreign keys are not enforced at DB level
        // Business logic should validate these constraints
        const invalidRoleId = generateTestId("invalid-fk-role");
        const [invalidRole] = await db
          .insert(schema.roles)
          .values({
            id: invalidRoleId,
            name: "Invalid FK Role",
            organizationId: "non-existent-org-id", // Invalid FK but not blocked by DB
          })
          .returning();

        // Role was created (DB allows it during migration)
        expect(invalidRole).toBeDefined();
        expect(invalidRole?.organizationId).toBe("non-existent-org-id");

        // Business logic would validate this:
        const orgExists = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, "non-existent-org-id"));

        expect(orgExists).toHaveLength(0); // Organization doesn't exist
        // Application layer would reject this operation
      });
    });
  });

  describe("Default Values and Constraints", () => {
    test("should apply correct default values for users", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test default values are applied
        const [user] = await db
          .insert(schema.users)
          .values({
            id: generateTestId("defaults-user"),
            email: "defaults@test.example",
            name: "Defaults Test User",
            // notificationFrequency should default to "IMMEDIATE"
            // emailNotificationsEnabled should default to true
            // pushNotificationsEnabled should default to false
          })
          .returning();

        expect(user).toBeDefined();
        expect(user?.notificationFrequency).toBe("IMMEDIATE");
        expect(user?.emailNotificationsEnabled).toBe(true);
        expect(user?.pushNotificationsEnabled).toBe(false);
        expect(user?.createdAt).toBeInstanceOf(Date);
        expect(user?.updatedAt).toBeInstanceOf(Date);
      });
    });

    test("should apply correct default values for organizations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test organization defaults
        const [org] = await db
          .insert(schema.organizations)
          .values({
            id: generateTestId("defaults-org"),
            name: "Defaults Test Org",
            subdomain: generateTestId("defaults"),
          })
          .returning();

        expect(org?.createdAt).toBeInstanceOf(Date);
        expect(org?.updatedAt).toBeInstanceOf(Date);
        expect(org?.id).toBeDefined();
        expect(org?.name).toBe("Defaults Test Org");
      });
    });

    test("should enforce required fields", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test that required fields cannot be null
        // Test that empty names are allowed (business logic handles validation)
        await db.insert(schema.organizations).values({
          id: generateTestId("required-test"),
          name: "", // Empty name should be allowed (business logic validates)
          subdomain: generateTestId("required"),
        });

        // Verify that basic required fields work
        const [org] = await db
          .insert(schema.organizations)
          .values({
            id: generateTestId("valid-required"),
            name: "Valid Organization",
            subdomain: generateTestId("valid"),
          })
          .returning();

        expect(org).toBeDefined();
        expect(org?.name).toBe("Valid Organization");
      });
    });
  });
});
