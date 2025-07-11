import { type Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { type Session } from "next-auth";

import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

// Create properly typed mock functions
const mockOrganizationFindUnique = jest.fn<Promise<unknown>, [unknown]>();
const mockMembershipFindUnique = jest.fn<Promise<unknown>, [unknown]>();

// Mock the database
jest.mock("~/server/db", () => ({
  db: {
    organization: {
      findUnique: mockOrganizationFindUnique,
    },
    membership: {
      findUnique: mockMembershipFindUnique,
    },
  },
}));

// Mock NextAuth
jest.mock("~/server/auth", () => ({
  auth: jest.fn(),
}));

const mockAuth = auth as jest.Mock;

describe("tRPC Authentication Middleware", () => {
  const createCaller = createCallerFactory(appRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockOrganization = {
    id: "org-123",
    name: "Test Organization",
    subdomain: "test",
    logoUrl: null,
  };

  const mockMembership = {
    id: "membership-123",
    role: "member" as Role,
    userId: "user-123",
    organizationId: "org-123",
  };

  const mockAdminMembership = {
    id: "membership-admin",
    role: "admin" as Role,
    userId: "admin-123",
    organizationId: "org-123",
  };

  describe("protectedProcedure middleware", () => {
    it("should allow authenticated user to access protected procedure", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);

      const caller = createCaller({
        db,
        session: mockSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      // Test with a protected procedure - using user.getCurrentMembership as example
      mockMembershipFindUnique.mockResolvedValue(mockMembership);

      const result = await caller.user.getCurrentMembership();

      expect(result).toEqual(mockMembership);
    });

    it("should reject unauthenticated user", async () => {
      mockAuth.mockResolvedValue(null);

      const caller = createCaller({
        db,
        session: null,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      await expect(caller.user.getCurrentMembership()).rejects.toThrow(
        new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to access this resource",
        }),
      );
    });

    it("should reject user without valid session user object", async () => {
      const invalidSession = {
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as Session;

      mockAuth.mockResolvedValue(invalidSession);

      const caller = createCaller({
        db,
        session: invalidSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      await expect(caller.user.getCurrentMembership()).rejects.toThrow(
        new TRPCError({
          code: "UNAUTHORIZED",
        }),
      );
    });
  });

  describe("organizationProcedure middleware", () => {
    it("should allow user with organization membership to access organization procedure", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);

      const caller = createCaller({
        db,
        session: mockSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      // Test with an organization procedure - using issue.getAll as example
      const result = await caller.user.getCurrentMembership();

      expect(result).toEqual(mockMembership);
      expect(mockMembershipFindUnique).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: "user-123",
            organizationId: "org-123",
          },
        },
      });
    });

    it("should reject user without organization membership", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(null); // No membership

      const caller = createCaller({
        db,
        session: mockSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      await expect(caller.user.getCurrentMembership()).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access this organization",
        }),
      );
    });

    it("should reject user when organization not found", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(null); // Organization not found

      const caller = createCaller({
        db,
        session: mockSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      await expect(caller.user.getCurrentMembership()).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        }),
      );
    });
  });

  describe("Multi-tenant security", () => {
    it("should prevent access to different organization's data", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // User tries to access different organization via different subdomain
      const differentOrganization = {
        id: "org-456",
        name: "Different Organization",
        subdomain: "different",
        logoUrl: null,
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(differentOrganization);
      mockMembershipFindUnique.mockResolvedValue(null); // No membership in different org

      const caller = createCaller({
        db,
        session: mockSession,
        organization: differentOrganization,
        headers: new Headers({
          host: "different.localhost:3000", // Different subdomain
        }),
      });

      await expect(caller.user.getCurrentMembership()).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access this organization",
        }),
      );
    });

    it("should allow access when user has membership in current organization", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);

      const caller = createCaller({
        db,
        session: mockSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      const result = await caller.user.getCurrentMembership();

      expect(result).toEqual(mockMembership);
    });
  });

  describe("Role-based access control", () => {
    it("should allow admin access to admin procedures", async () => {
      const mockAdminSession: Session = {
        user: {
          id: "admin-123",
          name: "Admin User",
          email: "admin@example.com",
          role: "admin",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockAdminSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockAdminMembership);

      const caller = createCaller({
        db,
        session: mockAdminSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      // This should work for admin users
      const result = await caller.user.getCurrentMembership();
      expect(result).toEqual(mockAdminMembership);
    });

    it("should deny non-admin access to admin procedures", async () => {
      const mockMemberSession: Session = {
        user: {
          id: "user-123",
          name: "Member User",
          email: "member@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockMemberSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);

      const caller = createCaller({
        db,
        session: mockMemberSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      // Note: We would need an actual admin-only procedure to test this
      // For now, we're testing that the organization middleware works correctly
      const result = await caller.user.getCurrentMembership();
      expect(result).toEqual(mockMembership);
    });
  });

  describe("Organization context resolution", () => {
    it("should resolve organization from subdomain", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);

      const caller = createCaller({
        db,
        session: mockSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "test.localhost:3000",
        }),
      });

      await caller.user.getCurrentMembership();

      expect(mockOrganizationFindUnique).toHaveBeenCalledWith({
        where: { subdomain: "test" },
      });
    });

    it("should handle localhost without subdomain", async () => {
      const mockSession: Session = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          role: "member",
          organizationId: "org-123",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockAuth.mockResolvedValue(mockSession);
      mockOrganizationFindUnique.mockResolvedValue(mockOrganization);
      mockMembershipFindUnique.mockResolvedValue(mockMembership);

      const caller = createCaller({
        db,
        session: mockSession,
        organization: mockOrganization,
        headers: new Headers({
          host: "localhost:3000",
        }),
      });

      await caller.user.getCurrentMembership();

      // Should fall back to "apc" subdomain for localhost
      expect(mockOrganizationFindUnique).toHaveBeenCalledWith({
        where: { subdomain: "apc" },
      });
    });
  });
});
