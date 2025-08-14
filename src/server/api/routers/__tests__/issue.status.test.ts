import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/unbound-method */

// Mock NextAuth first to avoid import issues
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

import { appRouter } from "~/server/api/root";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

describe("issueStatusRouter", () => {
  let ctx: VitestMockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createVitestMockContext();

    // Set up authenticated user with organization
    ctx.user = {
      id: "user-1",
      email: "test@example.com",
      user_metadata: { name: "Test User" },
      app_metadata: { organization_id: "org-1" },
    } as any;

    ctx.organization = {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test",
    };

    // Mock membership with role and permissions for organizationProcedure
    const mockMembership = {
      id: "membership-1",
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: {
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      },
    };

    ctx.membership = mockMembership;

    // Mock the database membership lookup that organizationProcedure expects
    vi.mocked(ctx.db.membership.findFirst).mockResolvedValue(
      mockMembership as any,
    );
  });

  describe("getStatusCounts", () => {
    it("should return status counts for organization", async () => {
      // Mock status data for the organization
      const mockStatuses = [
        { id: "status-1", category: "NEW" },
        { id: "status-2", category: "IN_PROGRESS" },
        { id: "status-3", category: "RESOLVED" },
      ];

      // Mock issue counts by status
      const mockIssueCounts = [
        { statusId: "status-1", count: 5 },
        { statusId: "status-2", count: 3 },
        { statusId: "status-3", count: 8 },
      ];

      // Set up Drizzle mock chain for statuses query
      const statusSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(statusSelectQuery);

      // Set up Drizzle mock chain for issues count query
      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(issueCountQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.status.getStatusCounts();

      expect(result).toEqual({
        NEW: 5,
        IN_PROGRESS: 3,
        RESOLVED: 8,
      });

      // Verify organization scoping was applied
      expect(statusSelectQuery.where).toHaveBeenCalledWith(
        expect.anything(), // eq(issueStatuses.organizationId, ctx.organization.id)
      );
      expect(issueCountQuery.where).toHaveBeenCalledWith(
        expect.anything(), // eq(issues.organizationId, ctx.organization.id)
      );
    });

    it("should handle empty results", async () => {
      // Mock empty status and issue data
      const statusSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(statusSelectQuery);

      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(issueCountQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.status.getStatusCounts();

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

      const statusSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(statusSelectQuery);

      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]), // No issues
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(issueCountQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.status.getStatusCounts();

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

      const statusSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(statusSelectQuery);

      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(issueCountQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.status.getStatusCounts();

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

      const statusSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(statusSelectQuery);

      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(issueCountQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.status.getStatusCounts();

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

      const statusSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(statusSelectQuery);

      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(issueCountQuery);

      const caller = appRouter.createCaller(ctx as any);
      const result = await caller.issue.status.getStatusCounts();

      expect(result).toEqual({
        NEW: 2,
        IN_PROGRESS: 3,
        RESOLVED: 0,
        // Unknown status count is ignored
      });
    });

    it("should require authentication", async () => {
      const caller = appRouter.createCaller({ ...ctx, user: null } as any);

      await expect(caller.issue.status.getStatusCounts()).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });

    it("should require organization context", async () => {
      const caller = appRouter.createCaller({
        ...ctx,
        organization: null,
      } as any);

      await expect(caller.issue.status.getStatusCounts()).rejects.toThrow();
    });

    it("should enforce organization isolation", async () => {
      // Create context for different organization
      const otherOrgCtx = {
        ...ctx,
        organization: {
          id: "org-2",
          name: "Other Organization",
          subdomain: "other",
        },
      };

      const mockStatuses = [{ id: "status-1", category: "NEW" }];

      const mockIssueCounts = [{ statusId: "status-1", count: 10 }];

      const statusSelectQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockStatuses),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(statusSelectQuery);

      const issueCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(mockIssueCounts),
      };
      vi.mocked(ctx.drizzle.select).mockReturnValueOnce(issueCountQuery);

      const caller = appRouter.createCaller(otherOrgCtx as any);
      await caller.issue.status.getStatusCounts();

      // Verify queries were called with the correct organization ID
      expect(statusSelectQuery.where).toHaveBeenCalledWith(
        expect.anything(), // Should be eq(issueStatuses.organizationId, "org-2")
      );
      expect(issueCountQuery.where).toHaveBeenCalledWith(
        expect.anything(), // Should be eq(issues.organizationId, "org-2")
      );
    });
  });
});
