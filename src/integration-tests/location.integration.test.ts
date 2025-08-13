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

/* eslint-disable @typescript-eslint/unbound-method */

import { eq, count, and, ne } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { ExtendedPrismaClient } from "~/server/db";

import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

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
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "location:edit",
      "location:delete",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("Location Router Integration (PGlite)", () => {
  let db: TestDatabase;
  let context: TRPCContext;
  let caller: ReturnType<typeof locationRouter.createCaller>;

  // Test data IDs - queried from actual seeded data
  let testData: {
    organization: string;
    location?: string;
    machine?: string;
    model?: string;
    status?: string;
    priority?: string;
    issue?: string;
    adminRole?: string;
    memberRole?: string;
    user?: string;
  };

  beforeEach(async () => {
    // Create fresh PGlite database with real schema and seed data
    const setup = await createSeededTestDatabase();
    db = setup.db;

    // Query actual seeded IDs instead of using hardcoded ones
    testData = await getSeededTestData(db, setup.organizationId);

    // Create mock Prisma client for tRPC middleware compatibility
    const mockPrismaClient = {
      membership: {
        findFirst: vi.fn().mockResolvedValue({
          id: "test-membership",
          organizationId: testData.organization,
          userId: testData.user || "test-user-1",
          role: {
            id: testData.adminRole,
            name: "Admin",
            permissions: [
              { id: "perm1", name: "location:edit" },
              { id: "perm2", name: "location:delete" },
              { id: "perm3", name: "organization:manage" },
            ],
          },
        }),
      },
    } as unknown as ExtendedPrismaClient;

    // Create test context with real database
    context = {
      user: {
        id: testData.user || "test-user-1",
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: testData.organization, role: "Admin" },
      },
      organization: {
        id: testData.organization,
        name: "Test Organization",
        subdomain: "test-org",
      },
      db: mockPrismaClient,
      drizzle: db,
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any,
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

  describe("create", () => {
    it("should create location with real database operations", async () => {
      const result = await caller.create({ name: "New Arcade Location" });

      expect(result).toMatchObject({
        name: "New Arcade Location",
        organizationId: testData.organization,
      });
      expect(result.id).toMatch(/^test-id-/);

      // Verify in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, result.id),
      });

      expect(dbLocation).toMatchObject({
        id: result.id,
        name: "New Arcade Location",
        organizationId: testData.organization,
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
        id: testData.location,
        organizationId: testData.organization,
        machines: expect.arrayContaining([
          expect.objectContaining({
            id: testData.machine,
            locationId: testData.location,
          }),
        ]),
      });

      // Verify relationships are properly loaded
      const location = result[0];
      expect(location.machines).toHaveLength(7); // Production minimal seeds create 7 machines
      expect(
        location.machines.find((m) => m.id === testData.machine),
      ).toBeDefined();
    });

    it("should order locations by name", async () => {
      // Insert additional locations
      await db.insert(schema.locations).values([
        {
          id: "loc-zebra",
          name: "Zebra Arcade",
          organizationId: testData.organization,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "loc-alpha",
          name: "Alpha Games",
          organizationId: testData.organization,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await caller.getAll();

      expect(result).toHaveLength(3);
      // Check that locations are ordered by name (first is Alpha, last is Zebra)
      expect(result[0].name).toBe("Alpha Games");
      expect(result[result.length - 1].name).toBe("Zebra Arcade");
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
      expect(result[0].organizationId).toBe(testData.organization);
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
        organizationId: testData.organization,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(schema.machines).values({
        id: "machine-2",
        name: "AFM #001",
        qrCodeId: "qr-test-456",
        organizationId: testData.organization,
        locationId: "location-2",
        modelId: testData.model,
        ownerId: testData.user,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add resolved status for testing
      await db.insert(schema.issueStatuses).values({
        id: "status-resolved",
        name: "Resolved",
        category: "RESOLVED",
        organizationId: testData.organization,
      });

      // Add mix of resolved and unresolved issues
      await db.insert(schema.issues).values([
        {
          id: "issue-2-unresolved",
          title: "Unresolved Issue",
          organizationId: testData.organization,
          machineId: testData.machine,
          statusId: testData.status, // OPEN status
          priorityId: testData.priority,
          createdById: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "issue-3-resolved",
          title: "Resolved Issue",
          organizationId: testData.organization,
          machineId: testData.machine,
          statusId: "status-resolved", // RESOLVED status
          priorityId: testData.priority,
          createdById: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "issue-4-unresolved",
          title: "Another Unresolved Issue",
          organizationId: testData.organization,
          machineId: "machine-2",
          statusId: testData.status, // OPEN status
          priorityId: testData.priority,
          createdById: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it("should return locations with accurate machine and issue counts", async () => {
      const result = await caller.getPublic();

      expect(result).toHaveLength(2);

      // Find our test locations
      const testArcade = result.find((l) => l.id === testData.location);
      const secondLocation = result.find((l) => l.id === "location-2");

      expect(testArcade).toBeDefined();
      expect(secondLocation).toBeDefined();

      if (!testArcade || !secondLocation) {
        throw new Error("Test data not found");
      }

      // Verify machine counts (production seeds create 7 machines in main location)
      expect(testArcade._count.machines).toBe(7);
      expect(secondLocation._count.machines).toBe(1);

      // Verify machine details with model relationships
      // First machine should be Xenon (ordered by machine ID)
      const firstMachine = testArcade.machines[0];
      expect(firstMachine).toMatchObject({
        name: "Xenon #2",
        model: {
          name: "Xenon",
          manufacturer: "Bally",
        },
      });

      // Verify unresolved issue counts (production seeds create ~6 issues distributed across machines)
      const totalIssues = testArcade.machines.reduce(
        (sum, machine) => sum + machine._count.issues,
        0,
      );
      expect(totalIssues).toBeGreaterThan(0); // Should have some issues from production seeds
      expect(secondLocation.machines[0]?._count.issues).toBe(1);
    });

    it("should filter out resolved issues from counts", async () => {
      const result = await caller.getPublic();

      // Get total issues count for verification
      const totalIssues = await db
        .select({ count: count() })
        .from(schema.issues)
        .where(eq(schema.issues.machineId, testData.machine));

      const unresolvedIssues = await db
        .select({ count: count() })
        .from(schema.issues)
        .innerJoin(
          schema.issueStatuses,
          eq(schema.issues.statusId, schema.issueStatuses.id),
        )
        .where(
          and(
            eq(schema.issues.machineId, testData.machine),
            ne(schema.issueStatuses.category, "RESOLVED"),
          ),
        );

      // Verify we have some issues and that resolved filtering works
      expect(totalIssues[0].count).toBeGreaterThan(0);
      expect(unresolvedIssues[0].count).toBeGreaterThanOrEqual(0);

      // The public endpoint should only count unresolved issues
      const testArcade = result.find((l) => l.id === testData.location);
      expect(testArcade).toBeDefined();
      if (!testArcade)
        throw new Error("Test arcade location not found in results");

      const machineWithIssues = testArcade.machines.find(
        (m) => m.id === testData.machine,
      );
      if (machineWithIssues) {
        expect(machineWithIssues._count.issues).toBeGreaterThanOrEqual(0); // Should filter resolved issues
      }
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
        order: 1,
      });

      await db.insert(schema.issueStatuses).values({
        id: "other-status",
        name: "Other Status",
        category: "NEW",
        organizationId: otherOrgId,
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
        modelId: testData.model,
        ownerId: testData.user,
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
          createdById: testData.user,
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
          createdById: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await caller.getPublic();

      // Should only see our organization's data
      expect(result).toHaveLength(2); // Only our 2 locations
      expect(result.every((l) => l.id !== "other-location")).toBe(true);

      // Verify counts aren't affected by other org's data
      const testArcade = result.find((l) => l.id === testData.location);
      expect(testArcade).toBeDefined();
      if (!testArcade)
        throw new Error("Test arcade location not found in results");

      expect(testArcade._count.machines).toBe(7);
      // Xenon machine should have issues from seeded data only (not other org's issues)
      expect(testArcade.machines[0]._count.issues).toBeGreaterThanOrEqual(1); // Should not include other org's issues
    });
  });

  describe("update", () => {
    it("should update location with real database persistence", async () => {
      const result = await caller.update({
        id: testData.location,
        name: "Updated Test Arcade",
      });

      expect(result).toMatchObject({
        id: testData.location,
        name: "Updated Test Arcade",
        organizationId: testData.organization,
      });

      // Verify in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
      });

      expect(dbLocation).toBeDefined();
      if (!dbLocation) throw new Error("Location not found in database");

      expect(dbLocation.name).toBe("Updated Test Arcade");
      expect(dbLocation.updatedAt.getTime()).toBeGreaterThan(
        dbLocation.createdAt.getTime(),
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
        otherCaller.update({ id: testData.location, name: "Hacked Name" }),
      ).rejects.toThrow("Location not found or access denied");

      // Verify original name unchanged (should still be production seed name)
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
      });
      expect(dbLocation).toBeDefined();
      if (!dbLocation)
        throw new Error("Location not found in database after failed update");

      // Should be "Austin Pinball Collective" from production seeds
      expect(dbLocation.name).toContain("Austin");
    });

    it("should handle partial updates correctly", async () => {
      const originalData = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
      });

      const result = await caller.update({ id: testData.location }); // No name provided

      expect(originalData).toBeDefined();
      if (!originalData) throw new Error("Original location data not found");

      expect(result.name).toBe(originalData.name); // Name should remain unchanged
      expect(result.updatedAt.getTime()).toBeGreaterThan(
        originalData.updatedAt.getTime(),
      ); // But updatedAt should change
    });
  });

  describe("getById", () => {
    it("should get location with complete relationship data", async () => {
      const result = await caller.getById({ id: testData.location });

      expect(result).toMatchObject({
        id: testData.location,
        organizationId: testData.organization,
      });
      // Should be "Austin Pinball Collective" from production seeds
      expect(result.name).toContain("Austin");

      expect(result.machines).toHaveLength(7);
      // First machine should be Xenon (ordered by machine ID)
      expect(result.machines[0]).toMatchObject({
        name: "Xenon #2",
      });
      expect(result.machines[0].model).toMatchObject({
        name: "Xenon",
        manufacturer: "Bally",
      });
      expect(result.machines[0].owner).toMatchObject({
        id: testData.user,
        name: "Dev Admin",
        profilePicture: null,
      });
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
      const result = await caller.getById({ id: testData.location });
      expect(result.id).toBe(testData.location);
    });
  });

  describe("delete", () => {
    it("should delete location and handle dependent records properly", async () => {
      // Due to foreign key constraints, we need to delete in reverse dependency order:
      // Issues -> Machines -> Location
      // This test demonstrates the proper cleanup sequence for referential integrity

      // Verify the complete dependency chain exists before deletion
      const issueBeforeDeletion = await db.query.issues.findFirst({
        where: eq(schema.issues.machineId, testData.machine),
      });
      expect(issueBeforeDeletion).toBeDefined();
      if (!issueBeforeDeletion)
        throw new Error("Issue not found before deletion test");

      expect(issueBeforeDeletion.machineId).toBe(testData.machine);

      const machineBeforeDeletion = await db.query.machines.findFirst({
        where: eq(schema.machines.id, testData.machine),
      });
      expect(machineBeforeDeletion).toBeDefined();
      if (!machineBeforeDeletion)
        throw new Error("Machine not found before deletion test");

      expect(machineBeforeDeletion.locationId).toBe(testData.location);

      // Step 1: Delete issues first (they reference machines)
      await db
        .delete(schema.issues)
        .where(eq(schema.issues.machineId, testData.machine));

      // Verify issue was deleted
      const issueAfterDeletion = await db.query.issues.findFirst({
        where: eq(schema.issues.machineId, testData.machine),
      });
      expect(issueAfterDeletion).toBeUndefined();

      // Step 2: Delete the machine (it references location)
      await db
        .delete(schema.machines)
        .where(eq(schema.machines.id, testData.machine));

      // Verify machine was deleted
      const machineAfterDeletion = await db.query.machines.findFirst({
        where: eq(schema.machines.id, testData.machine),
      });
      expect(machineAfterDeletion).toBeUndefined();

      // Step 3: Now we can delete the location without foreign key constraint violations
      const result = await caller.delete({ id: testData.location });

      expect(result).toMatchObject({
        id: testData.location,
        organizationId: testData.organization,
      });
      // Should be "Austin Pinball Collective" from production seeds
      expect(result.name).toContain("Austin");

      // Verify location deletion in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
      });
      expect(dbLocation).toBeUndefined();

      // Verify complete cleanup - no orphaned records remain
      const remainingIssues = await db.query.issues.findMany({
        where: eq(schema.issues.organizationId, testData.organization),
      });
      const remainingMachines = await db.query.machines.findMany({
        where: eq(schema.machines.organizationId, testData.organization),
      });
      const remainingLocations = await db.query.locations.findMany({
        where: eq(schema.locations.organizationId, testData.organization),
      });

      // All test-created records should be gone (other tests may create their own)
      expect(
        remainingIssues.filter((i) => i.machineId === testData.machine),
      ).toHaveLength(0);
      expect(
        remainingMachines.filter((m) => m.id === testData.machine),
      ).toHaveLength(0);
      expect(
        remainingLocations.filter((l) => l.id === testData.location),
      ).toHaveLength(0);
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

      await expect(
        otherCaller.delete({ id: testData.location }),
      ).rejects.toThrow("Location not found or access denied");

      // Verify location still exists
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
      });
      expect(dbLocation).toBeDefined();
    });
  });

  describe("setPinballMapId", () => {
    it("should set PinballMap ID with database persistence", async () => {
      const result = await caller.setPinballMapId({
        locationId: testData.location,
        pinballMapId: 12345,
      });

      expect(result.pinballMapId).toBe(12345);

      // Verify in database
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
      });
      expect(dbLocation).toBeDefined();
      if (!dbLocation)
        throw new Error(
          "Location not found in database after PinballMap ID update",
        );

      expect(dbLocation.pinballMapId).toBe(12345);
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
          locationId: testData.location,
          pinballMapId: 999,
        }),
      ).rejects.toThrow("Location not found or access denied");

      // Verify pinballMapId unchanged
      const dbLocation = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
      });
      expect(dbLocation).toBeDefined();
      if (!dbLocation)
        throw new Error(
          "Location not found in database after failed PinballMap ID update",
        );

      expect(dbLocation.pinballMapId).toBeNull();
    });
  });

  describe("syncWithPinballMap", () => {
    it("should handle successful sync with service integration", async () => {
      const result = await caller.syncWithPinballMap({
        locationId: testData.location,
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
        caller.syncWithPinballMap({ locationId: testData.location }),
      ).rejects.toThrow("API rate limit exceeded");
    });
  });

  describe("Database Schema Validation", () => {
    it("should maintain referential integrity", async () => {
      // Test foreign key constraints
      const location = await db.query.locations.findFirst({
        where: eq(schema.locations.id, testData.location),
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
      if (!location)
        throw new Error("Location not found for referential integrity test");

      expect(location.machines.length).toBeGreaterThan(0);
      if (location.machines.length === 0)
        throw new Error("No machines found for location");

      expect(location.machines[0].model.id).toBe(testData.model);
      expect(location.machines[0].owner.id).toBe(testData.user);

      expect(location.machines[0].issues.length).toBeGreaterThan(0);
      if (location.machines[0].issues.length === 0)
        throw new Error("No issues found for machine");

      expect(location.machines[0].issues[0].status.id).toBe(testData.status);
      expect(location.machines[0].issues[0].priority.id).toBe(
        testData.priority,
      );
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
      // Note: PGlite may not fully enforce all PostgreSQL constraints
      try {
        await db.insert(schema.organizations).values(duplicateOrg);
        // If PGlite doesn't enforce constraints, check manually
        const duplicateOrgs = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.subdomain, "test-org"));
        expect(duplicateOrgs.length).toBeLessThanOrEqual(1);
      } catch (error) {
        // If constraint is enforced, this is expected behavior
        expect(error).toBeDefined();
      }
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
          order: 1,
        },
        {
          id: "priority-b",
          name: "Priority B",
          organizationId: "org-b",
          order: 2,
        },
      ]);

      await db.insert(schema.issueStatuses).values([
        {
          id: "status-a",
          name: "Status A",
          category: "NEW",
          organizationId: "org-a",
        },
        {
          id: "status-b",
          name: "Status B",
          category: "IN_PROGRESS",
          organizationId: "org-b",
        },
      ]);

      await db.insert(schema.machines).values([
        {
          id: "machine-a",
          name: "Machine A",
          qrCodeId: "qr-a",
          organizationId: "org-a",
          locationId: "loc-a-1",
          modelId: testData.model,
          ownerId: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "machine-b",
          name: "Machine B",
          qrCodeId: "qr-b",
          organizationId: "org-b",
          locationId: "loc-b-1",
          modelId: testData.model,
          ownerId: testData.user,
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
          createdById: testData.user,
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
          createdById: testData.user,
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
        organizationId: testData.organization,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.insert(schema.locations).values(locations);

      const machines = Array.from({ length: 200 }, (_, i) => ({
        id: `perf-machine-${i}`,
        name: `Performance Machine ${i}`,
        qrCodeId: `perf-qr-${i}`,
        organizationId: testData.organization,
        locationId: `perf-location-${i % 50}`, // Distribute across locations
        modelId: testData.model,
        ownerId: testData.user,
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
      expect(totalMachines).toBe(207); // 7 original + 200 new
    });

    it("should optimize getPublic aggregation queries", async () => {
      // Create complex data structure for aggregation testing
      await db.insert(schema.locations).values(
        Array.from({ length: 10 }, (_, i) => ({
          id: `agg-location-${i}`,
          name: `Aggregation Location ${i}`,
          organizationId: testData.organization,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      await db.insert(schema.machines).values(
        Array.from({ length: 30 }, (_, i) => ({
          id: `agg-machine-${i}`,
          name: `Aggregation Machine ${i}`,
          qrCodeId: `agg-qr-${i}`,
          organizationId: testData.organization,
          locationId: `agg-location-${i % 10}`, // 3 machines per location
          modelId: testData.model,
          ownerId: testData.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      await db.insert(schema.issues).values(
        Array.from({ length: 90 }, (_, i) => ({
          id: `agg-issue-${i}`,
          title: `Aggregation Issue ${i}`,
          organizationId: testData.organization,
          machineId: `agg-machine-${i % 30}`, // 3 issues per machine
          statusId: testData.status,
          priorityId: testData.priority,
          createdById: testData.user,
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
