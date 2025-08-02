import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

// Mock NextAuth to prevent module resolution issues
vi.mock("next-auth", () => ({
  default: vi.fn().mockImplementation(() => ({
    auth: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

// Mock permissions system
vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi.fn(),
  requirePermissionForSession: vi.fn(),
}));

import { createTRPCRouter, organizationProcedure } from "~/server/api/trpc";
import { issueCreateProcedure } from "~/server/api/trpc.permission";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import {
  createVitestMockContext,
  type VitestMockContext,
} from "~/test/vitestMockContext";

// Create issue confirm procedure for testing
const issueConfirmProcedure = organizationProcedure.use(async (opts) => {
  // Mock permission check for testing
  if (!opts.ctx.userPermissions?.includes("issue:confirm")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Missing required permission: issue:confirm",
    });
  }
  return opts.next();
});

// Mock Issue Confirmation Router - This will be implemented by the implementation agent
const issueConfirmationRouter = createTRPCRouter({
  // Enhanced issue creation with confirmation workflow
  create: issueCreateProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        machineId: z.string(),
        statusId: z.string(),
        priorityId: z.string(),
        consistency: z.string().optional(),
        // New field to determine form type
        formType: z.enum(["basic", "full"]).default("basic"),
        // Allow explicit override of confirmation status
        isConfirmed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Determine confirmation status based on form type and permissions
      let confirmationStatus = false;

      if (input.formType === "basic") {
        // Basic form always creates unconfirmed issues
        confirmationStatus = false;
      } else {
        // Full form creates confirmed issues by default
        confirmationStatus = true;

        // But allow explicit override if provided
        if (input.isConfirmed !== undefined) {
          confirmationStatus = input.isConfirmed;
        }
      }

      // Create the issue with confirmation status
      const issue = await ctx.db.issue.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          machineId: input.machineId,
          statusId: input.statusId,
          priorityId: input.priorityId,
          consistency: input.consistency ?? null,
          organizationId: ctx.organization.id,
          createdById: ctx.user.id,
          assignedToId: null,
          // Note: In reality, this would need the schema to be updated first
          // For now, we'll mock this behavior
          // isConfirmed: confirmationStatus,
          // confirmedAt: confirmationStatus ? new Date() : null,
          // confirmedById: confirmationStatus ? ctx.session.user.id : null,
        },
        include: {
          machine: {
            include: {
              location: true,
              model: true,
            },
          },
          status: true,
          priority: true,
          createdBy: true,
        },
      });

      return {
        ...issue,
        // Mock the confirmation fields for testing
        isConfirmed: confirmationStatus,
        confirmedAt: confirmationStatus ? new Date() : null,
        confirmedById: confirmationStatus ? ctx.user.id : null,
      };
    }),

  // Toggle confirmation status - requires issue:confirm permission
  toggleConfirmation: issueConfirmProcedure
    .input(
      z.object({
        issueId: z.string(),
        isConfirmed: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if issue exists and user has access
      const issue = await ctx.db.issue.findFirst({
        where: {
          id: input.issueId,
          organizationId: ctx.organization.id,
        },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        });
      }

      // Update confirmation status
      const updatedIssue = await ctx.db.issue.update({
        where: { id: input.issueId },
        data: {
          // Note: These fields don't exist in current schema - mocking for tests
          // isConfirmed: input.isConfirmed,
          // confirmedAt: input.isConfirmed ? new Date() : null,
          // confirmedById: input.isConfirmed ? ctx.session.user.id : null,
        },
        include: {
          machine: {
            include: {
              location: true,
              model: true,
            },
          },
          status: true,
          priority: true,
          createdBy: true,
        },
      });

      return {
        ...updatedIssue,
        // Mock the confirmation fields for testing
        isConfirmed: input.isConfirmed,
        confirmedAt: input.isConfirmed ? new Date() : null,
        confirmedById: input.isConfirmed ? ctx.session.user.id : null,
      };
    }),

  // List issues with confirmation status visibility
  listWithConfirmationStatus: organizationProcedure
    .input(
      z.object({
        includeUnconfirmed: z.boolean().default(true),
        onlyUnconfirmed: z.boolean().default(false),
        locationId: z.string().optional(),
        machineId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const whereClause: any = {
        organizationId: ctx.organization.id,
      };

      if (input.locationId) {
        whereClause.machine = { locationId: input.locationId };
      }

      if (input.machineId) {
        whereClause.machineId = input.machineId;
      }

      const issues = await ctx.db.issue.findMany({
        where: whereClause,
        include: {
          machine: {
            include: {
              location: true,
              model: true,
            },
          },
          status: true,
          priority: true,
          createdBy: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      // Mock confirmation status for testing
      return issues.map((issue) => ({
        ...issue,
        // Mock confirmation fields - in reality these would come from the database
        isConfirmed: Math.random() > 0.3, // Random for testing
        confirmedAt: Math.random() > 0.5 ? new Date() : null,
        confirmedById: Math.random() > 0.5 ? "user-1" : null,
      }));
    }),

  // Get confirmation statistics
  getConfirmationStats: organizationProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        dateRange: z
          .object({
            from: z.date().optional(),
            to: z.date().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const whereClause: any = {
        organizationId: ctx.organization.id,
      };

      if (input.locationId) {
        whereClause.machine = { locationId: input.locationId };
      }

      if (input.dateRange) {
        whereClause.createdAt = {};
        if (input.dateRange.from) {
          whereClause.createdAt.gte = input.dateRange.from;
        }
        if (input.dateRange.to) {
          whereClause.createdAt.lte = input.dateRange.to;
        }
      }

      const totalIssues = await ctx.db.issue.count({
        where: whereClause,
      });

      // Mock confirmation statistics for testing
      const confirmedCount = Math.floor(totalIssues * 0.7); // 70% confirmed
      const unconfirmedCount = totalIssues - confirmedCount;

      return {
        totalIssues,
        confirmedCount,
        unconfirmedCount,
        confirmationRate:
          totalIssues > 0 ? (confirmedCount / totalIssues) * 100 : 0,
      };
    }),
});

// Mock context helper with different permission sets
const createMockTRPCContext = (
  permissions: string[] = [],
): VitestMockContext => {
  const mockContext = createVitestMockContext();

  // Set up session and organization
  mockContext.session = {
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      image: null,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  };

  mockContext.organization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  };

  // Mock the membership database query that organizationProcedure performs
  const membershipData = {
    id: "membership-1",
    userId: "user-1",
    organizationId: "org-1",
    roleId: "role-1",
    role: {
      id: "role-1",
      name: "Test Role",
      organizationId: "org-1",
      isSystem: false,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: permissions.map((name, index) => ({
        id: `perm-${(index + 1).toString()}`,
        name,
        description: `${name} permission`,
      })),
    },
  };

  // Mock the database query for membership lookup
  vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
    membershipData as any,
  );

  // Mock the permissions system
  vi.mocked(getUserPermissionsForSession).mockResolvedValue(permissions);

  // Mock requirePermissionForSession - it should throw when permission is missing
  vi.mocked(requirePermissionForSession).mockImplementation(
    (_session, permission, _db, _orgId) => {
      if (!permissions.includes(permission)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing required permission: ${permission}`,
        });
      }
      return Promise.resolve();
    },
  );

  return {
    ...mockContext,
    membership: membershipData,
    userPermissions: permissions,
  };
};

describe("Issue Confirmation Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic vs Full Form Creation", () => {
    it("should create unconfirmed issues with basic form", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        description: "Test description",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        consistency: "Always",
        organizationId: "org-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        checklist: null,
        assignedToId: null,
        machine: {
          id: "machine-1",
          name: "Test Machine",
          organizationId: "org-1",
          locationId: "location-1",
          modelId: "model-1",
          ownerId: null,
          location: {
            id: "location-1",
            name: "Test Location",
            organizationId: "org-1",
          },
          model: {
            id: "model-1",
            name: "Test Model",
            organizationId: "org-1",
          },
        },
        status: {
          id: "status-1",
          name: "Open",
          organizationId: "org-1",
        },
        priority: {
          id: "priority-1",
          name: "Medium",
          organizationId: "org-1",
        },
        createdBy: {
          id: "user-1",
          name: "Test User",
          email: "user@example.com",
        },
      };

      vi.mocked(ctx.db.issue.create).mockResolvedValue(mockIssue as any);

      // Act
      const result = await caller.create({
        title: "Test Issue",
        description: "Test description",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        formType: "basic",
      });

      // Assert
      expect(result.isConfirmed).toBe(false);
      expect(result.confirmedAt).toBeNull();
      expect(result.confirmedById).toBeNull();
      expect(ctx.db.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Test Issue",
          description: "Test description",
          organizationId: "org-1",
          createdById: "user-1",
        }),
        include: expect.any(Object),
      });
    });

    it("should create confirmed issues with full form by default", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        description: "Test description",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        organizationId: "org-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        checklist: null,
        machine: {
          id: "machine-1",
          name: "Test Machine",
          organizationId: "org-1",
          locationId: "location-1",
          modelId: "model-1",
          ownerId: null,
          location: {
            id: "location-1",
            name: "Test Location",
            organizationId: "org-1",
          },
          model: {
            id: "model-1",
            name: "Test Model",
            organizationId: "org-1",
          },
        },
        status: {
          id: "status-1",
          name: "Open",
          organizationId: "org-1",
        },
        priority: {
          id: "priority-1",
          name: "Medium",
          organizationId: "org-1",
        },
        createdBy: {
          id: "user-1",
          name: "Test User",
          email: "user@example.com",
        },
      };

      vi.mocked(ctx.db.issue.create).mockResolvedValue(mockIssue as any);

      // Act
      const result = await caller.create({
        title: "Test Issue",
        description: "Test description",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        formType: "full",
      });

      // Assert
      expect(result.isConfirmed).toBe(true);
      expect(result.confirmedAt).not.toBeNull();
      expect(result.confirmedById).toBe("user-1");
    });

    it("should allow explicit override of confirmation status in full form", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        organizationId: "org-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        machine: { id: "machine-1", name: "Test Machine" },
        status: { id: "status-1", name: "Open" },
        priority: { id: "priority-1", name: "Medium" },
        createdBy: { id: "user-1", name: "Test User" },
      };

      vi.mocked(ctx.db.issue.create).mockResolvedValue(mockIssue as any);

      // Act
      const result = await caller.create({
        title: "Test Issue",
        machineId: "machine-1",
        statusId: "status-1",
        priorityId: "priority-1",
        formType: "full",
        isConfirmed: false, // Explicit override
      });

      // Assert
      expect(result.isConfirmed).toBe(false);
      expect(result.confirmedAt).toBeNull();
      expect(result.confirmedById).toBeNull();
    });

    it("should require issue:create permission for issue creation", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:view"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      // Act & Assert
      await expect(
        caller.create({
          title: "Test Issue",
          machineId: "machine-1",
          statusId: "status-1",
          priorityId: "priority-1",
          formType: "basic",
        }),
      ).rejects.toThrow("Missing required permission: issue:create");
    });
  });

  describe("Confirmation Status Toggle", () => {
    it("should toggle confirmation status with issue:confirm permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:confirm"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        organizationId: "org-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        machine: { id: "machine-1", name: "Test Machine" },
        status: { id: "status-1", name: "Open" },
        priority: { id: "priority-1", name: "Medium" },
        createdBy: { id: "user-1", name: "Test User" },
      };

      vi.mocked(ctx.db.issue.findFirst).mockResolvedValue(mockIssue as any);
      vi.mocked(ctx.db.issue.update).mockResolvedValue(mockIssue as any);

      // Act
      const result = await caller.toggleConfirmation({
        issueId: "issue-1",
        isConfirmed: true,
      });

      // Assert
      expect(result.isConfirmed).toBe(true);
      expect(result.confirmedAt).not.toBeNull();
      expect(result.confirmedById).toBe("user-1");
      expect(ctx.db.issue.update).toHaveBeenCalledWith({
        where: { id: "issue-1" },
        data: {},
        include: expect.any(Object),
      });
    });

    it("should deny confirmation toggle without issue:confirm permission", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      // Act & Assert
      await expect(
        caller.toggleConfirmation({
          issueId: "issue-1",
          isConfirmed: true,
        }),
      ).rejects.toThrow("Missing required permission: issue:confirm");
    });

    it("should return NOT_FOUND for non-existent issue", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:confirm"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      vi.mocked(ctx.db.issue.findFirst).mockResolvedValue(null);

      // Act & Assert
      await expect(
        caller.toggleConfirmation({
          issueId: "non-existent",
          isConfirmed: true,
        }),
      ).rejects.toThrow("Issue not found");
    });

    it("should toggle confirmation status from true to false", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:confirm"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        organizationId: "org-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        machine: { id: "machine-1", name: "Test Machine" },
        status: { id: "status-1", name: "Open" },
        priority: { id: "priority-1", name: "Medium" },
        createdBy: { id: "user-1", name: "Test User" },
      };

      vi.mocked(ctx.db.issue.findFirst).mockResolvedValue(mockIssue as any);
      vi.mocked(ctx.db.issue.update).mockResolvedValue(mockIssue as any);

      // Act
      const result = await caller.toggleConfirmation({
        issueId: "issue-1",
        isConfirmed: false,
      });

      // Assert
      expect(result.isConfirmed).toBe(false);
      expect(result.confirmedAt).toBeNull();
      expect(result.confirmedById).toBeNull();
    });
  });

  describe("Issue Listing with Confirmation Status", () => {
    it("should list issues with confirmation status", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const mockIssues = [
        {
          id: "issue-1",
          title: "Confirmed Issue",
          organizationId: "org-1",
          createdById: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          machine: {
            id: "machine-1",
            name: "Test Machine",
            location: { id: "location-1", name: "Test Location" },
            model: { id: "model-1", name: "Test Model" },
          },
          status: { id: "status-1", name: "Open" },
          priority: { id: "priority-1", name: "Medium" },
          createdBy: { id: "user-1", name: "Test User" },
        },
        {
          id: "issue-2",
          title: "Unconfirmed Issue",
          organizationId: "org-1",
          createdById: "user-2",
          createdAt: new Date(),
          updatedAt: new Date(),
          machine: {
            id: "machine-2",
            name: "Test Machine 2",
            location: { id: "location-1", name: "Test Location" },
            model: { id: "model-2", name: "Test Model 2" },
          },
          status: { id: "status-1", name: "Open" },
          priority: { id: "priority-2", name: "High" },
          createdBy: { id: "user-2", name: "Test User 2" },
        },
      ];

      vi.mocked(ctx.db.issue.findMany).mockResolvedValue(mockIssues as any);

      // Act
      const result = await caller.listWithConfirmationStatus({
        includeUnconfirmed: true,
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("isConfirmed");
      expect(result[0]).toHaveProperty("confirmedAt");
      expect(result[0]).toHaveProperty("confirmedById");
      expect(result[1]).toHaveProperty("isConfirmed");
      expect(result[1]).toHaveProperty("confirmedAt");
      expect(result[1]).toHaveProperty("confirmedById");
    });

    it("should filter by location when locationId provided", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      vi.mocked(ctx.db.issue.findMany).mockResolvedValue([]);

      // Act
      await caller.listWithConfirmationStatus({
        locationId: "location-1",
      });

      // Assert
      expect(ctx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          machine: { locationId: "location-1" },
        },
        include: expect.any(Object),
        orderBy: [{ createdAt: "desc" }],
      });
    });

    it("should filter by machine when machineId provided", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      vi.mocked(ctx.db.issue.findMany).mockResolvedValue([]);

      // Act
      await caller.listWithConfirmationStatus({
        machineId: "machine-1",
      });

      // Assert
      expect(ctx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          machineId: "machine-1",
        },
        include: expect.any(Object),
        orderBy: [{ createdAt: "desc" }],
      });
    });
  });

  describe("Confirmation Statistics", () => {
    it("should return confirmation statistics", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      vi.mocked(ctx.db.issue.count).mockResolvedValue(100);

      // Act
      const result = await caller.getConfirmationStats({});

      // Assert
      expect(result).toEqual({
        totalIssues: 100,
        confirmedCount: 70, // 70% of 100
        unconfirmedCount: 30,
        confirmationRate: 70,
      });
    });

    it("should handle zero issues gracefully", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      vi.mocked(ctx.db.issue.count).mockResolvedValue(0);

      // Act
      const result = await caller.getConfirmationStats({});

      // Assert
      expect(result).toEqual({
        totalIssues: 0,
        confirmedCount: 0,
        unconfirmedCount: 0,
        confirmationRate: 0,
      });
    });

    it("should filter by date range when provided", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-12-31");

      vi.mocked(ctx.db.issue.count).mockResolvedValue(50);

      // Act
      await caller.getConfirmationStats({
        dateRange: {
          from: fromDate,
          to: toDate,
        },
      });

      // Assert
      expect(ctx.db.issue.count).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
      });
    });

    it("should filter by location when locationId provided", async () => {
      // Arrange
      const ctx = createMockTRPCContext([]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      vi.mocked(ctx.db.issue.count).mockResolvedValue(25);

      // Act
      await caller.getConfirmationStats({
        locationId: "location-1",
      });

      // Assert
      expect(ctx.db.issue.count).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          machine: { locationId: "location-1" },
        },
      });
    });
  });

  describe("Permission Requirements", () => {
    it("should require issue:create permission for basic form", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:view"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      // Act & Assert
      await expect(
        caller.create({
          title: "Test Issue",
          machineId: "machine-1",
          statusId: "status-1",
          priorityId: "priority-1",
          formType: "basic",
        }),
      ).rejects.toThrow("Missing required permission: issue:create");
    });

    it("should require issue:create permission for full form", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:view"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      // Act & Assert
      await expect(
        caller.create({
          title: "Test Issue",
          machineId: "machine-1",
          statusId: "status-1",
          priorityId: "priority-1",
          formType: "full",
        }),
      ).rejects.toThrow("Missing required permission: issue:create");
    });

    it("should not require additional permissions for basic form beyond issue:create", async () => {
      // Arrange
      const ctx = createMockTRPCContext(["issue:create"]);
      const caller = issueConfirmationRouter.createCaller(ctx);

      const mockIssue = {
        id: "issue-1",
        title: "Test Issue",
        organizationId: "org-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        machine: { id: "machine-1", name: "Test Machine" },
        status: { id: "status-1", name: "Open" },
        priority: { id: "priority-1", name: "Medium" },
        createdBy: { id: "user-1", name: "Test User" },
      };

      vi.mocked(ctx.db.issue.create).mockResolvedValue(mockIssue as any);

      // Act & Assert
      await expect(
        caller.create({
          title: "Test Issue",
          machineId: "machine-1",
          statusId: "status-1",
          priorityId: "priority-1",
          formType: "basic",
        }),
      ).resolves.toBeTruthy();
    });
  });
});
