import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock NextAuth first to avoid import issues
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
    getUserPermissionsForSession: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

import { appRouter } from "~/server/api/root";
import {
  getUserPermissionsForSession,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import {
  createUserFactory,
  createIssueFactory,
  createMachineFactory,
  createStatusFactory,
  createPriorityFactory,
  createCommentTypes,
} from "~/test/testDataFactories";
import { createVitestMockContext } from "~/test/vitestMockContext";

// Mock data using factories
const mockUser = createUserFactory({
  overrides: {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
  },
});

const mockIssue = createIssueFactory({
  overrides: {
    id: "issue-1",
    title: "Test Issue",
    machineId: "machine-1",
    organizationId: "org-1",
  },
});

const mockMachine = createMachineFactory({
  overrides: {
    id: "machine-1",
    name: "Test Machine",
    organizationId: "org-1",
    locationId: "location-1",
  },
});

const mockStatus = createStatusFactory({
  overrides: {
    id: "status-1",
    name: "Open",
    organizationId: "org-1",
    category: "NEW",
  },
});

const mockPriority = createPriorityFactory({
  overrides: {
    id: "priority-1",
    name: "Medium",
    organizationId: "org-1",
  },
});

const mockMembership = {
  id: "membership-1",
  userId: "user-1",
  organizationId: "org-1",
  roleId: "role-1",
};

// Enhanced setup helpers for better test organization
const createIssueWithRequiredRelations = (overrides = {}) => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- mockIssue is an object from createIssueFactory
    ...mockIssue,
    machine: mockMachine,
    status: mockStatus,
    priority: mockPriority,
    createdBy: mockUser,
    assignedTo: mockUser,
    comments: [],
    attachments: [],
    activities: [],
    ...overrides,
  };
};

const setupIssueContextMocks = (
  context: any,
  issueData: any,
  membershipData: any = mockMembership,
) => {
  context.db.issue.findUnique?.mockResolvedValue(issueData);
  context.db.issue.findFirst?.mockResolvedValue(issueData);
  context.db.membership.findFirst?.mockResolvedValue(membershipData);
};

// Helper to create authenticated context with permissions
const createAuthenticatedContext = (permissions: string[] = []) => {
  const mockContext = createVitestMockContext();

  // Override the user with proper test data
  (mockContext as any).user = {
    id: "user-1",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: null,
    },
    app_metadata: {
      organization_id: "org-1",
      role: "Member",
    },
  };

  (mockContext as any).organization = {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  };

  const membershipData = {
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
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: permissions.map((name, index) => ({
        id: `perm-${(index + 1).toString()}`,
        name,
        description: `${name} permission`,
        createdAt: new Date(),
        updatedAt: new Date(),
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
    // Add the user property that tRPC middleware expects
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      image: null,
    },
    membership: membershipData,
    userPermissions: permissions,
  } as any;
};

describe("issueRouter - Issue Detail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authenticated Issue Detail Access", () => {
    it("should allow authenticated users to view all issue details", async () => {
      const authCtx = createAuthenticatedContext(["issue:view"]);
      const authCaller = appRouter.createCaller(authCtx);

      const issueWithDetails = createIssueWithRequiredRelations({
        comments: [
          createCommentTypes.internal({
            overrides: {
              id: "comment-1",
              content: "Internal note",
              createdBy: mockUser,
              createdAt: new Date(),
            },
          }),
          createCommentTypes.public({
            overrides: {
              id: "comment-2",
              content: "Public comment",
              createdBy: mockUser,
              createdAt: new Date(),
            },
          }),
        ],
      });

      setupIssueContextMocks(authCtx, issueWithDetails);

      const result = await authCaller.issue.core.getById({ id: mockIssue.id });

      // Should see all comments
      expect(result.comments).toHaveLength(2);
      expect(result.assignedTo).toBeTruthy();
    });

    it("should enforce organization isolation", async () => {
      const authCtx = createAuthenticatedContext(["issue:view"]);
      const authCaller = appRouter.createCaller(authCtx);

      const otherOrgIssue = {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- mockIssue is an object from createIssueFactory
        ...mockIssue,
        organizationId: "other-org",
        machine: { ...mockMachine, organizationId: "other-org" },
      };

      authCtx.db.issue.findUnique.mockResolvedValue(otherOrgIssue as any);

      await expect(
        authCaller.issue.core.getById({ id: mockIssue.id }),
      ).rejects.toThrow("Issue not found");
    });
  });

  describe("Permission-based Issue Operations", () => {
    it("should deny users without edit permissions from updating issues", async () => {
      const readOnlyCtx = createAuthenticatedContext(["issue:view"]);
      const readOnlyCaller = appRouter.createCaller(readOnlyCtx);

      await expect(
        readOnlyCaller.issue.core.update({
          id: mockIssue.id,
          title: "Updated Title",
        }),
      ).rejects.toThrow("Missing required permission: issue:edit");
    });

    // NOTE: Complex business logic tests (update, assignment, close) moved to issue.integration.test.ts
    // These tests involve multiple service mocks and complex workflows better tested with real database
  });

  describe("Issue Status Changes", () => {
    it("should validate status belongs to same organization", async () => {
      const statusCtx = createAuthenticatedContext(["issue:edit"]);
      const statusCaller = appRouter.createCaller(statusCtx);

      statusCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      statusCtx.db.issueStatus.findFirst.mockResolvedValue(null); // Status not found

      await expect(
        statusCaller.issue.core.updateStatus({
          id: mockIssue.id,
          statusId: "other-org-status",
        }),
      ).rejects.toThrow("Invalid status");
    });

    // NOTE: Complex status change workflow test moved to issue.integration.test.ts
    // Multi-service mocking and full status update workflow better tested with real database
  });

  // NOTE: Comment operations are now tested in issue.comment.test.ts
  // This keeps issue.test.ts focused on core issue operations

  describe("Loading States and Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      const errorCtx = createAuthenticatedContext(["issue:view"]);
      const errorCaller = appRouter.createCaller(errorCtx);

      errorCtx.db.issue.findFirst.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        errorCaller.issue.core.getById({ id: mockIssue.id }),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle concurrent access scenarios", async () => {
      const concurrentCtx = createAuthenticatedContext(["issue:edit"]);
      const concurrentCaller = appRouter.createCaller(concurrentCtx);

      // Simulate optimistic locking scenario
      concurrentCtx.db.issue.findFirst.mockResolvedValue(mockIssue as any);
      concurrentCtx.db.issue.update.mockRejectedValue(
        new Error("Concurrent modification"),
      );

      await expect(
        concurrentCaller.issue.core.update({
          id: mockIssue.id,
          title: "Updated Title",
        }),
      ).rejects.toThrow("Concurrent modification");
    });
  });
});

describe("issueRouter - Public Procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create unauthenticated (public) context
  const createPublicContext = () => {
    const mockContext = createVitestMockContext();

    // Override for anonymous/public access
    (mockContext as any).user = null;
    (mockContext as any).organization = {
      id: "org-1",
      name: "Test Organization",
      subdomain: "test",
    };

    return mockContext as any;
  };

  describe("publicCreate - Anonymous Issue Creation", () => {
    it("should allow anonymous users to create issues via QR codes", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      // Mock required database entities for validation
      publicCtx.db.machine.findFirst.mockResolvedValue({
        id: "machine-1",
        name: "Test Machine",
        organizationId: "org-1",
        location: {
          organizationId: "org-1",
        },
      });

      publicCtx.db.issueStatus.findFirst.mockResolvedValue({
        id: "status-1",
        name: "Open",
        isDefault: true,
        organizationId: "org-1",
        category: "NEW",
      });

      publicCtx.db.priority.findFirst.mockResolvedValue({
        id: "priority-1",
        name: "Medium",
        isDefault: true,
        organizationId: "org-1",
        order: 2,
      });

      // Mock issue creation
      const createdIssue = {
        id: "issue-1",
        title: "Machine not working",
        description: "Screen is black",
        machineId: "machine-1",
        organizationId: "org-1",
        statusId: "status-1",
        priorityId: "priority-1",
        createdById: null,
        submitterName: "John Doe",
        reporterEmail: "john@example.com",
        status: { id: "status-1", name: "Open" },
        createdBy: null,
        machine: {
          id: "machine-1",
          name: "Test Machine",
          model: { id: "model-1", name: "Test Model" },
          location: { id: "location-1", name: "Test Location" },
        },
      };

      publicCtx.db.issue.create.mockResolvedValue(createdIssue);

      const result = await publicCaller.issue.core.publicCreate({
        title: "Machine not working",
        description: "Screen is black",
        machineId: "machine-1",
        reporterEmail: "john@example.com",
        submitterName: "John Doe",
      });

      expect(result).toBeDefined();
      expect(result.title).toBe("Machine not working");
      expect(result.createdById).toBeNull();
      expect(result.submitterName).toBe("John Doe");
      expect(result.reporterEmail).toBe("john@example.com");

      // Verify database call
      expect(publicCtx.db.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Machine not working",
          description: "Screen is black",
          createdById: null,
          submitterName: "John Doe",
          reporterEmail: "john@example.com",
          machineId: "machine-1",
          organizationId: "org-1",
        }),
        include: expect.any(Object),
      });

      // Verify notification service was called (the notification service is called inside the procedure)
      expect(publicCtx.services.createNotificationService).toHaveBeenCalled();
    });

    it("should validate required fields for anonymous issue creation", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      // Test missing title
      await expect(
        publicCaller.issue.core.publicCreate({
          title: "",
          machineId: "machine-1",
        }),
      ).rejects.toThrow();

      // Test missing machineId
      await expect(
        publicCaller.issue.core.publicCreate({
          title: "Test Issue",
          machineId: "",
        }),
      ).rejects.toThrow();
    });

    it("should validate email format for reporterEmail", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      await expect(
        publicCaller.issue.core.publicCreate({
          title: "Test Issue",
          machineId: "machine-1",
          reporterEmail: "invalid-email",
        }),
      ).rejects.toThrow();
    });

    it("should handle machine not found error", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.machine.findFirst.mockResolvedValue(null);

      await expect(
        publicCaller.issue.core.publicCreate({
          title: "Test Issue",
          machineId: "nonexistent-machine",
        }),
      ).rejects.toThrow("Machine not found");
    });

    it("should handle missing default status error", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.machine.findFirst.mockResolvedValue({
        id: "machine-1",
        location: { organizationId: "org-1" },
      });

      publicCtx.db.issueStatus.findFirst.mockResolvedValue(null);

      await expect(
        publicCaller.issue.core.publicCreate({
          title: "Test Issue",
          machineId: "machine-1",
        }),
      ).rejects.toThrow(
        "Default issue status not found. Please contact an administrator.",
      );
    });

    it("should handle missing default priority error", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.machine.findFirst.mockResolvedValue({
        id: "machine-1",
        location: { organizationId: "org-1" },
      });

      publicCtx.db.issueStatus.findFirst.mockResolvedValue({
        id: "status-1",
        isDefault: true,
        organizationId: "org-1",
      });

      publicCtx.db.priority.findFirst.mockResolvedValue(null);

      await expect(
        publicCaller.issue.core.publicCreate({
          title: "Test Issue",
          machineId: "machine-1",
        }),
      ).rejects.toThrow(
        "Default priority not found. Please contact an administrator.",
      );
    });

    it("should create minimal issue with only required fields", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      // Mock required database entities
      publicCtx.db.machine.findFirst.mockResolvedValue({
        id: "machine-1",
        location: { organizationId: "org-1" },
      });

      publicCtx.db.issueStatus.findFirst.mockResolvedValue({
        id: "status-1",
        name: "Open",
        isDefault: true,
        organizationId: "org-1",
      });

      publicCtx.db.priority.findFirst.mockResolvedValue({
        id: "priority-1",
        name: "Medium",
        isDefault: true,
        organizationId: "org-1",
      });

      const createdIssue = {
        id: "issue-1",
        title: "Machine Issue",
        machineId: "machine-1",
        organizationId: "org-1",
        createdById: null,
        status: { id: "status-1", name: "Open" },
        createdBy: null,
        machine: {
          id: "machine-1",
          model: { id: "model-1", name: "Test Model" },
          location: { id: "location-1", name: "Test Location" },
        },
      };

      publicCtx.db.issue.create.mockResolvedValue(createdIssue);

      const result = await publicCaller.issue.core.publicCreate({
        title: "Machine Issue",
        machineId: "machine-1",
      });

      expect(result).toBeDefined();
      expect(result.title).toBe("Machine Issue");
      expect(result.createdById).toBeNull();

      // Verify database call doesn't include optional fields
      expect(publicCtx.db.issue.create).toHaveBeenCalledWith({
        data: {
          title: "Machine Issue",
          createdById: null,
          machineId: "machine-1",
          organizationId: "org-1",
          statusId: "status-1",
          priorityId: "priority-1",
        },
        include: expect.any(Object),
      });
    });
  });

  describe("publicGetAll - Anonymous Issue Viewing", () => {
    it("should allow anonymous users to view issues", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      const mockIssues = [
        {
          id: "issue-1",
          title: "Machine not working",
          description: "Screen is black",
          createdAt: new Date(),
          submitterName: "John Doe",
          status: { id: "status-1", name: "Open" },
          priority: { id: "priority-1", name: "Medium" },
          assignedTo: null,
          createdBy: null,
          machine: {
            id: "machine-1",
            model: { id: "model-1", name: "Test Model" },
            location: { id: "location-1", name: "Test Location" },
          },
        },
        {
          id: "issue-2",
          title: "Flipper stuck",
          description: null,
          createdAt: new Date(),
          submitterName: "Jane Smith",
          status: { id: "status-2", name: "In Progress" },
          priority: { id: "priority-2", name: "High" },
          assignedTo: {
            id: "user-1",
            name: "Tech Support",
            email: "tech@example.com",
            image: null,
          },
          createdBy: {
            id: "user-2",
            name: "Staff Member",
            email: "staff@example.com",
            image: null,
          },
          machine: {
            id: "machine-2",
            model: { id: "model-2", name: "Another Model" },
            location: { id: "location-2", name: "Another Location" },
          },
        },
      ];

      publicCtx.db.issue.findMany.mockResolvedValue(mockIssues);

      const result = await publicCaller.issue.core.publicGetAll();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Machine not working");
      expect(result[1].title).toBe("Flipper stuck");

      // Verify database query includes organization filtering
      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        select: expect.objectContaining({
          id: true,
          title: true,
          description: true,
          createdAt: true,
          submitterName: true,
          status: true,
          priority: true,
          assignedTo: expect.any(Object),
          createdBy: expect.any(Object),
          machine: expect.any(Object),
        }),
        orderBy: { createdAt: "desc" },
        take: 20, // Default limit
      });
    });

    it("should filter issues by location", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      await publicCaller.issue.core.publicGetAll({
        locationId: "location-1",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          machine: { locationId: "location-1" },
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
        take: 20,
      });
    });

    it("should filter issues by machine", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      await publicCaller.issue.core.publicGetAll({
        machineId: "machine-1",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          machineId: "machine-1",
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
        take: 20,
      });
    });

    it("should filter issues by status", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      await publicCaller.issue.core.publicGetAll({
        statusId: "status-1",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          statusId: "status-1",
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
        take: 20,
      });
    });

    it("should filter issues by status category", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      await publicCaller.issue.core.publicGetAll({
        statusCategory: "NEW",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          status: { category: "NEW" },
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
        take: 20,
      });
    });

    it("should filter issues by model", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      await publicCaller.issue.core.publicGetAll({
        modelId: "model-1",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          machine: { modelId: "model-1" },
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
        take: 20,
      });
    });

    it("should handle custom limit parameter", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      await publicCaller.issue.core.publicGetAll({
        limit: 50,
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        select: expect.any(Object),
        orderBy: expect.any(Object),
        take: 50,
      });
    });

    it("should enforce maximum limit of 100", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      await expect(
        publicCaller.issue.core.publicGetAll({
          limit: 150, // Over maximum
        }),
      ).rejects.toThrow();
    });

    it("should enforce minimum limit of 1", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      await expect(
        publicCaller.issue.core.publicGetAll({
          limit: 0, // Under minimum
        }),
      ).rejects.toThrow();
    });

    it("should sort issues by different criteria", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      // Test sorting by updated date
      await publicCaller.issue.core.publicGetAll({
        sortBy: "updated",
        sortOrder: "asc",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        select: expect.any(Object),
        orderBy: { updatedAt: "asc" },
        take: 20,
      });

      // Test sorting by status
      await publicCaller.issue.core.publicGetAll({
        sortBy: "status",
        sortOrder: "desc",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        select: expect.any(Object),
        orderBy: { status: { name: "desc" } },
        take: 20,
      });

      // Test sorting by severity (priority)
      await publicCaller.issue.core.publicGetAll({
        sortBy: "severity",
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        select: expect.any(Object),
        orderBy: { priority: { order: "desc" } },
        take: 20,
      });
    });

    it("should handle organization not found error", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      // Set organization to null to simulate missing organization
      (publicCtx as any).organization = null;

      await expect(publicCaller.issue.core.publicGetAll()).rejects.toThrow(
        "Organization not found",
      );
    });

    it("should combine multiple filters", async () => {
      const publicCtx = createPublicContext();
      const publicCaller = appRouter.createCaller(publicCtx);

      publicCtx.db.issue.findMany.mockResolvedValue([]);

      await publicCaller.issue.core.publicGetAll({
        locationId: "location-1",
        statusCategory: "NEW",
        sortBy: "created",
        sortOrder: "asc",
        limit: 10,
      });

      expect(publicCtx.db.issue.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          machine: { locationId: "location-1" },
          status: { category: "NEW" },
        },
        select: expect.any(Object),
        orderBy: { createdAt: "asc" },
        take: 10,
      });
    });
  });
});
