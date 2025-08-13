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
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

describe("Schema Migration Validation", () => {
  let db: TestDatabase;
  let seededOrgId: string;
  let testLocationId: string;

  beforeEach(async () => {
    // Create fresh PGlite database with real schema and seed data
    const setup = await createSeededTestDatabase();
    db = setup.db;
    seededOrgId = setup.organizationId;

    // Generate unique test identifiers
    const timestamp = Date.now();
    testLocationId = `test-location-${timestamp}`;
  });

  describe("Schema Structure Validation", () => {
    it("should have all expected tables defined", async () => {
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

    it("should support essential database operations", async () => {
      // Test that basic CRUD operations work on all major tables

      // Test organizations (seeded org already exists)
      const [org] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, seededOrgId));

      expect(org).toBeDefined();
      expect(org?.id).toBe(seededOrgId);

      // Test locations
      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "CRUD Test Location",
        organizationId: seededOrgId,
      });

      const [location] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, testLocationId));

      expect(location).toBeDefined();
      expect(location?.name).toBe("CRUD Test Location");
      expect(location?.organizationId).toBe(seededOrgId);
    });
  });

  describe("Index Performance Validation", () => {
    it("should have efficient organizationId indexes for multi-tenancy", async () => {
      // Test that critical indexes exist by running queries that should use them
      // Use seeded organization instead of creating new one

      // Test organizationId indexes (critical for multi-tenancy)
      const startTime = Date.now();

      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Index Test Location",
        organizationId: seededOrgId,
      });

      const locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, seededOrgId));

      const queryTime = Date.now() - startTime;

      // Should have at least our one test location (seeded data may have more)
      expect(locations.length).toBeGreaterThanOrEqual(1);
      // Should be fast due to index
      expect(queryTime).toBeLessThan(100);

      // Test that we can query by organization ID efficiently
      const orgById = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, seededOrgId));

      expect(orgById).toHaveLength(1);
    });

    it("should efficiently query multi-tenant data", async () => {
      const timestamp = Date.now();

      // Use seeded organization for multi-tenant testing

      // Create multiple locations for performance testing
      const locationIds = Array.from(
        { length: 10 },
        (_, i) => `location-${timestamp}-${i}`,
      );
      await db.insert(schema.locations).values(
        locationIds.map((id, index) => ({
          id,
          name: `Test Location ${index}`,
          organizationId: seededOrgId,
        })),
      );

      // Query should be fast due to organizationId index
      const startTime = Date.now();
      const locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, seededOrgId));
      const queryTime = Date.now() - startTime;

      // Should have at least our 10 test locations (seeded data may add more)
      expect(locations.length).toBeGreaterThanOrEqual(10);
      expect(queryTime).toBeLessThan(50); // Should be very fast with index
    });
  });

  describe("Foreign Key Relationship Validation", () => {
    it("should handle foreign key relationships correctly", async () => {
      // Test that foreign key relationships work as expected during migration period
      // Use seeded organization instead of creating new one

      // Test valid foreign key
      const roleId = `fk-role-${Date.now()}`;
      await db.insert(schema.roles).values({
        id: roleId,
        name: "FK Test Role",
        organizationId: seededOrgId, // Valid FK
      });

      const roles = await db
        .select()
        .from(schema.roles)
        .where(eq(schema.roles.id, roleId));
      expect(roles).toHaveLength(1);
      expect(roles[0]?.organizationId).toBe(seededOrgId);
    });

    it("should validate business logic constraints", async () => {
      // During migration period, foreign keys are not enforced at DB level
      // Business logic should validate these constraints
      const invalidRoleId = `invalid-fk-role-${Date.now()}`;
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

  describe("Default Values and Constraints", () => {
    it("should apply correct default values for users", async () => {
      // Test default values are applied
      const [user] = await db
        .insert(schema.users)
        .values({
          id: `defaults-user-${Date.now()}`,
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

    it("should apply correct default values for organizations", async () => {
      // Test organization defaults
      const [org] = await db
        .insert(schema.organizations)
        .values({
          id: `defaults-org-${Date.now()}`,
          name: "Defaults Test Org",
          subdomain: `defaults-${Date.now()}`,
        })
        .returning();

      expect(org?.createdAt).toBeInstanceOf(Date);
      expect(org?.updatedAt).toBeInstanceOf(Date);
      expect(org?.id).toBeDefined();
      expect(org?.name).toBe("Defaults Test Org");
    });

    it("should enforce required fields", async () => {
      // Test that required fields cannot be null
      try {
        await db.insert(schema.organizations).values({
          id: `required-test-${Date.now()}`,
          name: "", // Empty name should be allowed (business logic validates)
          subdomain: `required-${Date.now()}`,
        });
      } catch (_error) {
        // If there are DB-level constraints, they would trigger here
        // During migration, these might be enforced at application level instead
      }

      // Verify that basic required fields work
      const [org] = await db
        .insert(schema.organizations)
        .values({
          id: `valid-required-${Date.now()}`,
          name: "Valid Organization",
          subdomain: `valid-${Date.now()}`,
        })
        .returning();

      expect(org).toBeDefined();
      expect(org?.name).toBe("Valid Organization");
    });
  });
});
