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

// Create mock service methods that we'll assign to instances
const mockCreateInvitation = vi.fn();
const mockGetOrganizationInvitations = vi.fn();
const mockRevokeInvitation = vi.fn();

// Mock InvitationService
vi.mock("~/server/services/invitationService", () => ({
  InvitationService: vi.fn().mockImplementation(() => ({
    createInvitation: mockCreateInvitation,
    getOrganizationInvitations: mockGetOrganizationInvitations,
    revokeInvitation: mockRevokeInvitation,
  })),
}));

import type { Session } from "next-auth";

import { appRouter } from "~/server/api/root";
import { InvitationService } from "~/server/services/invitationService";
import { createVitestMockContext } from "~/test/vitestMockContext";

// Mock data for tests
const mockOrganization = {
  id: "org-1",
  name: "Test Organization",
  subdomain: "test",
};

const mockInvitation = {
  id: "invite-1",
  email: "newuser@example.com",
  organizationId: "org-1",
  invitedBy: "user-1",
  roleId: "role-1",
  token: "secure-token-123",
  status: "PENDING" as const,
  message: "Welcome to our team!",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test",
  },
  inviter: {
    id: "user-1",
    name: "Admin User",
    email: "admin@example.com",
  },
  role: {
    id: "role-1",
    name: "Member",
  },
};

// Helper to create authenticated context
const createAuthenticatedContext = () => {
  const mockContext = createVitestMockContext();

  // Extend mock context with invitation table
  mockContext.db.invitation = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  } as any;

  // Set up session with organizationId (cast to proper Session type)
  mockContext.session = {
    user: {
      id: "user-1",
      email: "admin@example.com",
      name: "Admin User",
      image: null,
      organizationId: "org-1", // Optional field from auth config
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  } as Session;

  mockContext.organization = mockOrganization;

  return mockContext;
};

// Helper to create context without organization
const createUnauthenticatedContext = () => {
  const mockContext = createVitestMockContext();

  // Extend mock context with invitation table
  mockContext.db.invitation = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  } as any;

  mockContext.session = null;
  mockContext.organization = null;

  return mockContext;
};

// Helper to create context without organizationId
const createUserWithoutOrgContext = () => {
  const mockContext = createVitestMockContext();

  // Extend mock context with invitation table
  mockContext.db.invitation = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  } as any;

  mockContext.session = {
    user: {
      id: "user-1",
      email: "admin@example.com",
      name: "Admin User",
      image: null,
      // Missing organizationId
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  };

  mockContext.organization = null;

  return mockContext;
};

describe("invitationRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockCreateInvitation.mockReset();
    mockGetOrganizationInvitations.mockReset();
    mockRevokeInvitation.mockReset();
  });

  describe("create procedure", () => {
    it("should successfully create an invitation with valid input", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockCreateInvitation.mockResolvedValue(mockInvitation);

      const input = {
        email: "newuser@example.com",
        roleId: "role-1",
        message: "Welcome to our team!",
      };

      const result = await caller.invitation.create(input);

      expect(result).toEqual(mockInvitation);
      expect(mockCreateInvitation).toHaveBeenCalledWith({
        email: "newuser@example.com",
        organizationId: "org-1",
        invitedBy: "user-1",
        roleId: "role-1",
        message: "Welcome to our team!",
      });
    });

    it("should create invitation without optional message", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockCreateInvitation.mockResolvedValue(mockInvitation);

      const input = {
        email: "newuser@example.com",
        roleId: "role-1",
      };

      await caller.invitation.create(input);

      expect(mockCreateInvitation).toHaveBeenCalledWith({
        email: "newuser@example.com",
        organizationId: "org-1",
        invitedBy: "user-1",
        roleId: "role-1",
      });
    });

    it("should reject unauthenticated requests", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        email: "newuser@example.com",
        roleId: "role-1",
      };

      await expect(caller.invitation.create(input)).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });

    it("should reject users without organization", async () => {
      const ctx = createUserWithoutOrgContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        email: "newuser@example.com",
        roleId: "role-1",
      };

      await expect(caller.invitation.create(input)).rejects.toThrow(
        "You must be part of an organization to send invitations",
      );
    });

    it("should validate email format", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        email: "invalid-email",
        roleId: "role-1",
      };

      await expect(caller.invitation.create(input)).rejects.toThrow();
    });

    it("should validate required fields", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Missing email
      await expect(
        caller.invitation.create({
          roleId: "role-1",
        } as any),
      ).rejects.toThrow();

      // Missing roleId
      await expect(
        caller.invitation.create({
          email: "test@example.com",
        } as any),
      ).rejects.toThrow();

      // Empty roleId
      await expect(
        caller.invitation.create({
          email: "test@example.com",
          roleId: "",
        }),
      ).rejects.toThrow();
    });

    it("should handle service errors gracefully", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockCreateInvitation.mockRejectedValue(
        new Error("User is already a member of this organization"),
      );

      const input = {
        email: "existing@example.com",
        roleId: "role-1",
      };

      await expect(caller.invitation.create(input)).rejects.toThrow(
        "User is already a member of this organization",
      );
    });
  });

  describe("list procedure", () => {
    it("should return organization invitations for authenticated user", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockGetOrganizationInvitations.mockResolvedValue([mockInvitation]);

      const result = await caller.invitation.list();

      expect(result).toEqual([mockInvitation]);
      expect(mockGetOrganizationInvitations).toHaveBeenCalledWith("org-1");
    });

    it("should reject unauthenticated requests", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.invitation.list()).rejects.toThrow("UNAUTHORIZED");
    });

    it("should reject users without organization", async () => {
      const ctx = createUserWithoutOrgContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.invitation.list()).rejects.toThrow(
        "You must be part of an organization to view invitations",
      );
    });

    it("should handle empty invitation list", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockGetOrganizationInvitations.mockResolvedValue([]);

      const result = await caller.invitation.list();

      expect(result).toEqual([]);
      expect(mockGetOrganizationInvitations).toHaveBeenCalledWith("org-1");
    });
  });

  describe("revoke procedure", () => {
    it("should successfully revoke an invitation", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockRevokeInvitation.mockResolvedValue(undefined);

      const input = {
        invitationId: "invite-1",
      };

      const result = await caller.invitation.revoke(input);

      expect(result).toEqual({ success: true });
      expect(mockRevokeInvitation).toHaveBeenCalledWith("invite-1", "org-1");
    });

    it("should reject unauthenticated requests", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        invitationId: "invite-1",
      };

      await expect(caller.invitation.revoke(input)).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });

    it("should reject users without organization", async () => {
      const ctx = createUserWithoutOrgContext();
      const caller = appRouter.createCaller(ctx);

      const input = {
        invitationId: "invite-1",
      };

      await expect(caller.invitation.revoke(input)).rejects.toThrow(
        "You must be part of an organization to revoke invitations",
      );
    });

    it("should validate required invitationId", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.invitation.revoke({} as any)).rejects.toThrow();
    });

    it("should handle service errors gracefully", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockRevokeInvitation.mockRejectedValue(new Error("Invitation not found"));

      const input = {
        invitationId: "nonexistent-invite",
      };

      await expect(caller.invitation.revoke(input)).rejects.toThrow(
        "Invitation not found",
      );
    });
  });

  describe("getRoles procedure", () => {
    it("should return available roles for organization", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const mockRoles = [
        {
          id: "role-1",
          name: "Member",
          isSystem: false,
        },
        {
          id: "role-2",
          name: "Admin",
          isSystem: true,
        },
      ];

      vi.mocked(ctx.db.role.findMany).mockResolvedValue(mockRoles as any);

      const result = await caller.invitation.getRoles();

      expect(result).toEqual(mockRoles);
      expect(ctx.db.role.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
        },
        select: {
          id: true,
          name: true,
          isSystem: true,
        },
        orderBy: {
          name: "asc",
        },
      });
    });

    it("should reject unauthenticated requests", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.invitation.getRoles()).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });

    it("should reject users without organization", async () => {
      const ctx = createUserWithoutOrgContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.invitation.getRoles()).rejects.toThrow(
        "You must be part of an organization to view roles",
      );
    });

    it("should handle empty roles list", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      vi.mocked(ctx.db.role.findMany).mockResolvedValue([]);

      const result = await caller.invitation.getRoles();

      expect(result).toEqual([]);
    });

    it("should enforce organization scoping", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const mockRoles = [
        {
          id: "role-1",
          name: "Member",
          isSystem: false,
        },
      ];

      vi.mocked(ctx.db.role.findMany).mockResolvedValue(mockRoles as any);

      await caller.invitation.getRoles();

      // Verify that the query includes organizationId filter
      expect(ctx.db.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        }),
      );
    });
  });

  describe("Input validation edge cases", () => {
    it("should handle various email formats", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Valid email formats
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.co.uk",
        "123@test.org",
      ];

      for (const email of validEmails) {
        mockCreateInvitation.mockResolvedValue(mockInvitation);
        await expect(
          caller.invitation.create({
            email,
            roleId: "role-1",
          }),
        ).resolves.toBeDefined();
      }

      // Invalid email formats should be rejected by Zod validation
      // These emails will fail the regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const invalidEmails = [
        "invalid-email", // No @ or .
        "@example.com", // Starts with @
        "user@", // No domain after @
        "user space@example.com", // Contains space
        "", // Empty string
        "user@domain", // No . in domain
        "user@@example.com", // Double @
        "user@.com", // No domain name before .
      ];

      for (const email of invalidEmails) {
        await expect(
          caller.invitation.create({
            email,
            roleId: "role-1",
          }),
        ).rejects.toThrow();
      }
    });

    it("should handle long message content", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockCreateInvitation.mockResolvedValue(mockInvitation);

      const longMessage = "A".repeat(1000); // Very long message

      await expect(
        caller.invitation.create({
          email: "test@example.com",
          roleId: "role-1",
          message: longMessage,
        }),
      ).resolves.toBeDefined();

      expect(mockCreateInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          message: longMessage,
        }),
      );
    });

    it("should handle special characters in message", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      mockCreateInvitation.mockResolvedValue(mockInvitation);

      const specialMessage =
        "Welcome! 🎉 Here's your <script>alert('test')</script> invitation & more...";

      await expect(
        caller.invitation.create({
          email: "test@example.com",
          roleId: "role-1",
          message: specialMessage,
        }),
      ).resolves.toBeDefined();

      expect(mockCreateInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          message: specialMessage,
        }),
      );
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle database connection errors", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      vi.mocked(ctx.db.role.findMany).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(caller.invitation.getRoles()).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should handle invitation service initialization errors", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const mockInvitationService = vi.mocked(InvitationService);
      mockInvitationService.mockImplementation(() => {
        throw new Error("Service initialization failed");
      });

      const input = {
        email: "test@example.com",
        roleId: "role-1",
      };

      await expect(caller.invitation.create(input)).rejects.toThrow(
        "Service initialization failed",
      );
    });

    it("should handle concurrent revocation attempts", async () => {
      const ctx = createAuthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      // Reset the service mock to ensure clean state
      const mockInvitationService = vi.mocked(InvitationService);
      mockInvitationService.mockImplementation(
        () =>
          ({
            createInvitation: mockCreateInvitation,
            getOrganizationInvitations: mockGetOrganizationInvitations,
            revokeInvitation: mockRevokeInvitation,
            // Add other required methods as stubs
            validateInvitation: vi.fn(),
            acceptInvitation: vi.fn(),
            checkPendingInvitation: vi.fn(),
          }) as any,
      );

      mockRevokeInvitation.mockRejectedValue(
        new Error("Invitation has already been revoked"),
      );

      const input = {
        invitationId: "invite-1",
      };

      await expect(caller.invitation.revoke(input)).rejects.toThrow(
        "Invitation has already been revoked",
      );
    });
  });
});
