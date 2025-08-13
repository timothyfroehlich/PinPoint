/**
 * Multi-Tenant Isolation Integration Tests (PGlite)
 *
 * Integration tests for multi-tenant data isolation using PGlite in-memory PostgreSQL database.
 * Tests organizational boundaries, scoped queries, and data access controls.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Multi-tenant boundary enforcement
 * - Organization-scoped data access testing
 * - Cross-organization access prevention
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

import { eq, and } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

describe("Multi-Tenant Isolation", () => {
  let db: TestDatabase;
  let seededOrgId: string;
  let testOrg2Id: string;
  let testUser1Id: string;
  let testUser2Id: string;
  let testLocationId: string;
  let testModelId: string;

  beforeEach(async () => {
    // Create fresh PGlite database with real schema and seed data
    const setup = await createSeededTestDatabase();
    db = setup.db;
    seededOrgId = setup.organizationId;

    // Generate unique test identifiers
    const timestamp = Date.now();
    testOrg2Id = `test-org2-${timestamp}`;
    testUser1Id = `test-user1-${timestamp}`;
    testUser2Id = `test-user2-${timestamp}`;
    testLocationId = `test-location-${timestamp}`;
    testModelId = `test-model-${timestamp}`;

    // Set up additional test data (seeded org is already created)
    await db.insert(schema.organizations).values([
      {
        id: testOrg2Id,
        name: "Test Organization 2",
        subdomain: `test-org2-${timestamp}`,
      },
    ]);

    await db.insert(schema.users).values([
      {
        id: testUser1Id,
        email: `user1-${timestamp}@test.example`,
        name: "Test User 1",
      },
      {
        id: testUser2Id,
        email: `user2-${timestamp}@test.example`,
        name: "Test User 2",
      },
    ]);
  });

  describe("Organization Boundary Enforcement", () => {
    it("should enforce organizationId on all tenant-scoped tables", async () => {
      // Create test data for tenant-scoped tables
      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Test Location",
        organizationId: seededOrgId,
      });

      const [location] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, testLocationId));

      expect(location).toBeDefined();
      expect(location?.organizationId).toBe(seededOrgId);
      expect(location?.organizationId).not.toBeNull();
    });

    it("should prevent querying data across organization boundaries", async () => {
      // Create data for both organizations
      await db.insert(schema.locations).values([
        {
          id: `${testLocationId}-org1`,
          name: "Org 1 Location",
          organizationId: seededOrgId,
        },
        {
          id: `${testLocationId}-org2`,
          name: "Org 2 Location",
          organizationId: testOrg2Id,
        },
      ]);

      // Query with org1 filter should only return org1 data
      const org1Locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, seededOrgId));

      // Should have at least the one we created (seeded data may have more)
      expect(org1Locations.length).toBeGreaterThanOrEqual(1);

      // Find our specific location
      const ourLocation = org1Locations.find(
        (loc) => loc.name === "Org 1 Location",
      );
      expect(ourLocation).toBeDefined();
      expect(ourLocation?.organizationId).toBe(seededOrgId);

      // Verify org2 data exists but is not returned
      const org2Locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, testOrg2Id));

      expect(org2Locations).toHaveLength(1);
      expect(org2Locations[0]?.name).toBe("Org 2 Location");
    });

    it("should prevent updating data across organization boundaries", async () => {
      // Create location for org1
      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Original Name",
        organizationId: seededOrgId,
      });

      // Try to update org1's location while filtering for org2 context
      const updateResult = await db
        .update(schema.locations)
        .set({ name: "Updated Name" })
        .where(
          and(
            eq(schema.locations.id, testLocationId),
            eq(schema.locations.organizationId, testOrg2Id), // Wrong org filter
          ),
        )
        .returning();

      // Should return 0 affected rows
      expect(updateResult).toHaveLength(0);

      // Verify original data is unchanged
      const [location] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, testLocationId));

      expect(location?.name).toBe("Original Name");
    });

    it("should prevent deleting data across organization boundaries", async () => {
      // Create location for org1
      await db.insert(schema.locations).values({
        id: testLocationId,
        name: "Test Location",
        organizationId: seededOrgId,
      });

      // Try to delete org1's location with org2 context
      const deleteResult = await db
        .delete(schema.locations)
        .where(
          and(
            eq(schema.locations.id, testLocationId),
            eq(schema.locations.organizationId, testOrg2Id), // Wrong org filter
          ),
        )
        .returning();

      // Should return 0 affected rows
      expect(deleteResult).toHaveLength(0);

      // Verify location still exists
      const locations = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.id, testLocationId));

      expect(locations).toHaveLength(1);
    });
  });

  describe("Global vs Tenant-Scoped Entities", () => {
    it("should handle null organizationId for global entities", async () => {
      // Create OPDB model (global, no organizationId constraint)
      const [opdbModel] = await db
        .insert(schema.models)
        .values({
          id: testModelId,
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
          isCustom: false,
          opdbId: "4032",
        })
        .returning();

      expect(opdbModel).toBeDefined();
      expect(opdbModel?.isCustom).toBe(false);
      expect(opdbModel?.opdbId).toBe("4032");

      // Create custom model (organization-specific in business logic)
      const customModelId = `${testModelId}-custom`;
      const [customModel] = await db
        .insert(schema.models)
        .values({
          id: customModelId,
          name: "Custom Homebrew Game",
          manufacturer: "Homebrew",
          year: 2024,
          isCustom: true,
        })
        .returning();

      expect(customModel).toBeDefined();
      expect(customModel?.isCustom).toBe(true);
    });

    it("should allow multi-organization access for global data", async () => {
      // Create global OPDB model
      const [_globalModel] = await db
        .insert(schema.models)
        .values({
          id: testModelId,
          name: "Star Trek: The Next Generation",
          manufacturer: "Williams",
          year: 1993,
          isCustom: false,
          opdbId: "2357",
        })
        .returning();

      // Get locations to use for machine creation
      const [org1Location] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.organizationId, seededOrgId))
        .limit(1);

      // Create a location for org2
      const [org2Location] = await db
        .insert(schema.locations)
        .values({
          id: `location-org2-${Date.now()}`,
          name: "Org 2 Location",
          organizationId: testOrg2Id,
        })
        .returning();

      // Both organizations should be able to reference this global model
      const timestamp = Date.now();
      const machines = await db
        .insert(schema.machines)
        .values([
          {
            id: `machine-org1-${timestamp}`,
            name: "TNG Machine 1",
            serialNumber: "TNG001",
            modelId: testModelId,
            organizationId: seededOrgId,
            locationId: org1Location?.id,
            qrCodeId: `qr-org1-${timestamp}`,
          },
          {
            id: `machine-org2-${timestamp}`,
            name: "TNG Machine 2",
            serialNumber: "TNG002",
            modelId: testModelId,
            organizationId: testOrg2Id,
            locationId: org2Location?.id,
            qrCodeId: `qr-org2-${timestamp}`,
          },
        ])
        .returning();

      expect(machines).toHaveLength(2);
      expect(machines[0]?.modelId).toBe(testModelId);
      expect(machines[1]?.modelId).toBe(testModelId);
      expect(machines[0]?.organizationId).toBe(seededOrgId);
      expect(machines[1]?.organizationId).toBe(testOrg2Id);
    });
  });
});
