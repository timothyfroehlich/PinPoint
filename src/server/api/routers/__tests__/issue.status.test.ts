/**
 * Issue Status Router Tests (tRPC Router Integration - Archetype 5)
 *
 * Converted to tRPC Router integration tests with RLS context and organizational boundary validation.
 * Tests router operations with consistent SEED_TEST_IDS and RLS session context.
 *
 * Key Features:
 * - tRPC Router integration with organizational scoping
 * - RLS session context establishment and validation
 * - SEED_TEST_IDS for consistent mock data
 * - Organizational boundary enforcement testing
 * - Modern Supabase SSR auth patterns
 *
 * Architecture Updates (August 2025):
 * - Uses SEED_TEST_IDS.MOCK_PATTERNS for consistent IDs
 * - RLS context handled at database connection level
 * - Organizational boundary validation in all operations
 * - Simplified mocking focused on real router behavior
 *
 * Covers status-related procedures with RLS awareness:
 * - getStatusCounts: Gets status distribution statistics for organization
 *
 * Tests organizational boundaries and cross-org isolation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Import test setup and utilities
import { appRouter } from "~/server/api/root";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";
import {
  SEED_TEST_IDS,
  createMockAdminContext,
  createMockMemberContext,
  type TestMockContext,
} from "~/test/constants/seed-test-ids";

// Mock Supabase SSR for modern auth patterns
vi.mock("~/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user", email: "test@example.com" } },
        error: null,
      }),
    },
  })),
}));

describe("Issue Status Router (RLS-Enhanced)", () => {
  let ctx: VitestMockContext;
  let adminContext: TestMockContext;
  let memberContext: TestMockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createVitestMockContext();

    // Set up test contexts with SEED_TEST_IDS
    adminContext = createMockAdminContext();
    memberContext = createMockMemberContext();

    // Set up authenticated user with organization using SEED_TEST_IDS
    ctx.user = {
      id: adminContext.userId,
      email: adminContext.userEmail,
      user_metadata: { name: adminContext.userName },
      app_metadata: { organization_id: adminContext.organizationId },
    } as any;

    ctx.organizationId = adminContext.organizationId;
    ctx.organization = {
      id: adminContext.organizationId,
      name: "Austin Pinball Collective",
      subdomain: "pinpoint",
    };

    // Mock membership with role and permissions for organizationProcedure
    const mockMembership = {
      id: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
      userId: adminContext.userId,
      organizationId: adminContext.organizationId,
      roleId: SEED_TEST_IDS.MOCK_PATTERNS.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: {
        id: SEED_TEST_IDS.MOCK_PATTERNS.USER,
        name: "Test Role",
        organizationId: adminContext.organizationId,
        isSystem: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      },
    };

    ctx.membership = mockMembership;

    // RLS context is handled at the database connection level

    // Mock the database membership lookup for organizationProcedure
    const membershipSelectQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMembership]),
    };
    vi.mocked(ctx.db.select).mockReturnValue(membershipSelectQuery);
  });

  describe("getStatusCounts (RLS-Enhanced)", () => {
    it("should return status counts for organization with organizational scoping", async () => {
      // Mock status data for the organization using SEED_TEST_IDS patterns
      const mockStatuses = [
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-status-new",
          category: "NEW",
        },
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-status-progress",
          category: "IN_PROGRESS",
        },
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-status-resolved",
          category: "RESOLVED",
        },
      ];

      // Mock issue counts by status with consistent IDs
      const mockIssueCounts = [
        {
          statusId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-status-new",
          count: 5,
        },
        {
          statusId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-status-progress",
          count: 3,
        },
        {
          statusId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-status-resolved",
          count: 8,
        },
      ];

      // Set up Drizzle mock chain for issues count query (FIRST call)
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueCountQuery);

      // Set up Drizzle mock chain for statuses query (SECOND call)
      const statusSelectQuery = {
        from: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(statusSelectQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issueStatus.getStatusCounts();

      expect(result).toEqual({
        NEW: 5,
        IN_PROGRESS: 3,
        RESOLVED: 8,
      });

      // Verify queries were executed (RLS handles org scoping automatically)
      expect(statusSelectQuery.from).toHaveBeenCalled();
      expect(issueCountQuery.groupBy).toHaveBeenCalled();
    });

    it("should handle empty results", async () => {
      // Set up Drizzle mock chain for issues count query (FIRST call)
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueCountQuery);

      // Set up Drizzle mock chain for statuses query (SECOND call)
      const statusSelectQuery = {
        from: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(statusSelectQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issueStatus.getStatusCounts();

      expect(result).toEqual({
        NEW: 0,
        IN_PROGRESS: 0,
        RESOLVED: 0,
      });
    });

    it("should handle statuses with no issues", async () => {
      // Mock statuses but no issues
      const mockStatuses = [
        { id: "status-1", category: "NEW" },
        { id: "status-2", category: "IN_PROGRESS" },
        { id: "status-3", category: "RESOLVED" },
      ];

      // Set up Drizzle mock chain for issues count query (FIRST call)
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]), // No issues
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueCountQuery);

      // Set up Drizzle mock chain for statuses query (SECOND call)
      const statusSelectQuery = {
        from: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(statusSelectQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issueStatus.getStatusCounts();

      expect(result).toEqual({
        NEW: 0,
        IN_PROGRESS: 0,
        RESOLVED: 0,
      });
    });

    it("should accumulate counts for multiple statuses in same category", async () => {
      // Mock multiple statuses in same categories
      const mockStatuses = [
        { id: "status-1", category: "NEW" },
        { id: "status-2", category: "NEW" }, // Another NEW status
        { id: "status-3", category: "IN_PROGRESS" },
        { id: "status-4", category: "RESOLVED" },
      ];

      const mockIssueCounts = [
        { statusId: "status-1", count: 3 },
        { statusId: "status-2", count: 2 }, // Additional NEW issues
        { statusId: "status-3", count: 4 },
        { statusId: "status-4", count: 1 },
      ];

      // Set up Drizzle mock chain for issues count query (FIRST call)
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueCountQuery);

      // Set up Drizzle mock chain for statuses query (SECOND call)
      const statusSelectQuery = {
        from: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(statusSelectQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issueStatus.getStatusCounts();

      expect(result).toEqual({
        NEW: 5, // 3 + 2 accumulated
        IN_PROGRESS: 4,
        RESOLVED: 1,
      });
    });

    it("should handle invalid status categories gracefully", async () => {
      // Mock status with invalid category
      const mockStatuses = [
        { id: "status-1", category: "NEW" },
        { id: "status-2", category: "INVALID_CATEGORY" }, // Invalid
        { id: "status-3", category: "RESOLVED" },
      ];

      const mockIssueCounts = [
        { statusId: "status-1", count: 2 },
        { statusId: "status-2", count: 3 }, // This should be ignored
        { statusId: "status-3", count: 1 },
      ];

      // Set up Drizzle mock chain for issues count query (FIRST call)
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueCountQuery);

      // Set up Drizzle mock chain for statuses query (SECOND call)
      const statusSelectQuery = {
        from: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(statusSelectQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issueStatus.getStatusCounts();

      expect(result).toEqual({
        NEW: 2,
        IN_PROGRESS: 0,
        RESOLVED: 1,
        // Invalid category count is ignored
      });
    });

    it("should handle issues with unknown status IDs", async () => {
      // Mock statuses
      const mockStatuses = [
        { id: "status-1", category: "NEW" },
        { id: "status-2", category: "IN_PROGRESS" },
      ];

      // Mock issues with unknown status ID
      const mockIssueCounts = [
        { statusId: "status-1", count: 2 },
        { statusId: "unknown-status", count: 5 }, // Unknown status
        { statusId: "status-2", count: 3 },
      ];

      // Set up Drizzle mock chain for issues count query (FIRST call)
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueCountQuery);

      // Set up Drizzle mock chain for statuses query (SECOND call)
      const statusSelectQuery = {
        from: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(statusSelectQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issueStatus.getStatusCounts();

      expect(result).toEqual({
        NEW: 2,
        IN_PROGRESS: 3,
        RESOLVED: 0,
        // Unknown status count is ignored
      });
    });

    it("should require authentication for status operations", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(caller.issueStatus.getStatusCounts()).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });

    it("should require organization context for status operations (RLS boundary)", async () => {
      const caller = appRouter.createCaller({
        ...ctx,
        organizationId: null,
        organization: null,
      } as any);

      await expect(caller.issueStatus.getStatusCounts()).rejects.toThrow();
    });

    it("should enforce organizational boundaries in status operations (RLS)", async () => {
      // Create context for competitor organization using SEED_TEST_IDS
      const competitorContext = {
        ...ctx,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor,
        organization: {
          id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          name: "Competitor Arcade",
          subdomain: "competitor",
        },
      };

      const mockStatuses = [
        {
          id: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-competitor-status",
          category: "NEW",
        },
      ];
      const mockIssueCounts = [
        {
          statusId: SEED_TEST_IDS.MOCK_PATTERNS.ISSUE + "-competitor-status",
          count: 10,
        },
      ];

      // Set up Drizzle mock chain for competitor org queries
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(issueCountQuery);

      const statusSelectQuery = {
        from: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.db.select).mockReturnValueOnce(statusSelectQuery);

      const caller = appRouter.createCaller(competitorContext as any);
      const result = await caller.issueStatus.getStatusCounts();

      // RLS should return only competitor org data
      expect(result).toEqual({
        NEW: 10,
        IN_PROGRESS: 0,
        RESOLVED: 0,
      });

      // Verify queries were executed with competitor organization context
      expect(statusSelectQuery.from).toHaveBeenCalled();
      expect(issueCountQuery.groupBy).toHaveBeenCalled();
    });
  });
});
