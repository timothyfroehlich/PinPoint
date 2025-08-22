/**
 * Issue Timeline Router Integration Tests (PGlite)
 * Tests timeline router procedures with real database operations using seeded data
 * Memory-safe worker-scoped pattern with transaction isolation
 */

import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";

import { generateId } from "~/lib/utils/id-generation";
import { appRouter } from "~/server/api/root";
import { issues } from "~/server/db/schema";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createSeededIssueTestContext } from "~/test/helpers/createSeededIssueTestContext";
import { withRLSSecurityContext } from "~/test/helpers/rls-security-context";

// Note: Replaced local createTestContext with shared createSeededIssueTestContext helper

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
      .mockResolvedValue(["issue:view", "timeline:view", "admin:view"]),
    getUserPermissionsForSupabaseUser: vi
      .fn()
      .mockResolvedValue(["issue:view", "timeline:view", "admin:view"]),
    requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
  };
});

// Note: Service mocks now handled by createSeededIssueTestContext helper

describe("Issue Timeline Router Integration Tests (PGlite)", () => {
  describe("Timeline Retrieval", () => {
    test("should retrieve issue timeline with proper organizational scoping", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        await withRLSSecurityContext(
          db,
          {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            userId: SEED_TEST_IDS.USERS.ADMIN,
            userRole: "admin",
          },
          async (db) => {
            // Create an issue first using seeded data
            const issueId = generateId();
            await db.insert(issues).values({
              id: issueId,
              title: "Test Issue for Timeline",
              description: "Test description",
              machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
              organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
              statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
              priorityId: SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY,
              createdById: SEED_TEST_IDS.USERS.ADMIN,
            });

            // Create test context with real database
            const testContext = await createSeededIssueTestContext(
              db,
              SEED_TEST_IDS.ORGANIZATIONS.primary,
              SEED_TEST_IDS.USERS.ADMIN,
            );

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
            expect(
              testContext.services.createIssueActivityService,
            ).toHaveBeenCalled();
            const mockActivityService =
              testContext.services.createIssueActivityService();
            expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(
              issueId,
            );
          },
        );
      });
    });

    test("should return NOT_FOUND for non-existent issues", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        await withRLSSecurityContext(
          db,
          {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            userId: SEED_TEST_IDS.USERS.ADMIN,
            userRole: "admin",
          },
          async (db) => {
            // Create test context with seeded user data
            const testContext = await createSeededIssueTestContext(
              db,
              SEED_TEST_IDS.ORGANIZATIONS.primary,
              SEED_TEST_IDS.USERS.ADMIN,
            );

            const caller = appRouter.createCaller(testContext);

            // Try to get timeline for non-existent issue - should fail
            await expect(
              caller.issue.timeline.getTimeline({
                issueId: "non-existent-issue-id",
              }),
            ).rejects.toThrow("Issue not found or access denied");
          },
        );
      });
    });

    test("should enforce cross-organizational issue access", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        let issueId: string;

        // Create an issue in competitor organization
        await withRLSSecurityContext(
          db,
          {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
            userId: SEED_TEST_IDS.USERS.ADMIN,
            userRole: "admin",
          },
          async (db) => {
            issueId = generateId();
            await db.insert(issues).values({
              id: issueId,
              title: "Cross-org Issue for Timeline",
              description: "Test description",
              machineId: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
              organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
              statusId: SEED_TEST_IDS.STATUSES.NEW_COMPETITOR,
              priorityId: SEED_TEST_IDS.PRIORITIES.HIGH_COMPETITOR,
              createdById: SEED_TEST_IDS.USERS.ADMIN,
            });
          },
        );

        // Now switch to primary org and try to access competitor org data
        await withRLSSecurityContext(
          db,
          {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            userId: SEED_TEST_IDS.USERS.ADMIN,
            userRole: "admin",
          },
          async (db) => {
            const testContext = await createSeededIssueTestContext(
              db,
              SEED_TEST_IDS.ORGANIZATIONS.primary, // User's org
              SEED_TEST_IDS.USERS.ADMIN,
            );

            const caller = appRouter.createCaller(testContext);

            // Try to get timeline for issue from different org - should fail
            await expect(
              caller.issue.timeline.getTimeline({
                issueId: issueId,
              }),
            ).rejects.toThrow("Issue not found or access denied");
          },
        );
      });
    });

    test("should handle timeline service integration", async ({ workerDb }) => {
      await withIsolatedTest(workerDb, async (db) => {
        await withRLSSecurityContext(
          db,
          {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            userId: SEED_TEST_IDS.USERS.ADMIN,
            userRole: "admin",
          },
          async (db) => {
            // Create an issue first using seeded data
            const issueId = generateId();
            await db.insert(issues).values({
              id: issueId,
              title: "Test Issue for Timeline Service",
              description: "Test description",
              machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
              organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
              statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
              priorityId: SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY,
              createdById: SEED_TEST_IDS.USERS.ADMIN,
            });

            // Create custom test context with specific timeline data
            const customTimelineData = [
              {
                id: "timeline-1",
                type: "comment",
                content: "Initial comment",
                createdAt: new Date("2024-01-01T10:00:00Z"),
                authorId: SEED_TEST_IDS.USERS.ADMIN,
                author: {
                  id: SEED_TEST_IDS.USERS.ADMIN,
                  name: "Test User",
                  email: "test@example.com",
                },
              },
              {
                id: "timeline-2",
                type: "status_change",
                content: "Status changed from Open to In Progress",
                createdAt: new Date("2024-01-01T11:00:00Z"),
                authorId: SEED_TEST_IDS.USERS.ADMIN,
                author: {
                  id: SEED_TEST_IDS.USERS.ADMIN,
                  name: "Test User",
                  email: "test@example.com",
                },
              },
              {
                id: "timeline-3",
                type: "comment",
                content: "Follow-up comment",
                createdAt: new Date("2024-01-01T12:00:00Z"),
                authorId: SEED_TEST_IDS.USERS.ADMIN,
                author: {
                  id: SEED_TEST_IDS.USERS.ADMIN,
                  name: "Test User",
                  email: "test@example.com",
                },
              },
            ];

            const testContext = {
              db: db,
              organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary, // This is required for orgScopedProcedure
              services: {
                createIssueActivityService: vi.fn(() => ({
                  getIssueTimeline: vi
                    .fn()
                    .mockResolvedValue(customTimelineData),
                })),
              },
              user: {
                id: SEED_TEST_IDS.USERS.ADMIN,
                email: "test@example.com",
                user_metadata: { name: "Test User" },
                app_metadata: {
                  organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
                },
              },
              organization: {
                id: SEED_TEST_IDS.ORGANIZATIONS.primary,
                name: "Test Organization",
                subdomain: "test-org",
              },
              session: {
                user: {
                  id: SEED_TEST_IDS.USERS.ADMIN,
                  email: "test@example.com",
                  name: "Test User",
                  image: null,
                },
                expires: new Date(
                  Date.now() + 1000 * 60 * 60 * 24,
                ).toISOString(),
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
            expect(comment1?.authorId).toBe(SEED_TEST_IDS.USERS.ADMIN);

            expect(statusChange?.type).toBe("status_change");
            expect(statusChange?.content).toBe(
              "Status changed from Open to In Progress",
            );
            expect(statusChange?.authorId).toBe(SEED_TEST_IDS.USERS.ADMIN);

            expect(comment2?.type).toBe("comment");
            expect(comment2?.content).toBe("Follow-up comment");
            expect(comment2?.authorId).toBe(SEED_TEST_IDS.USERS.ADMIN);

            // Verify service integration
            const mockActivityService =
              testContext.services.createIssueActivityService();
            expect(mockActivityService.getIssueTimeline).toHaveBeenCalledWith(
              issueId,
            );
          },
        );
      });
    });
  });

  describe("Timeline Access Control", () => {
    test("should respect organizational boundaries in timeline access", async ({
      workerDb,
    }) => {
      await withIsolatedTest(workerDb, async (db) => {
        // Test that users can only access timelines for issues in their org

        await withRLSSecurityContext(
          db,
          {
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            userId: SEED_TEST_IDS.USERS.ADMIN,
            userRole: "admin",
          },
          async (db) => {
            // Create an issue in primary org
            const primaryIssueId = generateId();
            await db.insert(issues).values({
              id: primaryIssueId,
              title: "Primary Org Issue",
              description: "Test description",
              machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
              organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
              statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
              priorityId: SEED_TEST_IDS.PRIORITIES.HIGH_PRIMARY,
              createdById: SEED_TEST_IDS.USERS.ADMIN,
            });

            // Create test context for primary org user
            const testContext = await createSeededIssueTestContext(
              db,
              SEED_TEST_IDS.ORGANIZATIONS.primary,
              SEED_TEST_IDS.USERS.ADMIN,
            );

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
            expect(dbIssue?.organizationId).toBe(
              SEED_TEST_IDS.ORGANIZATIONS.primary,
            );
          },
        );
      });
    });
  });
});
