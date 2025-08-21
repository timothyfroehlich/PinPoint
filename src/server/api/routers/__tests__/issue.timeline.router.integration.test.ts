/**
 * Issue Timeline Router Integration Tests (PGlite)
 * Tests timeline router procedures with real database operations using seeded data
 * Memory-safe worker-scoped pattern with transaction isolation
 */

import { eq, sql } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

import { generateId } from "~/lib/utils/id-generation";
import { appRouter } from "~/server/api/root";
import { issues } from "~/server/db/schema";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { getSeededTestData } from "~/test/helpers/pglite-test-setup";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Helper function to create test context with proper mocks
const createTestContext = async (
  txDb: any,
  testOrgId: string,
  userId: string,
) => {
  return {
    db: txDb, // Use Drizzle client directly
    services: {
      createIssueActivityService: vi.fn(() => ({
        getIssueTimeline: vi.fn().mockResolvedValue([
          {
            id: "activity-1",
            type: "comment",
            content: "Test comment in timeline",
            createdAt: new Date(),
            authorId: userId,
            author: {
              id: userId,
              name: "Test User",
              email: "test@example.com",
            },
          },
          {
            id: "activity-2",
            type: "status_change",
            content: "Status changed from Open to In Progress",
            createdAt: new Date(),
            authorId: userId,
            author: {
              id: userId,
              name: "Test User",
              email: "test@example.com",
            },
          },
        ]),
      })),
      createNotificationService: vi.fn(() => ({
        notifyMachineOwnerOfIssue: vi.fn(),
        notifyMachineOwnerOfStatusChange: vi.fn(),
      })),
    },
    user: {
      id: userId,
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
        id: userId,
        email: "test@example.com",
        name: "Test User",
        image: null,
      },
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    },
    headers: new Headers(),
    userPermissions: ["issue:view", "timeline:view"],
  };
};

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
        "timeline:view",
        "admin:view",
      ]),
    getUserPermissionsForSupabaseUser: vi
      .fn()
      .mockResolvedValue([
        "issue:view",
        "timeline:view", 
        "admin:view",
      ]),
    requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock service modules
vi.mock("~/server/services/factory", () => ({
  createIssueActivityService: vi.fn(() => ({
    getIssueTimeline: vi.fn().mockResolvedValue([
      {
        id: "mock-activity-1",
        type: "comment",
        content: "Mock timeline activity",
        createdAt: new Date(),
        authorId: "test-user",
        author: {
          id: "test-user",
          name: "Test User",
          email: "test@example.com",
        },
      },
    ]),
  })),
  createNotificationService: vi.fn(() => ({
    notifyMachineOwnerOfIssue: vi.fn(),
    notifyMachineOwnerOfStatusChange: vi.fn(),
  })),
}));

describe("Issue Timeline Router Integration Tests (PGlite)", () => {
  describe("Timeline Retrieval", () => {
    test("should retrieve issue timeline with proper organizational scoping", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
        
        // Use seeded data for real relationships
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create an issue first using seeded data
        const issueId = generateId();
        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Timeline",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        // Create test context with real database
        const testContext = (await createTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        )) as any;

        const caller = appRouter.createCaller(testContext);

        // Get issue timeline
        const result = await caller.issue.timeline.getTimeline({
          issueId: issueId,
        });

        // Verify timeline was retrieved
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);

        // Verify the service was called with correct issue ID
        expect(testContext.services.createIssueActivityService).toHaveBeenCalled();
        const mockActivityService = testContext.services.createIssueActivityService();
        expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(issueId);
      });
    });

    test("should return NOT_FOUND for non-existent issues", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
        
        // Use seeded data for real relationships
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create test context with seeded user data
        const testContext = (await createTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        )) as any;

        const caller = appRouter.createCaller(testContext);

        // Try to get timeline for non-existent issue - should fail
        await expect(
          caller.issue.timeline.getTimeline({
            issueId: "non-existent-issue-id",
          }),
        ).rejects.toThrow("Issue not found or access denied");
      });
    });

    test("should enforce cross-organizational issue access", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for competitor org first to create data there
        await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.competitor}`);
        
        // Get seeded data for competitor org
        const competitorSeededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.competitor);
        
        // Skip if no seeded data available
        if (!competitorSeededData.user) {
          console.log("Skipping test - no competitor org seeded user available");
          return;
        }

        // Create an issue in competitor organization
        const issueId = generateId();
        await db.insert(issues).values({
          id: issueId,
          title: "Cross-org Issue for Timeline",
          description: "Test description",
          machineId: competitorSeededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          statusId: competitorSeededData.status,
          priorityId: competitorSeededData.priority,
          createdById: competitorSeededData.user,
        });

        // Now switch to primary org and try to access competitor org data
        await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
        const primarySeededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        if (!primarySeededData.user) {
          console.log("Skipping test - no primary org seeded user available");
          return;
        }

        const testContext = (await createTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary, // User's org
          primarySeededData.user,
        )) as any;

        const caller = appRouter.createCaller(testContext);

        // Try to get timeline for issue from different org - should fail
        await expect(
          caller.issue.timeline.getTimeline({
            issueId: issueId,
          }),
        ).rejects.toThrow("Issue not found or access denied");
      });
    });

    test("should handle timeline service integration", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Set RLS context for primary org
        await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
        
        // Use seeded data for real relationships
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create an issue first using seeded data
        const issueId = generateId();
        await db.insert(issues).values({
          id: issueId,
          title: "Test Issue for Timeline Service",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        // Create custom test context with specific timeline data
        const customTimelineData = [
          {
            id: "timeline-1",
            type: "comment",
            content: "Initial comment",
            createdAt: new Date("2024-01-01T10:00:00Z"),
            authorId: seededData.user,
            author: {
              id: seededData.user,
              name: "Test User",
              email: "test@example.com",
            },
          },
          {
            id: "timeline-2",
            type: "status_change",
            content: "Status changed from Open to In Progress",
            createdAt: new Date("2024-01-01T11:00:00Z"),
            authorId: seededData.user,
            author: {
              id: seededData.user,
              name: "Test User", 
              email: "test@example.com",
            },
          },
          {
            id: "timeline-3",
            type: "comment",
            content: "Follow-up comment",
            createdAt: new Date("2024-01-01T12:00:00Z"),
            authorId: seededData.user,
            author: {
              id: seededData.user,
              name: "Test User",
              email: "test@example.com",
            },
          },
        ];

        const testContext = {
          db: db,
          services: {
            createIssueActivityService: vi.fn(() => ({
              getIssueTimeline: vi.fn().mockResolvedValue(customTimelineData),
            })),
          },
          user: {
            id: seededData.user,
            email: "test@example.com",
            user_metadata: { name: "Test User" },
            app_metadata: { organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary },
          },
          organization: {
            id: SEED_TEST_IDS.ORGANIZATIONS.primary,
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
          userPermissions: ["issue:view", "timeline:view"],
        } as any;

        const caller = appRouter.createCaller(testContext);

        // Get issue timeline
        const result = await caller.issue.timeline.getTimeline({
          issueId: issueId,
        });

        // Verify timeline structure and content
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(3);

        // Verify timeline entries are properly structured
        const [comment1, statusChange, comment2] = result;
        
        expect(comment1?.type).toBe("comment");
        expect(comment1?.content).toBe("Initial comment");
        expect(comment1?.authorId).toBe(seededData.user);
        
        expect(statusChange?.type).toBe("status_change");
        expect(statusChange?.content).toBe("Status changed from Open to In Progress");
        expect(statusChange?.authorId).toBe(seededData.user);
        
        expect(comment2?.type).toBe("comment");
        expect(comment2?.content).toBe("Follow-up comment");
        expect(comment2?.authorId).toBe(seededData.user);

        // Verify service integration
        const mockActivityService = testContext.services.createIssueActivityService();
        expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(issueId);
      });
    });
  });

  describe("Timeline Access Control", () => {
    test("should respect organizational boundaries in timeline access", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test that users can only access timelines for issues in their org
        
        // Set RLS context for primary org  
        await db.execute(sql`SET app.current_organization_id = ${SEED_TEST_IDS.ORGANIZATIONS.primary}`);
        
        // Use seeded data for real relationships
        const seededData = await getSeededTestData(db, SEED_TEST_IDS.ORGANIZATIONS.primary);
        
        // Skip if no seeded data available
        if (!seededData.user) {
          console.log("Skipping test - no seeded user available");
          return;
        }

        // Create an issue in primary org
        const primaryIssueId = generateId();
        await db.insert(issues).values({
          id: primaryIssueId,
          title: "Primary Org Issue",
          description: "Test description",
          machineId: seededData.machine,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          statusId: seededData.status,
          priorityId: seededData.priority,
          createdById: seededData.user,
        });

        // Create test context for primary org user
        const testContext = (await createTestContext(
          db,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          seededData.user,
        )) as any;

        const caller = appRouter.createCaller(testContext);

        // Should be able to access timeline for own org's issue
        const result = await caller.issue.timeline.getTimeline({
          issueId: primaryIssueId,
        });

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);

        // Verify the issue exists in database with correct org
        const dbIssue = await db.query.issues.findFirst({
          where: eq(issues.id, primaryIssueId),
        });

        expect(dbIssue).toBeDefined();
        expect(dbIssue?.organizationId).toBe(SEED_TEST_IDS.ORGANIZATIONS.primary);
      });
    });
  });
});