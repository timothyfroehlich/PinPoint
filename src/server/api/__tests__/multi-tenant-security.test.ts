import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";

import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

// Temporary enum for testing with the new schema
enum Role {
  ADMIN = "admin",
  MEMBER = "member",
  TECHNICIAN = "technician",
}

// Create properly typed mock functions
const mockOrganizationFindUnique = jest.fn();
const mockMembershipFindUnique = jest.fn();
const mockIssueFindMany = jest.fn();
const mockIssueFindUnique = jest.fn();
const mockIssueCreate = jest.fn();
const mockIssueUpdate = jest.fn();
const mockIssueDelete = jest.fn();
const mockMachineFindMany = jest.fn();
const mockLocationFindMany = jest.fn();
const mockIssueStatusFindMany = jest.fn();

// Mock the database
jest.mock("~/server/db", () => ({
  db: {
    organization: {
      findUnique: mockOrganizationFindUnique,
    },
    membership: {
      findUnique: mockMembershipFindUnique,
    },
    issue: {
      findMany: mockIssueFindMany,
      findUnique: mockIssueFindUnique,
      create: mockIssueCreate,
      update: mockIssueUpdate,
      delete: mockIssueDelete,
    },
    machine: {
      findMany: mockMachineFindMany,
    },
    location: {
      findMany: mockLocationFindMany,
    },
    issueStatus: {
      findMany: mockIssueStatusFindMany,
    },
  },
}));

// Mock NextAuth
jest.mock("~/server/auth", () => ({
  auth: jest.fn(),
}));

const mockAuth = auth as jest.Mock;

describe("Multi-Tenant Security Tests", () => {
  const createCaller = createCallerFactory(appRouter);

  // Type helper to properly type the caller with issue procedures
  interface IssueGetAllInput {
    locationId?: string;
    statusId?: string;
    modelId?: string;
    statusCategory?: "NEW" | "OPEN" | "CLOSED";
    sortBy?: "created" | "updated" | "status" | "severity" | "game";
    sortOrder?: "asc" | "desc";
  }

  interface IssueCreateInput {
    title: string;
    description?: string;
    severity?: "Low" | "Medium" | "High" | "Critical";
    machineId: string;
    statusId: string;
  }

  interface IssueUpdateInput {
    id: string;
    title?: string;
  }

  type CallerType = ReturnType<typeof createCaller> & {
    issue: {
      getAll: (input?: IssueGetAllInput) => Promise<unknown>;
      getById: (input: { id: string }) => Promise<unknown>;
      create: (input: IssueCreateInput) => Promise<unknown>;
      update: (input: IssueUpdateInput) => Promise<unknown>;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test data for Organization A
  const organizationA = {
    id: "org-a",
    name: "Organization A",
    subdomain: "org-a",
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userAMember = {
    id: "user-a-member",
    role: "member" as Role,
    userId: "user-a",
    organizationId: "org-a",
  };

  const userAAdmin = {
    id: "user-a-admin",
    role: "admin" as Role,
    userId: "user-a-admin-id",
    organizationId: "org-a",
  };

  // Test data for Organization B
  const organizationB = {
    id: "org-b",
    name: "Organization B",
    subdomain: "org-b",
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userBMember = {
    id: "user-b-member",
    role: "member" as Role,
    userId: "user-b",
    organizationId: "org-b",
  };

  // Sample issues for each organization
  const issuesOrgA = [
    {
      id: "issue-a-1",
      title: "Issue A1",
      organizationId: "org-a",
      machineId: "game-a-1",
    },
    {
      id: "issue-a-2",
      title: "Issue A2",
      organizationId: "org-a",
      machineId: "game-a-2",
    },
  ];

  const issuesOrgB = [
    {
      id: "issue-b-1",
      title: "Issue B1",
      organizationId: "org-b",
      machineId: "game-b-1",
    },
  ];

  describe("Organization Data Isolation", () => {
    it("should only return data for user's organization", async () => {
      // Setup user from Organization A
      const sessionA: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "member",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(sessionA);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAMember);

      // Mock issue data - should only return Organization A's issues
      mockIssueFindMany.mockResolvedValue(issuesOrgA);

      const callerA = createCaller({
        db,
        session: sessionA,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      const result = await callerA.issue.getAll({
        locationId: undefined,
        statusId: undefined,
        modelId: undefined,
        statusCategory: undefined,
        sortBy: "created",
        sortOrder: "desc",
      });

      expect(result).toEqual(issuesOrgA);

      // Verify that the query included organization filter
      expect(mockIssueFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-a",
          }),
        }) as unknown,
      );
    });

    it("should prevent cross-organization data access", async () => {
      // User from Organization A tries to access Organization B's subdomain
      const sessionA: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "member",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(sessionA);
      // Return Organization B when subdomain is org-b
      mockOrganizationFindUnique.mockResolvedValue(organizationB);
      // User A has no membership in Organization B
      mockMembershipFindUnique.mockResolvedValue(null);

      const callerA = createCaller({
        db,
        session: sessionA,
        organization: organizationB,
        headers: new Headers({
          host: "org-b.localhost:3000", // User A trying to access org B
        }),
      }) as CallerType;

      await expect(
        callerA.issue.getAll({
          locationId: undefined,
          statusId: undefined,
          modelId: undefined,
          statusCategory: undefined,
          sortBy: "created",
          sortOrder: "desc",
        }),
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access this organization",
        }),
      );
    });

    it("should isolate data between organizations completely", async () => {
      // Test both organizations simultaneously

      // Setup for Organization A
      const sessionA: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "member",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Setup for Organization B
      const sessionB: Session = {
        user: {
          id: "user-b",
          name: "User B",
          email: "user-b@example.com",
          role: "member",
          organizationId: "org-b",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Test Organization A access
      mockAuth.mockResolvedValue(sessionA);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAMember);
      mockIssueFindMany.mockResolvedValue(issuesOrgA);

      const callerA = createCaller({
        db,
        session: sessionA,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      const resultA = await callerA.issue.getAll({
        locationId: undefined,
        statusId: undefined,
        modelId: undefined,
        statusCategory: undefined,
        sortBy: "created",
        sortOrder: "desc",
      });

      expect(resultA).toEqual(issuesOrgA);

      // Reset mocks and test Organization B access
      jest.clearAllMocks();
      mockAuth.mockResolvedValue(sessionB);
      mockOrganizationFindUnique.mockResolvedValue(organizationB);
      mockMembershipFindUnique.mockResolvedValue(userBMember);
      mockIssueFindMany.mockResolvedValue(issuesOrgB);

      const callerB = createCaller({
        db,
        session: sessionB,
        organization: organizationB,
        headers: new Headers({
          host: "org-b.localhost:3000",
        }),
      }) as CallerType;

      const resultB = await callerB.issue.getAll({
        locationId: undefined,
        statusId: undefined,
        modelId: undefined,
        statusCategory: undefined,
        sortBy: "created",
        sortOrder: "desc",
      });

      expect(resultB).toEqual(issuesOrgB);

      // Verify Organization B query had correct filter
      expect(mockIssueFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-b",
          }),
        }) as unknown,
      );
    });
  });

  describe("Cross-Organization Security Violations", () => {
    it("should prevent reading another organization's specific issue", async () => {
      const sessionA: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "admin", // Even admin can't access other org data
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(sessionA);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAAdmin);

      // Try to return an issue from Organization B
      mockIssueFindUnique.mockResolvedValue({
        id: "issue-b-1",
        title: "Issue B1",
        organizationId: "org-b", // Different organization!
        machineId: "game-b-1",
      });

      const callerA = createCaller({
        db,
        session: sessionA,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      // This should fail because the issue belongs to a different organization
      await expect(callerA.issue.getById({ id: "issue-b-1" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        }),
      );
    });

    it("should prevent creating issues in another organization", async () => {
      const sessionA: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "member",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(sessionA);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAMember);

      const callerA = createCaller({
        db,
        session: sessionA,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      // The create mutation should automatically add the correct organizationId
      const createData = {
        title: "Test Issue",
        description: "Test Description",
        machineId: "game-a-1",
        statusId: "status-1",
        severity: "Medium" as const,
      };

      // Mock successful creation
      mockIssueCreate.mockResolvedValue({
        id: "new-issue",
        ...createData,
        organizationId: "org-a", // Should be automatically set
      });

      await callerA.issue.create(createData);

      // Verify that organizationId was automatically added
      expect(mockIssueCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...createData,
          organizationId: "org-a",
        }) as unknown,
      });
    });

    it("should prevent updating issues from another organization", async () => {
      const sessionA: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "admin",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(sessionA);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAAdmin);

      // Mock finding an issue from Organization B
      mockIssueFindUnique.mockResolvedValue({
        id: "issue-b-1",
        title: "Issue B1",
        organizationId: "org-b", // Different organization
        machineId: "game-b-1",
      });

      const callerA = createCaller({
        db,
        session: sessionA,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      // Should fail to update issue from different organization
      await expect(
        callerA.issue.update({
          id: "issue-b-1",
          title: "Updated Title",
        }),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Issue not found",
        }),
      );
    });
  });

  describe("Role-Based Multi-Tenant Security", () => {
    it("should enforce role restrictions within organization context", async () => {
      const memberSession: Session = {
        user: {
          id: "user-a-member",
          name: "Member User",
          email: "member@example.com",
          role: "member",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(memberSession);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAMember);

      const memberCaller = createCaller({
        db,
        session: memberSession,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      // Member should be able to access organization data
      mockIssueFindMany.mockResolvedValue(issuesOrgA);
      const result = await memberCaller.issue.getAll({
        locationId: undefined,
        statusId: undefined,
        modelId: undefined,
        statusCategory: undefined,
        sortBy: "created",
        sortOrder: "desc",
      });

      expect(result).toEqual(issuesOrgA);

      // But member should not be able to access admin-only functions
      // (This would need to be tested with actual admin-only procedures when they exist)
    });

    it("should allow admin access within their organization only", async () => {
      const adminSession: Session = {
        user: {
          id: "user-a-admin-id",
          name: "Admin User",
          email: "admin@example.com",
          role: "admin",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(adminSession);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAAdmin);

      const adminCaller = createCaller({
        db,
        session: adminSession,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      // Admin should have access to organization data
      mockIssueFindMany.mockResolvedValue(issuesOrgA);
      const result = await adminCaller.issue.getAll({
        locationId: undefined,
        statusId: undefined,
        modelId: undefined,
        statusCategory: undefined,
        sortBy: "created",
        sortOrder: "desc",
      });

      expect(result).toEqual(issuesOrgA);

      // Verify admin can only access their organization's data
      expect(mockIssueFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-a",
          }),
        }) as unknown,
      );
    });
  });

  describe("Subdomain Resolution Security", () => {
    it("should correctly resolve organization from subdomain", async () => {
      const session: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "member",
          organizationId: "org-a",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(session);
      mockOrganizationFindUnique.mockResolvedValue(organizationA);
      mockMembershipFindUnique.mockResolvedValue(userAMember);

      const caller = createCaller({
        db,
        session: session,
        organization: organizationA,
        headers: new Headers({
          host: "org-a.localhost:3000",
        }),
      }) as CallerType;

      await caller.user.getCurrentMembership();

      // Verify correct subdomain was used for organization lookup
      expect(mockOrganizationFindUnique).toHaveBeenCalledWith({
        where: { subdomain: "org-a" },
      });
    });

    it("should prevent subdomain spoofing", async () => {
      // User belongs to org-a but tries to access via org-b subdomain
      const session: Session = {
        user: {
          id: "user-a",
          name: "User A",
          email: "user-a@example.com",
          role: "member",
          organizationId: "org-a", // User is in org-a
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(session);
      mockOrganizationFindUnique.mockResolvedValue(organizationB); // But subdomain resolves to org-b
      mockMembershipFindUnique.mockResolvedValue(null); // No membership in org-b

      const caller = createCaller({
        db,
        session: session,
        organization: organizationB,
        headers: new Headers({
          host: "org-b.localhost:3000", // Spoofed subdomain
        }),
      }) as CallerType;

      await expect(caller.user.getCurrentMembership()).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access this organization",
        }),
      );
    });
  });
});
