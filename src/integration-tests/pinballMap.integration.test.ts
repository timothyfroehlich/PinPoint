/**
 * PinballMap Integration Tests
 *
 * Consolidated tRPC router + service integration tests using PGlite database.
 * Tests complete request → service → database workflows with real business logic.
 *
 * Architecture:
 * - Real PostgreSQL database with PGlite
 * - Complete schema migrations applied
 * - Real tRPC router operations
 * - Real service layer business logic
 * - External API mocking (PinballMap API only)
 * - Multi-tenant data isolation testing
 * - Worker-scoped database for memory safety
 *
 * Coverage:
 * - enableIntegration: Enable PinballMap integration for organization
 * - configureLocation: Configure location with PinballMap ID
 * - syncLocation: Complete sync workflow with machine reconciliation
 * - getSyncStatus: Organization sync status with real data
 * - Permission validation: Real auth context testing
 * - Organizational boundaries: Real RLS enforcement
 * - API error handling: External service failure scenarios
 */

import { eq, and } from "drizzle-orm";
import { describe, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";

// Import test setup and utilities
import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { server } from "~/test/msw/setup";

import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { generateTestId } from "~/test/helpers/test-id-generator";

// Use existing seeded data from worker database (much faster than complex seeding)
async function getSimpleSeededData(db: any) {
  // Query existing seeded data
  const organization = await db.query.organizations.findFirst();
  const location = await db.query.locations.findFirst({
    where: eq(schema.locations.organizationId, organization.id),
  });
  const user = await db.query.users.findFirst();

  if (!organization || !location || !user) {
    throw new Error("Seeded data not found - worker database not properly initialized");
  }

  return {
    organizationId: organization.id,
    locationId: location.id,
    userId: user.id,
  };
}

// Import tRPC context type and service factory
import type { TRPCContext } from "~/server/api/trpc.base";
import type { TestDatabase } from "~/test/helpers/pglite-test-setup";
import { ServiceFactory } from "~/server/services/factory";


// Helper function to create proper tRPC context
function createPinballMapTestContext(
  db: TestDatabase,
  organizationId: string,
  userId: string,
  permissions: string[] = ["organization:manage", "location:edit"]
): TRPCContext {
  // Set the global mock permissions when creating context
  setMockPermissions(permissions);

  const user = {
    id: userId,
    email: "test@example.com",
    name: "Test User",
    user_metadata: {},
    app_metadata: {
      organization_id: organizationId,
    },
  } as any;

  return {
    db: db,
    user: user,
    organization: {
      id: organizationId,
      name: "Test Organization",
      subdomain: "test",
    },
    organizationId: organizationId,
    supabase: {} as any, // Not used in this router
    headers: new Headers(),
    userPermissions: permissions,
    services: new ServiceFactory(db),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(),
      withRequest: vi.fn(),
      withUser: vi.fn(),
      withOrganization: vi.fn(),
      withContext: vi.fn(),
    } as any,
  } as any;
}

// MSW handlers for PinballMap API mocking
const pinballMapApiHandlers = {
  success: (machines: any[]) =>
    http.get('https://pinballmap.com/api/v1/locations/:locationId/machine_details.json', () => {
      return HttpResponse.json({ machines });
    }),
  
  error: (status = 500) =>
    http.get('https://pinballmap.com/api/v1/locations/:locationId/machine_details.json', () => {
      return new HttpResponse(null, { status });
    }),
  
  empty: () =>
    http.get('https://pinballmap.com/api/v1/locations/:locationId/machine_details.json', () => {
      return HttpResponse.json({ machines: [] });
    }),
};

// Mock ID generation for consistent test data
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => "test-generated-id"),
}));

// Store mock permission state globally
let mockUserPermissions: string[] = [];

const mockRequirePermissionForSession = vi.hoisted(() => 
  vi.fn(async (session, permission) => {
    if (!mockUserPermissions.includes(permission)) {
      throw new Error(`Missing required permission: ${permission}`);
    }
  })
);

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi.fn(),
  getUserPermissionsForSupabaseUser: vi.fn(),
  requirePermissionForSession: mockRequirePermissionForSession,
  supabaseUserToSession: vi.fn((user, organizationId) => ({
    user: {
      id: user.id,
      email: user.email ?? "",
      name: user.name,
      organizationId: organizationId,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })),
}));

// Helper to set mock permissions for tests
function setMockPermissions(permissions: string[]) {
  mockUserPermissions = permissions;
}

describe("PinballMap Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset MSW handlers
    server.resetHandlers();
    // Reset permissions to admin by default
    setMockPermissions(["organization:manage", "location:edit"]);
  });

  describe("enableIntegration", () => {
    test("should create new config and enable integration", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.enableIntegration();

        expect(result.success).toBe(true);

        // Verify real database state
        const config = await db.query.pinballMapConfigs.findFirst({
          where: eq(schema.pinballMapConfigs.organizationId, testData.organizationId),
        });

        expect(config).toBeDefined();
        expect(config?.apiEnabled).toBe(true);
        expect(config?.createMissingModels).toBe(true);
        expect(config?.updateExistingData).toBe(true);
      });
    });

    test("should update existing disabled config to enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Create existing disabled config
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-existing-config",
          organizationId: testData.organizationId,
          apiEnabled: false,
          createMissingModels: false,
          updateExistingData: false,
        });

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        await caller.pinballMap.enableIntegration();

        // Verify config was updated, not duplicated
        const configs = await db.query.pinballMapConfigs.findMany({
          where: eq(schema.pinballMapConfigs.organizationId, testData.organizationId),
        });

        expect(configs).toHaveLength(1);
        expect(configs[0]?.apiEnabled).toBe(true);
      });
    });

    test("should require organization:manage permission", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        // Create member context with limited permissions
        const memberContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId,
          ["location:edit"] // Not organization:manage
        );
        
        const caller = appRouter.createCaller(memberContext);

        await expect(caller.pinballMap.enableIntegration())
          .rejects.toThrow("Missing required permission: organization:manage");
      });
    });
  });

  describe("configureLocation", () => {
    test("should configure location when integration enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Enable integration first
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: testData.organizationId,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.configureLocation({
          locationId: testData.locationId,
          pinballMapId: 26454,
        });

        expect(result.success).toBe(true);

        // Verify real database update
        const updatedLocation = await db.query.locations.findFirst({
          where: eq(schema.locations.id, testData.locationId),
        });

        expect(updatedLocation?.pinballMapId).toBe(26454);
        expect(updatedLocation?.syncEnabled).toBe(true);
      });
    });

    test("should throw error when integration not enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);

        await expect(
          caller.pinballMap.configureLocation({
            locationId: testData.locationId,
            pinballMapId: 26454,
          }),
        ).rejects.toThrow("PinballMap integration not enabled for organization");
      });
    });

    test("should enforce organizational boundaries", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Create location in different organization
        const [competitorLocation] = await db
          .insert(schema.locations)
          .values({
            id: "competitor-location",
            name: "Competitor Location",
            organizationId: "competitor-org-id",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);

        // Should not be able to configure competitor's location
        await expect(
          caller.pinballMap.configureLocation({
            locationId: competitorLocation.id,
            pinballMapId: 26454,
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe("syncLocation", () => {
    test("should sync machines from PinballMap API", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Setup enabled integration and configured location
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: testData.organizationId,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true })
          .where(eq(schema.locations.id, testData.locationId));
        
        // Mock successful PinballMap API response
        server.use(
          pinballMapApiHandlers.success([
            {
              opdb_id: "MM-001",
              machine_name: "Medieval Madness",
              manufacturer: "Williams",
              year: 1997,
            },
            {
              opdb_id: "TZ-001", 
              machine_name: "Twilight Zone",
              manufacturer: "Bally",
              year: 1993,
            },
          ])
        );

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.syncLocation({
          locationId: testData.locationId,
        });

        expect(result.success).toBe(true);
        expect(result.added).toBeGreaterThan(0);

        // Verify machines were actually added to database
        const machines = await db.query.machines.findMany({
          where: eq(schema.machines.locationId, testData.locationId),
          with: { model: true },
        });

        expect(machines.length).toBeGreaterThan(0);
        expect(machines.some(m => m.model?.name === "Medieval Madness")).toBe(true);
        expect(machines.some(m => m.model?.name === "Twilight Zone")).toBe(true);
      });
    });

    test("should remove machines not in PinballMap but preserve machines with issues", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Create a test model since seeded data doesn't include models
        const [testModel] = await db.insert(schema.models).values({
          id: "test-model-mm",
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
          opdbId: "MM-001",
          isActive: true,
        }).returning();
        
        if (!testModel) {
          throw new Error("Failed to create test model");
        }
        
        const existingModel = testModel;
        
        // Setup integration
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: testData.organizationId,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true })
          .where(eq(schema.locations.id, testData.locationId));

        // Create machine that will be missing from API (should be removed)
        const [machineToRemove] = await db
          .insert(schema.machines)
          .values({
            id: "machine-to-remove",
            name: "Machine to Remove",
            qrCodeId: "qr-remove",
            organizationId: testData.organizationId,
            locationId: testData.locationId,
            modelId: existingModel.id,
            ownerId: testData.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Create machine with issue (should NOT be removed)
        const [machineWithIssue] = await db
          .insert(schema.machines)
          .values({
            id: "machine-with-issue",
            name: "Machine with Issue",
            qrCodeId: "qr-issue",
            organizationId: testData.organizationId,
            locationId: testData.locationId,
            modelId: existingModel.id,
            ownerId: testData.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Get existing status and priority from seeded data
        const existingStatus = await db.query.issueStatuses.findFirst();
        const existingPriority = await db.query.priorities.findFirst();
        
        if (!existingStatus || !existingPriority) {
          throw new Error("No status or priority found in seeded data");
        }
        
        // Create issue for the machine
        await db.insert(schema.issues).values({
          id: "test-issue",
          title: "Test Issue",
          machineId: machineWithIssue.id,
          organizationId: testData.organizationId,
          statusId: existingStatus.id,
          priorityId: existingPriority.id,
          createdBy: testData.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Mock API response with no machines (should trigger removal)
        server.use(pinballMapApiHandlers.empty());

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.syncLocation({
          locationId: testData.locationId,
        });

        expect(result.success).toBe(true);
        expect(result.removed).toBe(1); // Only removed machine without issues

        // Verify correct machine was removed
        const remainingMachines = await db.query.machines.findMany({
          where: eq(schema.machines.locationId, testData.locationId),
        });

        expect(remainingMachines).toHaveLength(1);
        expect(remainingMachines[0]?.id).toBe(machineWithIssue.id);
      });
    });

    test("should handle PinballMap API errors gracefully", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Setup integration
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: testData.organizationId,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true })
          .where(eq(schema.locations.id, testData.locationId));

        // Mock API failure
        server.use(pinballMapApiHandlers.error(500));

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);

        const result = await caller.pinballMap.syncLocation({
          locationId: testData.locationId,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("PinballMap API error");
      });
    });
  });

  describe("getSyncStatus", () => {
    test("should return enabled status with configured locations", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Create enabled config
        await db.insert(schema.pinballMapConfigs).values({
          id: "test-config",
          organizationId: testData.organizationId,
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Configure location for sync
        await db
          .update(schema.locations)
          .set({ pinballMapId: 26454, syncEnabled: true, lastSyncAt: new Date() })
          .where(eq(schema.locations.id, testData.locationId));

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.getSyncStatus();

        expect(result.configEnabled).toBe(true);
        expect(result.locations).toHaveLength(1);
        expect(result.locations[0]?.id).toBe(testData.locationId);
        expect(result.locations[0]?.pinballMapId).toBe(26454);
        expect(result.locations[0]?.syncEnabled).toBe(true);
        expect(result.locations[0]?.lastSyncAt).toBeDefined();
      });
    });

    test("should return disabled status when integration not enabled", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.getSyncStatus();

        expect(result.configEnabled).toBe(false);
        expect(result.locations).toHaveLength(1); // Existing location in database
        expect(result.lastSync).toBeNull();
      });
    });

    test("should enforce organizational boundaries", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        const testData = await getSimpleSeededData(db);
        
        // Create config for competitor organization
        await db.insert(schema.pinballMapConfigs).values({
          id: "competitor-config",
          organizationId: "competitor-org-id",
          apiEnabled: true,
          createMissingModels: true,
          updateExistingData: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create location in competitor organization
        await db.insert(schema.locations).values({
          id: "competitor-location",
          name: "Competitor Location",
          organizationId: "competitor-org-id",
          pinballMapId: 12345,
          syncEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const adminContext = createPinballMapTestContext(
          db,
          testData.organizationId,
          testData.userId
        );
        
        const caller = appRouter.createCaller(adminContext);
        const result = await caller.pinballMap.getSyncStatus();

        // Should not see competitor's data
        expect(result.configEnabled).toBe(false); // No config for primary org
        expect(result.locations).toHaveLength(1); // Own org location exists
      });
    });
  });
});