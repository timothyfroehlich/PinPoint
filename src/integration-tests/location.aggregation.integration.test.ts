/**
 * Location Router Aggregation Integration Tests (PGlite)
 *
 * Converted to use seeded data patterns for consistent, fast, memory-safe testing.
 * Tests complex aggregation queries on the location router, particularly getPublic 
 * endpoint with machine counts, issue counts, and multi-tenant isolation using
 * established seeded data infrastructure.
 *
 * Key Features:
 * - Uses createSeededTestDatabase() and getSeededTestData() for consistent test data
 * - Leverages createSeededLocationTestContext() for standardized TRPC context
 * - Uses SEED_TEST_IDS.ORGANIZATIONS.competitor for cross-org isolation testing
 * - Maintains aggregation testing with seeded data baseline + additional test data
 * - Worker-scoped PGlite integration for memory safety
 *
 * Uses modern August 2025 patterns with seeded data architecture.
 */

import { eq, count, and, ne } from "drizzle-orm";
import { describe, expect, vi, beforeAll } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";

import { locationRouter } from "~/server/api/routers/location";
import * as schema from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";
import { createSeededLocationTestContext } from "~/test/helpers/createSeededLocationTestContext";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => generateTestId("test-id")),
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

describe("Location Router Aggregation Operations (PGlite)", () => {
  let workerDb: TestDatabase;
  let primaryOrgId: string;
  let competitorOrgId: string;
  let seededData: Awaited<ReturnType<typeof getSeededTestData>>;

  beforeAll(async () => {
    // Create seeded test database with established infrastructure
    const setup = await createSeededTestDatabase();
    workerDb = setup.db;
    primaryOrgId = setup.organizationId;
    competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;

  describe("Complex Aggregation Queries", () => {
    test("should handle getPublic with machine and issue counts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        const context = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          seededData.user!,
        );
        const caller = locationRouter.createCaller(context);

        // Create additional test data for aggregation
        const testLocationId = generateTestId("agg-test-location");
        const [testLocation] = await txDb
          .insert(schema.locations)
          .values({
            id: testLocationId,
            name: "Aggregation Test Location",
            organizationId: primaryOrgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machines for testing
        const testMachines = Array.from({ length: 3 }, (_, i) => ({
          id: `agg-machine-${i}`,
          name: `Aggregation Machine ${i}`,
          qrCodeId: `agg-qr-${i}`,
          organizationId: primaryOrgId,
          locationId: testLocation.id,
          modelId: seededData.model!,
          ownerId: seededData.user!,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await txDb.insert(schema.machines).values(testMachines);

        // Create issues for aggregation testing
        const testIssues = Array.from({ length: 6 }, (_, i) => ({
          id: `agg-issue-${i}`,
          title: `Aggregation Issue ${i}`,
          organizationId: primaryOrgId,
          machineId: `agg-machine-${i % 3}`, // 2 issues per machine
          statusId: seededData.status!,
          priorityId: seededData.priority!,
          createdById: seededData.user!,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await txDb.insert(schema.issues).values(testIssues);

        const result = await caller.getPublic();

        // Should include at least our test location + seeded locations
        expect(result.length).toBeGreaterThanOrEqual(1);

        // Find our test location in results
        const testLocationResult = result.find(l => l.id === testLocation.id);
        expect(testLocationResult).toBeDefined();
        
        // Verify aggregation counts
        expect(testLocationResult!._count.machines).toBe(3);
        testLocationResult!.machines.forEach(machine => {
          expect(machine._count.issues).toBe(2); // 2 issues per machine
        });
      });
    });

    test("should maintain organizational isolation in aggregation", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (txDb) => {
        // Create contexts for both organizations
        const primaryContext = await createSeededLocationTestContext(
          txDb,
          primaryOrgId,
          seededData.user!,
        );
        const primaryCaller = locationRouter.createCaller(primaryContext);

        const competitorContext = await createSeededLocationTestContext(
          txDb,
          competitorOrgId,
          seededData.user!,
        );
        const competitorCaller = locationRouter.createCaller(competitorContext);

        // Create test location in competitor org
        await txDb.insert(schema.locations).values({
          id: "competitor-agg-location",
          name: "Competitor Aggregation Location",
          organizationId: competitorOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const primaryResults = await primaryCaller.getPublic();
        const competitorResults = await competitorCaller.getPublic();

        // Primary org should not see competitor locations
        const primaryLocationIds = primaryResults.map(l => l.id);
        expect(primaryLocationIds).not.toContain("competitor-agg-location");

        // Competitor org should see its location but not primary's seeded location
        const competitorLocationIds = competitorResults.map(l => l.id);
        expect(competitorLocationIds).toContain("competitor-agg-location");
        expect(competitorLocationIds).not.toContain(seededData.location);
      });
    });
  });
});
      .values({
        id: "status-open-agg",
        name: "Open",
        category: "NEW",
        organizationId: organization.id,
      })
      .returning();

    const [resolvedStatus] = await db
      .insert(schema.issueStatuses)
      .values({
        id: "status-resolved-agg",
        name: "Resolved",
        category: "RESOLVED",
        organizationId: organization.id,
      })
      .returning();

    // Create test locations
    const [location1] = await db
      .insert(schema.locations)
      .values({
        id: generateTestId("test-location-1-agg"),
        name: "Main Arcade",
        organizationId: organization.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [location2] = await db
      .insert(schema.locations)
      .values({
        id: generateTestId("test-location-2-agg"),
        name: "Secondary Location",
        organizationId: organization.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create test context with real database
    const context: TRPCContext = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { name: user.name },
        app_metadata: { organization_id: organization.id, role: "Admin" },
      },
      organization: {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
      },
      db: db,
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

    const caller = locationRouter.createCaller(context);

    return {
      organization,
      user,
      location1,
      location2,
      model,
      priority,
      status,
      resolvedStatus,
      context,
      caller,
    };
  }

  describe("getPublic - Aggregation Queries", () => {
    test("should return locations with accurate machine and issue counts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const {
          caller,
          location1,
          location2,
          organization,
          model,
          user,
          priority,
          status,
        } = await createTestContext(db);

        // Create machines for location1
        await db.insert(schema.machines).values([
          {
            id: "machine-1-agg",
            name: "Machine 1",
            qrCodeId: "qr-1-agg",
            organizationId: organization.id,
            locationId: location1.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "machine-2-agg",
            name: "Machine 2",
            qrCodeId: "qr-2-agg",
            organizationId: organization.id,
            locationId: location1.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create one machine for location2
        await db.insert(schema.machines).values({
          id: "machine-3-agg",
          name: "Machine 3",
          qrCodeId: "qr-3-agg",
          organizationId: organization.id,
          locationId: location2.id,
          modelId: model.id,
          ownerId: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create issues for machines
        await db.insert(schema.issues).values([
          {
            id: "issue-1-agg",
            title: "Issue 1",
            organizationId: organization.id,
            machineId: "machine-1-agg",
            statusId: status.id,
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-2-agg",
            title: "Issue 2",
            organizationId: organization.id,
            machineId: "machine-1-agg",
            statusId: status.id,
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-3-agg",
            title: "Issue 3",
            organizationId: organization.id,
            machineId: "machine-3-agg",
            statusId: status.id,
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getPublic();

        expect(result).toHaveLength(2);

        // Find locations
        const mainArcade = result.find((l) => l.id === location1.id);
        const secondaryLocation = result.find((l) => l.id === location2.id);

        expect(mainArcade).toBeDefined();
        expect(secondaryLocation).toBeDefined();

        if (!mainArcade || !secondaryLocation) {
          throw new Error("Test locations not found");
        }

        // Verify machine counts
        expect(mainArcade._count.machines).toBe(2);
        expect(secondaryLocation._count.machines).toBe(1);

        // Verify machine details with model relationships
        expect(mainArcade.machines).toHaveLength(2);
        expect(mainArcade.machines[0].model).toMatchObject({
          name: "Test Model Agg",
          manufacturer: "Test Manufacturer Agg",
        });

        // Verify issue counts
        const machine1 = mainArcade.machines.find(
          (m) => m.id === "machine-1-agg",
        );
        const machine3 = secondaryLocation.machines.find(
          (m) => m.id === "machine-3-agg",
        );

        expect(machine1?._count.issues).toBe(2);
        expect(machine3?._count.issues).toBe(1);
      });
    });

    test("should filter out resolved issues from counts", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const {
          caller,
          location1,
          organization,
          model,
          user,
          priority,
          status,
          resolvedStatus,
        } = await createTestContext(db);

        // Create a machine
        const [machine] = await db
          .insert(schema.machines)
          .values({
            id: "machine-filter-agg",
            name: "Machine Filter",
            qrCodeId: "qr-filter-agg",
            organizationId: organization.id,
            locationId: location1.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create mix of resolved and unresolved issues
        await db.insert(schema.issues).values([
          {
            id: "issue-unresolved-1",
            title: "Unresolved Issue 1",
            organizationId: organization.id,
            machineId: machine.id,
            statusId: status.id, // OPEN status
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-unresolved-2",
            title: "Unresolved Issue 2",
            organizationId: organization.id,
            machineId: machine.id,
            statusId: status.id, // OPEN status
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "issue-resolved",
            title: "Resolved Issue",
            organizationId: organization.id,
            machineId: machine.id,
            statusId: resolvedStatus.id, // RESOLVED status
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Get total issues count for verification
        const totalIssues = await db
          .select({ count: count() })
          .from(schema.issues)
          .where(eq(schema.issues.machineId, machine.id));

        const unresolvedIssues = await db
          .select({ count: count() })
          .from(schema.issues)
          .innerJoin(
            schema.issueStatuses,
            eq(schema.issues.statusId, schema.issueStatuses.id),
          )
          .where(
            and(
              eq(schema.issues.machineId, machine.id),
              ne(schema.issueStatuses.category, "RESOLVED"),
            ),
          );

        // Verify we have some issues and that resolved filtering works
        expect(totalIssues[0].count).toBe(3);
        expect(unresolvedIssues[0].count).toBe(2);

        // The public endpoint should only count unresolved issues
        const result = await caller.getPublic();
        const testLocation = result.find((l) => l.id === location1.id);
        expect(testLocation).toBeDefined();
        if (!testLocation)
          throw new Error("Test location not found in results");

        const machineWithIssues = testLocation.machines.find(
          (m) => m.id === machine.id,
        );
        if (machineWithIssues) {
          expect(machineWithIssues._count.issues).toBe(2); // Should filter out resolved issue
        }
      });
    });

    test("should work without authentication", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { context, location1, location2, organization, model, user } =
          await createTestContext(db);

        // Create machines for both locations
        await db.insert(schema.machines).values([
          {
            id: "machine-public-agg-1",
            name: "Public Machine 1",
            qrCodeId: "qr-public-agg-1",
            organizationId: organization.id,
            locationId: location1.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "machine-public-agg-2",
            name: "Public Machine 2",
            qrCodeId: "qr-public-agg-2",
            organizationId: organization.id,
            locationId: location2.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

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
    });

    test("should maintain organizational scoping in all subqueries", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const {
          caller,
          location1,
          location2,
          organization,
          model,
          user,
          priority,
          status,
        } = await createTestContext(db);

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
          modelId: model.id,
          ownerId: user.id,
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
            createdById: user.id,
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
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create machines in both our locations for comparison
        await db.insert(schema.machines).values([
          {
            id: "our-machine-scope-1",
            name: "Our Machine 1",
            qrCodeId: "our-qr-1",
            organizationId: organization.id,
            locationId: location1.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "our-machine-scope-2",
            name: "Our Machine 2",
            qrCodeId: "our-qr-2",
            organizationId: organization.id,
            locationId: location2.id,
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        await db.insert(schema.issues).values([
          {
            id: "our-issue-scope-1",
            title: "Our Issue 1",
            organizationId: organization.id,
            machineId: "our-machine-scope-1",
            statusId: status.id,
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "our-issue-scope-2",
            title: "Our Issue 2",
            organizationId: organization.id,
            machineId: "our-machine-scope-2",
            statusId: status.id,
            priorityId: priority.id,
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const result = await caller.getPublic();

        // Should only see our organization's data
        expect(result).toHaveLength(2); // Only our 2 locations
        expect(result.every((l) => l.id !== "other-location")).toBe(true);

        // Verify counts aren't affected by other org's data
        const testLocation = result.find((l) => l.id === location1.id);
        expect(testLocation).toBeDefined();
        if (!testLocation)
          throw new Error("Test location not found in results");

        // Should see our machine with our issue, not affected by other org's issues
        const ourMachine = testLocation.machines.find(
          (m) => m.id === "our-machine-scope-1",
        );
        expect(ourMachine?._count.issues).toBe(1); // Should not include other org's issues
      });
    });
  });

  describe("Complex Multi-Tenant Aggregation Scenarios", () => {
    test("should maintain complete isolation between organizations in aggregations", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { context, _organization, _model, user, _priority, _status } =
          await createTestContext(db);

        // Create multiple organizations with overlapping data
        await db.insert(schema.organizations).values([
          {
            id: "org-a-agg",
            name: "Organization A",
            subdomain: "org-a-agg",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "org-b-agg",
            name: "Organization B",
            subdomain: "org-b-agg",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create roles for each organization
        await db.insert(schema.roles).values([
          {
            id: "role-org-a",
            name: "Admin",
            organizationId: "org-a-agg",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "role-org-b",
            name: "Admin",
            organizationId: "org-b-agg",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create memberships for the test user in both orgs
        await db.insert(schema.memberships).values([
          {
            id: "membership-org-a",
            userId: user.id,
            organizationId: "org-a-agg",
            roleId: "role-org-a",
          },
          {
            id: "membership-org-b",
            userId: user.id,
            organizationId: "org-b-agg",
            roleId: "role-org-b",
          },
        ]);

        // Create same-named locations in different orgs
        await db.insert(schema.locations).values([
          {
            id: "loc-a-1-agg",
            name: "Main Arcade",
            organizationId: "org-a-agg",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "loc-b-1-agg",
            name: "Main Arcade", // Same name, different org
            organizationId: "org-b-agg",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Test from org-a perspective
        const orgAContext = {
          ...context,
          organization: {
            id: "org-a-agg",
            name: "Organization A",
            subdomain: "org-a-agg",
          },
        };
        const orgACaller = locationRouter.createCaller(orgAContext as any);

        const orgALocations = await orgACaller.getAll();
        expect(orgALocations).toHaveLength(1);
        expect(orgALocations[0].id).toBe("loc-a-1-agg");
        expect(orgALocations[0].organizationId).toBe("org-a-agg");

        // Test from org-b perspective
        const orgBContext = {
          ...context,
          organization: {
            id: "org-b-agg",
            name: "Organization B",
            subdomain: "org-b-agg",
          },
        };
        const orgBCaller = locationRouter.createCaller(orgBContext as any);

        const orgBLocations = await orgBCaller.getAll();
        expect(orgBLocations).toHaveLength(1);
        expect(orgBLocations[0].id).toBe("loc-b-1-agg");
        expect(orgBLocations[0].organizationId).toBe("org-b-agg");

        // Test that orgs can't see each other's data
        await expect(orgACaller.getById({ id: "loc-b-1-agg" })).rejects.toThrow(
          "Location not found or access denied",
        );

        await expect(orgBCaller.getById({ id: "loc-a-1-agg" })).rejects.toThrow(
          "Location not found or access denied",
        );
      });
    });

    test("should handle complex count queries with organizational scoping", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const { context, _organization, _model, user } =
          await createTestContext(db);

        // Create organizations with different priorities and statuses
        await db.insert(schema.organizations).values([
          {
            id: "org-a-count",
            name: "Organization A",
            subdomain: "org-a-count",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "org-b-count",
            name: "Organization B",
            subdomain: "org-b-count",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create roles for each organization
        await db.insert(schema.roles).values([
          {
            id: "role-org-a-count",
            name: "Admin",
            organizationId: "org-a-count",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "role-org-b-count",
            name: "Admin",
            organizationId: "org-b-count",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Create memberships for the test user in both orgs
        await db.insert(schema.memberships).values([
          {
            id: "membership-org-a-count",
            userId: user.id,
            organizationId: "org-a-count",
            roleId: "role-org-a-count",
          },
          {
            id: "membership-org-b-count",
            userId: user.id,
            organizationId: "org-b-count",
            roleId: "role-org-b-count",
          },
        ]);

        // Add priorities and statuses for each org
        await db.insert(schema.priorities).values([
          {
            id: "priority-a",
            name: "Priority A",
            organizationId: "org-a-count",
            order: 1,
          },
          {
            id: "priority-b",
            name: "Priority B",
            organizationId: "org-b-count",
            order: 2,
          },
        ]);

        await db.insert(schema.issueStatuses).values([
          {
            id: "status-a",
            name: "Status A",
            category: "NEW",
            organizationId: "org-a-count",
          },
          {
            id: "status-b",
            name: "Status B",
            category: "IN_PROGRESS",
            organizationId: "org-b-count",
          },
        ]);

        // Create locations and machines for each org
        await db.insert(schema.locations).values([
          {
            id: "loc-a-count",
            name: "Location A",
            organizationId: "org-a-count",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "loc-b-count",
            name: "Location B",
            organizationId: "org-b-count",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        await db.insert(schema.machines).values([
          {
            id: "machine-a",
            name: "Machine A",
            qrCodeId: "qr-a",
            organizationId: "org-a-count",
            locationId: "loc-a-count",
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "machine-b",
            name: "Machine B",
            qrCodeId: "qr-b",
            organizationId: "org-b-count",
            locationId: "loc-b-count",
            modelId: model.id,
            ownerId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Add different numbers of issues to each machine
        await db.insert(schema.issues).values([
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `issue-a-${i}`,
            title: `Issue A ${i}`,
            organizationId: "org-a-count",
            machineId: "machine-a",
            statusId: "status-a",
            priorityId: "priority-a",
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          ...Array.from({ length: 3 }, (_, i) => ({
            id: `issue-b-${i}`,
            title: `Issue B ${i}`,
            organizationId: "org-b-count",
            machineId: "machine-b",
            statusId: "status-b",
            priorityId: "priority-b",
            createdById: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        ]);

        // Test getPublic counts for org-a
        const orgAContext = {
          ...context,
          organization: {
            id: "org-a-count",
            name: "Organization A",
            subdomain: "org-a-count",
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
            id: "org-b-count",
            name: "Organization B",
            subdomain: "org-b-count",
          },
        };
        const orgBCaller = locationRouter.createCaller(orgBContext as any);
        const orgBResult = await orgBCaller.getPublic();

        expect(orgBResult[0]._count.machines).toBe(1);
        expect(orgBResult[0].machines[0]._count.issues).toBe(3);
      });
    });
  });
});
