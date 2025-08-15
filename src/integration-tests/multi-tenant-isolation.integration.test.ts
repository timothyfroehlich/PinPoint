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
import { describe, expect } from "vitest";

import * as schema from "~/server/db/schema";
import {
  generateTestId,
  generateTestEmail,
} from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

describe("Multi-Tenant Isolation", () => {
  describe("Organization Boundary Enforcement", () => {
    test("should enforce organizationId on all tenant-scoped tables", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const location1Id = generateTestId("location1");

        // Set up test organizations
        await db.insert(schema.organizations).values({
          id: org1Id,
          name: "Test Organization 1",
          subdomain: generateTestId("org1-subdomain"),
        });

        // Create test data for tenant-scoped tables
        await db.insert(schema.locations).values({
          id: location1Id,
          name: "Test Location",
          organizationId: org1Id,
        });

        const [location] = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, location1Id));

        expect(location).toBeDefined();
        expect(location?.organizationId).toBe(org1Id);
        expect(location?.organizationId).not.toBeNull();
      });
    });

    test("should prevent querying data across organization boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");

        // Set up test organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        // Create data for both organizations
        await db.insert(schema.locations).values([
          {
            id: generateTestId("location-org1"),
            name: "Org 1 Location",
            organizationId: org1Id,
          },
          {
            id: generateTestId("location-org2"),
            name: "Org 2 Location",
            organizationId: org2Id,
          },
        ]);

        // Query with org1 filter should only return org1 data
        const org1Locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, org1Id));

        // Should have exactly the one we created
        expect(org1Locations).toHaveLength(1);

        // Find our specific location
        const ourLocation = org1Locations.find(
          (loc) => loc.name === "Org 1 Location",
        );
        expect(ourLocation).toBeDefined();
        expect(ourLocation?.organizationId).toBe(org1Id);

        // Verify org2 data exists but is not returned
        const org2Locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.organizationId, org2Id));

        expect(org2Locations).toHaveLength(1);
        expect(org2Locations[0]?.name).toBe("Org 2 Location");
      });
    });

    test("should prevent updating data across organization boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");
        const location1Id = generateTestId("location1");

        // Set up test organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        // Create location for org1
        await db.insert(schema.locations).values({
          id: location1Id,
          name: "Original Name",
          organizationId: org1Id,
        });

        // Try to update org1's location while filtering for org2 context
        const updateResult = await db
          .update(schema.locations)
          .set({ name: "Updated Name" })
          .where(
            and(
              eq(schema.locations.id, location1Id),
              eq(schema.locations.organizationId, org2Id), // Wrong org filter
            ),
          )
          .returning();

        // Should return 0 affected rows
        expect(updateResult).toHaveLength(0);

        // Verify original data is unchanged
        const [location] = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, location1Id));

        expect(location?.name).toBe("Original Name");
      });
    });

    test("should prevent deleting data across organization boundaries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");
        const location1Id = generateTestId("location1");

        // Set up test organizations
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        // Create location for org1
        await db.insert(schema.locations).values({
          id: location1Id,
          name: "Test Location",
          organizationId: org1Id,
        });

        // Try to delete org1's location with org2 context
        const deleteResult = await db
          .delete(schema.locations)
          .where(
            and(
              eq(schema.locations.id, location1Id),
              eq(schema.locations.organizationId, org2Id), // Wrong org filter
            ),
          )
          .returning();

        // Should return 0 affected rows
        expect(deleteResult).toHaveLength(0);

        // Verify location still exists
        const locations = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, location1Id));

        expect(locations).toHaveLength(1);
      });
    });
  });

  describe("Global vs Tenant-Scoped Entities", () => {
    test("should handle null organizationId for global entities", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const opdbModelId = generateTestId("opdb-model");
        const customModelId = generateTestId("custom-model");

        // Create OPDB model (global, no organizationId constraint)
        const [opdbModel] = await db
          .insert(schema.models)
          .values({
            id: opdbModelId,
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
    });

    test("should allow multi-organization access for global data", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Generate unique test identifiers
        const org1Id = generateTestId("org1");
        const org2Id = generateTestId("org2");
        const globalModelId = generateTestId("global-model");
        const user1Id = generateTestId("user1");

        // Set up test organizations and users
        await db.insert(schema.organizations).values([
          {
            id: org1Id,
            name: "Test Organization 1",
            subdomain: generateTestId("org1-subdomain"),
          },
          {
            id: org2Id,
            name: "Test Organization 2",
            subdomain: generateTestId("org2-subdomain"),
          },
        ]);

        await db.insert(schema.users).values({
          id: user1Id,
          email: generateTestEmail("user1"),
          name: "Test User 1",
        });

        // Create global OPDB model
        const [_globalModel] = await db
          .insert(schema.models)
          .values({
            id: globalModelId,
            name: "Star Trek: The Next Generation",
            manufacturer: "Williams",
            year: 1993,
            isCustom: false,
            opdbId: "2357",
          })
          .returning();

        // Create locations for both orgs
        const [org1Location] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("location-org1"),
            name: "Org 1 Location",
            organizationId: org1Id,
          })
          .returning();

        const [org2Location] = await db
          .insert(schema.locations)
          .values({
            id: generateTestId("location-org2"),
            name: "Org 2 Location",
            organizationId: org2Id,
          })
          .returning();

        // Both organizations should be able to reference this global model
        const machines = await db
          .insert(schema.machines)
          .values([
            {
              id: generateTestId("machine-org1"),
              name: "TNG Machine 1",
              serialNumber: "TNG001",
              modelId: globalModelId,
              organizationId: org1Id,
              locationId: org1Location?.id,
              ownerId: user1Id,
              qrCodeId: generateTestId("qr-org1"),
            },
            {
              id: generateTestId("machine-org2"),
              name: "TNG Machine 2",
              serialNumber: "TNG002",
              modelId: globalModelId,
              organizationId: org2Id,
              locationId: org2Location?.id,
              ownerId: user1Id,
              qrCodeId: generateTestId("qr-org2"),
            },
          ])
          .returning();

        expect(machines).toHaveLength(2);
        expect(machines[0]?.modelId).toBe(globalModelId);
        expect(machines[1]?.modelId).toBe(globalModelId);
        expect(machines[0]?.organizationId).toBe(org1Id);
        expect(machines[1]?.organizationId).toBe(org2Id);
      });
    });
  });
});
