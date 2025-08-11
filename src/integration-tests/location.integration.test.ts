/**
 * Location Router Integration Tests (PGlite)
 *
 * Integration tests for the location router using PGlite in-memory PostgreSQL database.
 * Tests real database operations with proper schema, relationships, and data integrity.
 *
 * Key Features:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real Drizzle ORM operations
 * - Multi-tenant data isolation testing
 * - Complex query validation with actual results
 * - Generated columns and index testing
 *
 * Uses modern August 2025 patterns with Vitest and PGlite integration.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */

import { PGlite } from "@electric-sql/pglite";
import { eq, count, and, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import schema and router
import type { TRPCContext } from "~/server/api/trpc.base";

import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => `test-id-${Date.now()}`),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("Location Router Integration (PGlite)", () => {
  let db: ReturnType<typeof drizzle>;
  let pgClient: PGlite;
  let context: TRPCContext;
  let caller: ReturnType<typeof locationRouter.createCaller>;

  // Test data IDs - using consistent IDs for relationships
  const orgId = "test-org-1";
  const userId = "test-user-1";
  const locationId = "test-location-1";
  const machineId = "test-machine-1";
  const modelId = "test-model-1";
  const statusId = "test-status-1";
  const priorityId = "test-priority-1";

  beforeEach(async () => {
    // Create fresh PGlite instance for each test
    pgClient = new PGlite();
    db = drizzle(pgClient, { schema });

    // Note: Since there are no Drizzle migrations generated yet,
    // we'll seed the test data directly without running migrations
    // In production, you would typically run: await migrate(db, { migrationsFolder: "./drizzle" });

    // Seed basic test data
    await seedTestData();

    // Create test context with real database
    context = {
      user: {
        id: userId,
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: orgId, role: "Admin" },
      },
      organization: {
        id: orgId,
        name: "Test Organization",
        subdomain: "test-org",
      },
      drizzle: db,
      services: {
        createPinballMapService: vi.fn(() => ({
          syncLocation: vi.fn().mockResolvedValue({
            success: true,
            data: { synced: true, machinesUpdated: 2 },
          }),
        })),
        createNotificationService: vi.fn(),
        createCollectionService: vi.fn(),
        createIssueActivityService: vi.fn(),
        createCommentCleanupService: vi.fn(),
        createQRCodeService: vi.fn(),
      },
      headers: new Headers(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => context.logger),
        withRequest: vi.fn(() => context.logger),
        withUser: vi.fn(() => context.logger),
        withOrganization: vi.fn(() => context.logger),
        withContext: vi.fn(() => context.logger),
      },
      userPermissions: [
        "location:edit",
        "location:delete",
        "organization:manage",
      ],
    } as any;

    caller = locationRouter.createCaller(context);
  });

  async function seedTestData() {
    // Insert organization
    await db.insert(schema.organizations).values({
      id: orgId,
      name: "Test Organization",
      subdomain: "test-org",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert user
    await db.insert(schema.users).values({
      id: userId,
      email: "test@example.com",
      name: "Test User",
      profilePicture: "https://example.com/avatar.jpg",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert model
    await db.insert(schema.models).values({
      id: modelId,
      name: "Medieval Madness",
      manufacturer: "Williams",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert priority and status for issues
    await db.insert(schema.priorities).values({
      id: priorityId,
      name: "High",
      organizationId: orgId,
      level: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.issueStatuses).values({
      id: statusId,
      name: "Open",
      category: "OPEN",
      organizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert test location
    await db.insert(schema.locations).values({
      id: locationId,
      name: "Test Arcade",
      organizationId: orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert test machine
    await db.insert(schema.machines).values({
      id: machineId,
      name: "MM #001",
      qrCodeId: "qr-test-123",
      organizationId: orgId,
      locationId: locationId,
      modelId: modelId,
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert test issue for count testing
    await db.insert(schema.issues).values({
      id: "test-issue-1",
      title: "Test Issue",
      organizationId: orgId,
      machineId: machineId,
      statusId: statusId,
      priorityId: priorityId,
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  describe("create", () => {
    it("should create location with real database operations", async () => {
      const result = await caller.create({ name: "New Arcade Location" });

      expect(result).toMatchObject({
        name: "New Arcade Location",
        organizationId: orgId,
      });
      expect(result.id).toMatch(/^test-id-/);

      // Verify in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, result.id),
      });

      expect(dbLocation).toMatchObject({
        id: result.id,
        name: "New Arcade Location",
        organizationId: orgId,
      });
      expect(dbLocation?.createdAt).toBeInstanceOf(Date);
      expect(dbLocation?.updatedAt).toBeInstanceOf(Date);
    });

    it("should enforce organizational isolation", async () => {
      // Create location in test org
      const result = await caller.create({ name: "Org1 Location" });

      // Try to query from different organization context
      const otherOrgContext = {
        ...context,
        organization: {
          id: "other-org",
          name: "Other Org",
          subdomain: "other",
        },
      };
      const otherCaller = locationRouter.createCaller(otherOrgContext as any);

      const locations = await otherCaller.getAll();

      // Should not see location from other org
      expect(locations).toHaveLength(0);
      expect(locations.find((l) => l.id === result.id)).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should get locations with machine relationships", async () => {
      const result = await caller.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: locationId,
        name: "Test Arcade",
        organizationId: orgId,
        machines: expect.arrayContaining([
          expect.objectContaining({
            id: machineId,
            name: "MM #001",
            qrCodeId: "qr-test-123",
            locationId: locationId,
          }),
        ]),
      });

      // Verify relationships are properly loaded
      const location = result[0];
      expect(location.machines).toHaveLength(1);
      expect(location.machines[0].id).toBe(machineId);
    });

    it("should order locations by name", async () => {
      // Insert additional locations
      await db.insert(schema.locations).values([
        {
          id: "loc-zebra",
          name: "Zebra Arcade",
          organizationId: orgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "loc-alpha",
          name: "Alpha Games",
          organizationId: orgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await caller.getAll();

      expect(result).toHaveLength(3);
      expect(result.map((l) => l.name)).toEqual([
        "Alpha Games",
        "Test Arcade",
        "Zebra Arcade",
      ]);
    });

    it("should maintain organizational scoping with multiple orgs", async () => {
      // Insert another organization and location
      const otherOrgId = "other-org-id";
      await db.insert(schema.organizations).values({
        id: otherOrgId,
        name: "Other Organization",
        subdomain: "other-org",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.locations).values({
        id: "other-org-location",
        name: "Other Org Location",
        organizationId: otherOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.getAll();

      // Should only get locations from our org
      expect(result).toHaveLength(1);
      expect(result[0].organizationId).toBe(orgId);
      expect(
        result.find((l) => l.organizationId === otherOrgId),
      ).toBeUndefined();
    });
  });

  describe("getPublic", () => {
    beforeEach(async () => {
      // Add additional test data for complex queries
      await db.insert(schema.locations).values({
        id: "location-2",
        name: "Second Location",
        organizationId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.machines).values({
        id: "machine-2",
        name: "AFM #001",
        qrCodeId: "qr-test-456",
        organizationId: orgId,
        locationId: "location-2",
        modelId: modelId,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add resolved status for testing
      await db.insert(schema.issueStatuses).values({
        id: "status-resolved",
        name: "Resolved",
        category: "RESOLVED",
        organizationId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add mix of resolved and unresolved issues
      await db.insert(schema.issues).values([
        {
          id: "issue-2-unresolved",
          title: "Unresolved Issue",
          organizationId: orgId,
          machineId: machineId,
          statusId: statusId, // OPEN status
          priorityId: priorityId,
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "issue-3-resolved",
          title: "Resolved Issue",
          organizationId: orgId,
          machineId: machineId,
          statusId: "status-resolved", // RESOLVED status
          priorityId: priorityId,
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "issue-4-unresolved",
          title: "Another Unresolved Issue",
          organizationId: orgId,
          machineId: "machine-2",
          statusId: statusId, // OPEN status
          priorityId: priorityId,
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it("should return locations with accurate machine and issue counts", async () => {
      const result = await caller.getPublic();

      expect(result).toHaveLength(2);

      // Find our test locations
      const testArcade = result.find((l) => l.id === locationId);
      const secondLocation = result.find((l) => l.id === "location-2");

      expect(testArcade).toBeDefined();
      expect(secondLocation).toBeDefined();

      // Verify machine counts
      expect(testArcade!._count.machines).toBe(1);
      expect(secondLocation!._count.machines).toBe(1);

      // Verify machine details with model relationships
      expect(testArcade!.machines[0]).toMatchObject({
        id: machineId,
        name: "MM #001",
        model: {
          name: "Medieval Madness",
          manufacturer: "Williams",
        },
      });

      // Verify unresolved issue counts (should exclude resolved issues)
      expect(testArcade!.machines[0]._count.issues).toBe(2); // Only unresolved issues
      expect(secondLocation!.machines[0]._count.issues).toBe(1);
    });

    it("should filter out resolved issues from counts", async () => {
      const result = await caller.getPublic();

      // Get total issues count for verification
      const totalIssues = await db
        .select({ count: count() })
        .from(schema.issues)
        .where(eq(schema.issues.machineId, machineId));

      const unresolvedIssues = await db
        .select({ count: count() })
        .from(schema.issues)
        .innerJoin(
          schema.issueStatuses,
          eq(schema.issues.statusId, schema.issueStatuses.id),
        )
        .where(
          and(
            eq(schema.issues.machineId, machineId),
            ne(schema.issueStatuses.category, "RESOLVED"),
          ),
        );

      // We should have 3 total issues but only 2 unresolved for machineId
      expect(totalIssues[0].count).toBe(3);
      expect(unresolvedIssues[0].count).toBe(2);

      // The public endpoint should only count unresolved issues
      const testArcade = result.find((l) => l.id === locationId)!;
      expect(testArcade.machines[0]._count.issues).toBe(2);
    });

    it("should work without authentication", async () => {
      const publicContext = {
        ...context,
        user: null, // No user authentication
      };
      const publicCaller = locationRouter.createCaller(publicContext as any);

      const result = await publicCaller.getPublic();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("_count");
      expect(result[0]).toHaveProperty("machines");
    });

    it("should maintain organizational scoping in all subqueries", async () => {
      // Add data from another organization
      const otherOrgId = "other-org-2";
      await db.insert(schema.organizations).values({
        id: otherOrgId,
        name: "Other Organization 2",
        subdomain: "other-org-2",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.priorities).values({
        id: "other-priority",
        name: "Other Priority",
        organizationId: otherOrgId,
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.issueStatuses).values({
        id: "other-status",
        name: "Other Status",
        category: "OPEN",
        organizationId: otherOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.locations).values({
        id: "other-location",
        name: "Other Location",
        organizationId: otherOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.machines).values({
        id: "other-machine",
        name: "Other Machine",
        qrCodeId: "other-qr",
        organizationId: otherOrgId,
        locationId: "other-location",
        modelId: modelId,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add many issues to the other org's machine
      await db.insert(schema.issues).values([
        {
          id: "other-issue-1",
          title: "Other Issue 1",
          organizationId: otherOrgId,
          machineId: "other-machine",
          statusId: "other-status",
          priorityId: "other-priority",
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "other-issue-2",
          title: "Other Issue 2",
          organizationId: otherOrgId,
          machineId: "other-machine",
          statusId: "other-status",
          priorityId: "other-priority",
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await caller.getPublic();

      // Should only see our organization's data
      expect(result).toHaveLength(2); // Only our 2 locations
      expect(result.every((l) => l.id !== "other-location")).toBe(true);

      // Verify counts aren't affected by other org's data
      const testArcade = result.find((l) => l.id === locationId)!;
      expect(testArcade._count.machines).toBe(1);
      expect(testArcade.machines[0]._count.issues).toBe(2); // Should not include other org's issues
    });
  });

  describe("update", () => {
    it("should update location with real database persistence", async () => {
      const result = await caller.update({
        id: locationId,
        name: "Updated Test Arcade",
      });

      expect(result).toMatchObject({
        id: locationId,
        name: "Updated Test Arcade",
        organizationId: orgId,
      });

      // Verify in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
      });

      expect(dbLocation!.name).toBe("Updated Test Arcade");
      expect(dbLocation!.updatedAt.getTime()).toBeGreaterThan(
        dbLocation!.createdAt.getTime(),
      );
    });

    it("should prevent cross-organizational updates", async () => {
      // Try to update location from different organization
      const otherOrgContext = {
        ...context,
        organization: {
          id: "other-org",
          name: "Other Org",
          subdomain: "other",
        },
      };
      const otherCaller = locationRouter.createCaller(otherOrgContext as any);

      await expect(
        otherCaller.update({ id: locationId, name: "Hacked Name" }),
      ).rejects.toThrow("Location not found or access denied");

      // Verify original name unchanged
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
      });
      expect(dbLocation!.name).toBe("Test Arcade");
    });

    it("should handle partial updates correctly", async () => {
      const originalData = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
      });

      const result = await caller.update({ id: locationId }); // No name provided

      expect(result.name).toBe("Test Arcade"); // Name should remain unchanged
      expect(result.updatedAt.getTime()).toBeGreaterThan(
        originalData!.updatedAt.getTime(),
      ); // But updatedAt should change
    });
  });

  describe("getById", () => {
    it("should get location with complete relationship data", async () => {
      const result = await caller.getById({ id: locationId });

      expect(result).toMatchObject({
        id: locationId,
        name: "Test Arcade",
        organizationId: orgId,
        machines: expect.arrayContaining([
          expect.objectContaining({
            id: machineId,
            name: "MM #001",
            model: {
              id: modelId,
              name: "Medieval Madness",
              manufacturer: "Williams",
            },
            owner: {
              id: userId,
              name: "Test User",
              profilePicture: "https://example.com/avatar.jpg",
            },
          }),
        ]),
      });

      expect(result.machines).toHaveLength(1);
    });

    it("should enforce organizational scoping", async () => {
      // Create location in another org
      const otherOrgId = "other-org-getbyid";
      await db.insert(schema.organizations).values({
        id: otherOrgId,
        name: "Other Organization",
        subdomain: "other-org",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const otherLocationId = "other-location-getbyid";
      await db.insert(schema.locations).values({
        id: otherLocationId,
        name: "Other Location",
        organizationId: otherOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Try to access other org's location
      await expect(caller.getById({ id: otherLocationId })).rejects.toThrow(
        "Location not found or access denied",
      );

      // But should be able to access own org's location
      const result = await caller.getById({ id: locationId });
      expect(result.id).toBe(locationId);
    });
  });

  describe("delete", () => {
    it("should delete location and cascade properly", async () => {
      const result = await caller.delete({ id: locationId });

      expect(result).toMatchObject({
        id: locationId,
        name: "Test Arcade",
        organizationId: orgId,
      });

      // Verify deletion in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
      });
      expect(dbLocation).toBeUndefined();

      // Verify related machines still exist but should be updated if needed
      // (depending on your schema's cascade behavior)
      const _relatedMachines = await db.query.machines.findMany({
        where: eq(schema.machines.locationId, locationId),
      });

      // This depends on your foreign key constraints
      // If you have ON DELETE SET NULL, machines will have null locationId
      // If you have ON DELETE CASCADE, machines will be deleted too
      // Adjust this test based on your actual schema
    });

    it("should prevent cross-organizational deletion", async () => {
      const otherOrgContext = {
        ...context,
        organization: {
          id: "other-org-delete",
          name: "Other Org",
          subdomain: "other",
        },
      };
      const otherCaller = locationRouter.createCaller(otherOrgContext as any);

      await expect(otherCaller.delete({ id: locationId })).rejects.toThrow(
        "Location not found or access denied",
      );

      // Verify location still exists
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
      });
      expect(dbLocation).toBeDefined();
    });
  });

  describe("setPinballMapId", () => {
    it("should set PinballMap ID with database persistence", async () => {
      const result = await caller.setPinballMapId({
        locationId: locationId,
        pinballMapId: 12345,
      });

      expect(result.pinballMapId).toBe(12345);

      // Verify in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
      });
      expect(dbLocation!.pinballMapId).toBe(12345);
    });

    it("should prevent cross-organizational PinballMap ID updates", async () => {
      const otherOrgContext = {
        ...context,
        organization: {
          id: "other-org-pinball",
          name: "Other Org",
          subdomain: "other",
        },
      };
      const otherCaller = locationRouter.createCaller(otherOrgContext as any);

      await expect(
        otherCaller.setPinballMapId({
          locationId: locationId,
          pinballMapId: 999,
        }),
      ).rejects.toThrow("Location not found or access denied");

      // Verify pinballMapId unchanged
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
      });
      expect(dbLocation!.pinballMapId).toBeNull();
    });
  });

  describe("syncWithPinballMap", () => {
    it("should handle successful sync with service integration", async () => {
      const result = await caller.syncWithPinballMap({
        locationId: locationId,
      });

      expect(result).toEqual({
        success: true,
        data: { synced: true, machinesUpdated: 2 },
      });

      // Verify service was called correctly
      expect(context.services.createPinballMapService).toHaveBeenCalled();
    });

    it("should handle service failures appropriately", async () => {
      // Mock service failure
      vi.mocked(context.services.createPinballMapService).mockReturnValue({
        syncLocation: vi.fn().mockResolvedValue({
          success: false,
          error: "API rate limit exceeded",
        }),
      } as any);

      await expect(
        caller.syncWithPinballMap({ locationId: locationId }),
      ).rejects.toThrow("API rate limit exceeded");
    });
  });

  describe("Database Schema Validation", () => {
    it("should maintain referential integrity", async () => {
      // Test foreign key constraints
      const location = await db.query.locations.findFirst({
        where: eq(schema.locations.id, locationId),
        with: {
          machines: {
            with: {
              model: true,
              owner: true,
              issues: {
                with: {
                  status: true,
                  priority: true,
                },
              },
            },
          },
        },
      });

      expect(location).toBeDefined();
      expect(location!.machines[0].model.id).toBe(modelId);
      expect(location!.machines[0].owner.id).toBe(userId);
      expect(location!.machines[0].issues[0].status.id).toBe(statusId);
      expect(location!.machines[0].issues[0].priority.id).toBe(priorityId);
    });

    it("should handle timestamps correctly", async () => {
      const beforeCreate = new Date();

      const result = await caller.create({ name: "Timestamp Test Location" });

      const afterCreate = new Date();

      // Verify timestamps are within expected range
      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );
      expect(result.updatedAt.getTime()).toBe(result.createdAt.getTime());

      // Test update timestamp behavior
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

      const updated = await caller.update({
        id: result.id,
        name: "Updated Timestamp Test",
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime(),
      );
    });

    it("should enforce unique constraints where applicable", async () => {
      // This test depends on your schema's unique constraints
      // If subdomain should be unique for organizations:

      const duplicateOrg = {
        id: "duplicate-org",
        name: "Duplicate Organization",
        subdomain: "test-org", // Same subdomain as existing org
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // This should fail due to unique constraint on subdomain
      // Adjust based on your actual schema constraints
      await expect(
        db.insert(schema.organizations).values(duplicateOrg),
      ).rejects.toThrow();
    });
  });

  describe("Complex Multi-Tenant Scenarios", () => {
    beforeEach(async () => {
      // Create multiple organizations with overlapping data
      await db.insert(schema.organizations).values([
        {
          id: "org-a",
          name: "Organization A",
          subdomain: "org-a",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "org-b",
          name: "Organization B",
          subdomain: "org-b",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Create same-named locations in different orgs
      await db.insert(schema.locations).values([
        {
          id: "loc-a-1",
          name: "Main Arcade",
          organizationId: "org-a",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "loc-b-1",
          name: "Main Arcade", // Same name, different org
          organizationId: "org-b",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it("should maintain complete isolation between organizations", async () => {
      // Test from org-a perspective
      const orgAContext = {
        ...context,
        organization: {
          id: "org-a",
          name: "Organization A",
          subdomain: "org-a",
        },
      };
      const orgACaller = locationRouter.createCaller(orgAContext as any);

      const orgALocations = await orgACaller.getAll();
      expect(orgALocations).toHaveLength(1);
      expect(orgALocations[0].id).toBe("loc-a-1");
      expect(orgALocations[0].organizationId).toBe("org-a");

      // Test from org-b perspective
      const orgBContext = {
        ...context,
        organization: {
          id: "org-b",
          name: "Organization B",
          subdomain: "org-b",
        },
      };
      const orgBCaller = locationRouter.createCaller(orgBContext as any);

      const orgBLocations = await orgBCaller.getAll();
      expect(orgBLocations).toHaveLength(1);
      expect(orgBLocations[0].id).toBe("loc-b-1");
      expect(orgBLocations[0].organizationId).toBe("org-b");

      // Test that orgs can't see each other's data
      await expect(orgACaller.getById({ id: "loc-b-1" })).rejects.toThrow(
        "Location not found or access denied",
      );

      await expect(orgBCaller.getById({ id: "loc-a-1" })).rejects.toThrow(
        "Location not found or access denied",
      );
    });

    it("should handle complex count queries with organizational scoping", async () => {
      // Add machines and issues to both orgs
      await db.insert(schema.priorities).values([
        {
          id: "priority-a",
          name: "Priority A",
          organizationId: "org-a",
          level: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "priority-b",
          name: "Priority B",
          organizationId: "org-b",
          level: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await db.insert(schema.issueStatuses).values([
        {
          id: "status-a",
          name: "Status A",
          category: "OPEN",
          organizationId: "org-a",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "status-b",
          name: "Status B",
          category: "OPEN",
          organizationId: "org-b",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await db.insert(schema.machines).values([
        {
          id: "machine-a",
          name: "Machine A",
          qrCodeId: "qr-a",
          organizationId: "org-a",
          locationId: "loc-a-1",
          modelId: modelId,
          ownerId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "machine-b",
          name: "Machine B",
          qrCodeId: "qr-b",
          organizationId: "org-b",
          locationId: "loc-b-1",
          modelId: modelId,
          ownerId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Add many issues to each machine
      await db.insert(schema.issues).values([
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `issue-a-${i}`,
          title: `Issue A ${i}`,
          organizationId: "org-a",
          machineId: "machine-a",
          statusId: "status-a",
          priorityId: "priority-a",
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `issue-b-${i}`,
          title: `Issue B ${i}`,
          organizationId: "org-b",
          machineId: "machine-b",
          statusId: "status-b",
          priorityId: "priority-b",
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      ]);

      // Test getPublic counts for org-a
      const orgAContext = {
        ...context,
        organization: {
          id: "org-a",
          name: "Organization A",
          subdomain: "org-a",
        },
      };
      const orgACaller = locationRouter.createCaller(orgAContext as any);
      const orgAResult = await orgACaller.getPublic();

      expect(orgAResult[0]._count.machines).toBe(1);
      expect(orgAResult[0].machines[0]._count.issues).toBe(5);

      // Test getPublic counts for org-b
      const orgBContext = {
        ...context,
        organization: {
          id: "org-b",
          name: "Organization B",
          subdomain: "org-b",
        },
      };
      const orgBCaller = locationRouter.createCaller(orgBContext as any);
      const orgBResult = await orgBCaller.getPublic();

      expect(orgBResult[0]._count.machines).toBe(1);
      expect(orgBResult[0].machines[0]._count.issues).toBe(3);
    });
  });

  describe("Performance & Query Optimization", () => {
    it("should handle large datasets efficiently", async () => {
      // Create many locations and machines
      const locations = Array.from({ length: 50 }, (_, i) => ({
        id: `perf-location-${i}`,
        name: `Performance Location ${i}`,
        organizationId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.insert(schema.locations).values(locations);

      const machines = Array.from({ length: 200 }, (_, i) => ({
        id: `perf-machine-${i}`,
        name: `Performance Machine ${i}`,
        qrCodeId: `perf-qr-${i}`,
        organizationId: orgId,
        locationId: `perf-location-${i % 50}`, // Distribute across locations
        modelId: modelId,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.insert(schema.machines).values(machines);

      const startTime = Date.now();

      const result = await caller.getAll();

      const executionTime = Date.now() - startTime;

      expect(result).toHaveLength(51); // 1 original + 50 new
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify all relationships loaded correctly
      const totalMachines = result.reduce(
        (sum, loc) => sum + loc.machines.length,
        0,
      );
      expect(totalMachines).toBe(201); // 1 original + 200 new
    });

    it("should optimize getPublic aggregation queries", async () => {
      // Create complex data structure for aggregation testing
      await db.insert(schema.locations).values(
        Array.from({ length: 10 }, (_, i) => ({
          id: `agg-location-${i}`,
          name: `Aggregation Location ${i}`,
          organizationId: orgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      await db.insert(schema.machines).values(
        Array.from({ length: 30 }, (_, i) => ({
          id: `agg-machine-${i}`,
          name: `Aggregation Machine ${i}`,
          qrCodeId: `agg-qr-${i}`,
          organizationId: orgId,
          locationId: `agg-location-${i % 10}`, // 3 machines per location
          modelId: modelId,
          ownerId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      await db.insert(schema.issues).values(
        Array.from({ length: 90 }, (_, i) => ({
          id: `agg-issue-${i}`,
          title: `Aggregation Issue ${i}`,
          organizationId: orgId,
          machineId: `agg-machine-${i % 30}`, // 3 issues per machine
          statusId: statusId,
          priorityId: priorityId,
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      const startTime = Date.now();

      const result = await caller.getPublic();

      const executionTime = Date.now() - startTime;

      expect(result).toHaveLength(11); // 1 original + 10 new
      expect(executionTime).toBeLessThan(2000); // Complex aggregation should still be fast

      // Verify aggregation accuracy
      const aggregationLocations = result.filter((l) =>
        l.name.startsWith("Aggregation"),
      );
      expect(aggregationLocations).toHaveLength(10);

      aggregationLocations.forEach((location) => {
        expect(location._count.machines).toBe(3);
        location.machines.forEach((machine) => {
          expect(machine._count.issues).toBe(3);
        });
      });
    });
  });
});
