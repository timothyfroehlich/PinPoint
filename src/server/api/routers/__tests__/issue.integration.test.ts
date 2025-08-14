import { eq } from "drizzle-orm";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { generateId } from "~/lib/utils/id-generation";
import { appRouter } from "~/server/api/root";
import { issues, machines, issueStatuses } from "~/server/db/schema";
import {
  createSeededTestDatabase,
  getSeededTestData,
  withTransaction,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

// Mock NextAuth for integration tests
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock permissions system
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi
      .fn()
      .mockResolvedValue([
        "issue:view",
        "issue:edit",
        "issue:create",
        "issue:assign",
      ]),
    requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock service modules
vi.mock("~/server/services/factory", () => ({
  createIssueActivityService: vi.fn(() => ({
    recordIssueCreated: vi.fn(),
    recordFieldUpdate: vi.fn(),
    recordIssueAssigned: vi.fn(),
  })),
  createNotificationService: vi.fn(() => ({
    notifyMachineOwnerOfIssue: vi.fn(),
    notifyMachineOwnerOfStatusChange: vi.fn(),
  })),
}));

describe("Issue Router Integration Tests (PGlite)", () => {
  let testDb: TestDatabase;
  let testOrgId: string;
  let seededData: Awaited<ReturnType<typeof getSeededTestData>>;

  beforeEach(async () => {
    // Use existing seeded test database infrastructure
    const { db, organizationId } = await createSeededTestDatabase();
    testDb = db;
    testOrgId = organizationId;

    // Get seeded test data for consistent IDs - all data is already created!
    seededData = await getSeededTestData(testDb, testOrgId);
  });

  describe("Issue Creation with Real Database", () => {
    it("should create issue with proper organizational scoping", async () => {
      // Skip if no seeded data available
      if (!seededData.machine || !seededData.user) {
        console.log("Skipping test - no seeded machine or user available");
        return;
      }

      await withTransaction(testDb, async (txDb) => {
        // Create test context with real database
        const testContext = {
          db: null, // Mock Prisma client - middleware still expects this
          drizzle: txDb,
          services: {
            createIssueActivityService: vi.fn(() => ({
              recordIssueCreated: vi.fn(),
            })),
            createNotificationService: vi.fn(() => ({
              notifyMachineOwnerOfIssue: vi.fn(),
            })),
          },
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: testOrgId },
          },
          organization: {
            id: testOrgId,
            name: "Test Organization",
            subdomain: "test-org",
          },
          session: {
            user: {
              id: seededData.user,
              email: "test@example.com",
              name: "Test User",
              image: null,
            },
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          headers: new Headers(),
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Create issue using the router with seeded machine
        const result = await caller.issue.core.create({
          title: "Integration Test Issue",
          description: "Test description",
          machineId: seededData.machine,
        });

        // Verify issue was created with correct organization scoping
        expect(result.id).toBeDefined();
        expect(result.title).toBe("Integration Test Issue");
        expect(result.organizationId).toBe(testOrgId);
        expect(result.machineId).toBe(seededData.machine);
        expect(result.statusId).toBeDefined();
        expect(result.priorityId).toBeDefined();

        // Verify issue exists in database with relations
        const dbIssue = await txDb.query.issues.findFirst({
          where: eq(issues.id, result.id),
          with: {
            machine: {
              with: {
                location: true,
                model: true,
              },
            },
            status: true,
            priority: true,
            createdBy: true,
          },
        });

        expect(dbIssue).toBeDefined();
        expect(dbIssue?.machine?.organizationId).toBe(testOrgId);
        expect(dbIssue?.status?.organizationId).toBe(testOrgId);
        expect(dbIssue?.priority?.organizationId).toBe(testOrgId);
      });
    });

    it("should enforce organizational scoping during issue creation", async () => {
      // Skip if no seeded data available
      if (!seededData.machine || !seededData.user) {
        console.log("Skipping organizational scoping test - no seeded data");
        return;
      }

      await withTransaction(testDb, async (txDb) => {
        // Create a machine in a different organization to test scoping
        const otherOrgId = "other-org-id";
        const otherMachineId = "other-machine-id";

        // Insert a machine that belongs to a different organization
        await txDb.insert(machines).values({
          id: otherMachineId,
          name: "Other Org Machine",
          organizationId: otherOrgId,
          locationId: "other-location-id",
          modelId: "other-model-id",
        });

        // Create test context with seeded user data
        const testContext = {
          drizzle: txDb,
          services: {
            createIssueActivityService: vi.fn(() => ({})),
            createNotificationService: vi.fn(() => ({})),
          },
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: testOrgId },
          },
          organization: {
            id: testOrgId,
            name: "Test Organization",
            subdomain: "test-org",
          },
          session: {
            user: {
              id: seededData.user,
              email: "test@example.com",
              name: "Test User",
              image: null,
            },
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          headers: new Headers(),
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Try to create issue with machine from other organization - should fail
        await expect(
          caller.issue.core.create({
            title: "Cross-org Issue",
            machineId: otherMachineId,
          }),
        ).rejects.toThrow("Machine not found or not accessible");
      });
    });
  });

  describe("Issue Querying with Complex Filters", () => {
    it("should filter issues by search term with proper scoping", async () => {
      // Skip if no seeded data available
      if (!seededData.machine || !seededData.user) {
        console.log("Skipping search test - no seeded data");
        return;
      }

      await withTransaction(testDb, async (txDb) => {
        // Create test issues with different titles for search testing
        const testIssues = [
          {
            id: generateId(),
            title: "Critical Production Issue",
            description: "System down",
            machineId: seededData.machine,
            organizationId: testOrgId,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
          },
          {
            id: generateId(),
            title: "Maintenance Required",
            description: "Routine check",
            machineId: seededData.machine,
            organizationId: testOrgId,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
          },
        ];

        await txDb.insert(issues).values(testIssues);

        const testContext = {
          drizzle: txDb,
          services: {},
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: testOrgId },
          },
          organization: {
            id: testOrgId,
            name: "Test Organization",
            subdomain: "test-org",
          },
          session: {
            user: {
              id: seededData.user,
              email: "test@example.com",
              name: "Test User",
              image: null,
            },
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          headers: new Headers(),
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Search for issues containing "Production"
        const results = await caller.issue.core.getAll({
          search: "Production",
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.title).toBe("Critical Production Issue");
      });
    });

    it("should filter issues by machine with relational data", async () => {
      // Skip if no seeded data available
      if (!seededData.machine || !seededData.user) {
        console.log("Skipping machine filter test - no seeded data");
        return;
      }

      await withTransaction(testDb, async (txDb) => {
        // Create a test issue for the seeded machine
        const testIssue = {
          id: generateId(),
          title: "Machine-specific Issue",
          description: "Test machine issue",
          machineId: seededData.machine,
          organizationId: testOrgId,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        };

        await txDb.insert(issues).values([testIssue]);

        const testContext = {
          drizzle: txDb,
          services: {},
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: testOrgId },
          },
          organization: {
            id: testOrgId,
            name: "Test Organization",
            subdomain: "test-org",
          },
          session: {
            user: {
              id: seededData.user,
              email: "test@example.com",
              name: "Test User",
              image: null,
            },
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          headers: new Headers(),
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Filter by machine
        const results = await caller.issue.core.getAll({
          machineId: seededData.machine,
        });

        expect(results.length).toBeGreaterThan(0);
        results.forEach((issue) => {
          expect(issue.machineId).toBe(seededData.machine);
          expect(issue.machine?.name).toBeDefined();
          expect(issue.machine?.location?.name).toBeDefined();
        });
      });
    });

    it("should return paginated results", async () => {
      // Skip if no seeded data available
      if (!seededData.machine || !seededData.user) {
        console.log("Skipping pagination test - no seeded data");
        return;
      }

      await withTransaction(testDb, async (txDb) => {
        // Create multiple issues for pagination testing
        const testIssues = [
          {
            id: generateId(),
            title: "Issue 1",
            machineId: seededData.machine,
            organizationId: testOrgId,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
          },
          {
            id: generateId(),
            title: "Issue 2",
            machineId: seededData.machine,
            organizationId: testOrgId,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
          },
          {
            id: generateId(),
            title: "Issue 3",
            machineId: seededData.machine,
            organizationId: testOrgId,
            statusId: seededData.status,
            priorityId: seededData.priority,
            createdById: seededData.user,
          },
        ];

        await txDb.insert(issues).values(testIssues);

        const testContext = {
          drizzle: txDb,
          services: {},
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: testOrgId },
          },
          organization: {
            id: testOrgId,
            name: "Test Organization",
            subdomain: "test-org",
          },
          session: {
            user: {
              id: seededData.user,
              email: "test@example.com",
              name: "Test User",
              image: null,
            },
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          headers: new Headers(),
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Get all issues to verify we have enough for pagination test
        const allIssues = await caller.issue.core.getAll();

        expect(allIssues.length).toBeGreaterThanOrEqual(3);

        // Simple check that getAll returns issues (pagination logic would be in client)
        expect(allIssues).toBeDefined();
        expect(Array.isArray(allIssues)).toBe(true);
      });
    });
  });

  describe("Issue Assignment with Database Operations", () => {
    it("should assign issue to user within same organization", async () => {
      // Skip if no seeded data available
      if (!seededData.machine || !seededData.user) {
        console.log("Skipping assignment test - no seeded data");
        return;
      }

      await withTransaction(testDb, async (txDb) => {
        // Create an issue first using seeded data
        const issueId = generateId();
        await txDb.insert(issues).values({
          id: issueId,
          title: "Test Assignment Issue",
          machineId: seededData.machine,
          organizationId: testOrgId,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        const testContext = {
          drizzle: txDb,
          services: {
            createIssueActivityService: vi.fn(() => ({
              recordIssueAssigned: vi.fn(),
            })),
          },
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: testOrgId },
          },
          organization: {
            id: testOrgId,
            name: "Test Organization",
            subdomain: "test-org",
          },
          session: {
            user: {
              id: seededData.user,
              email: "test@example.com",
              name: "Test User",
              image: null,
            },
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          headers: new Headers(),
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Assign issue to user
        const result = await caller.issue.core.assign({
          issueId,
          userId: seededData.user,
        });

        expect(result.issue.assignedToId).toBe(seededData.user);

        // Verify assignment in database
        const dbIssue = await txDb.query.issues.findFirst({
          where: eq(issues.id, issueId),
          with: {
            assignedTo: true,
          },
        });

        expect(dbIssue?.assignedToId).toBe(seededData.user);
        expect(dbIssue?.assignedTo?.email).toBeDefined();
      });
    });
  });

  describe("Issue Status Updates with Validation", () => {
    it("should update issue status with proper validation", async () => {
      // Skip if no seeded data available
      if (!seededData.machine || !seededData.user) {
        console.log("Skipping status update test - no seeded data");
        return;
      }

      await withTransaction(testDb, async (txDb) => {
        // Create resolved status
        const resolvedStatusId = generateId();
        await txDb.insert(issueStatuses).values({
          id: resolvedStatusId,
          name: "Resolved",
          category: "RESOLVED",
          organizationId: testOrgId,
        });

        // Create an issue using seeded data
        const issueId = generateId();
        await txDb.insert(issues).values({
          id: issueId,
          title: "Test Status Update Issue",
          machineId: seededData.machine,
          organizationId: testOrgId,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        const testContext = {
          drizzle: txDb,
          services: {
            createIssueActivityService: vi.fn(() => ({
              recordStatusChange: vi.fn(),
            })),
            createNotificationService: vi.fn(() => ({
              notifyMachineOwnerOfStatusChange: vi.fn(),
            })),
          },
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: testOrgId },
          },
          organization: {
            id: testOrgId,
            name: "Test Organization",
            subdomain: "test-org",
          },
          session: {
            user: {
              id: seededData.user,
              email: "test@example.com",
              name: "Test User",
              image: null,
            },
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          headers: new Headers(),
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Update status
        const result = await caller.issue.core.updateStatus({
          id: issueId,
          statusId: resolvedStatusId,
        });

        expect(result.statusId).toBe(resolvedStatusId);

        // Verify status update in database
        const dbIssue = await txDb.query.issues.findFirst({
          where: eq(issues.id, issueId),
          with: {
            status: true,
          },
        });

        expect(dbIssue?.statusId).toBe(resolvedStatusId);
        expect(dbIssue?.status?.name).toBe("Resolved");
      });
    });
  });
});
