/* eslint-disable @typescript-eslint/dot-notation */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { type ExtendedPrismaClient } from "../../db";
import { createAuthConfig } from "../config";

import type { User } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Test suite for NextAuth session integration changes
 * Focuses on JWT and session callbacks for invitation and onboarding system
 */

// Use vi.hoisted to properly handle variable hoisting
const { mockEnv } = vi.hoisted(() => {
  const mockEnv = {
    NODE_ENV: "development",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    AUTH_SECRET: "test-secret",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    OPDB_API_URL: "https://opdb.org/api",
    DEFAULT_ORG_SUBDOMAIN: "apc",
  };

  return { mockEnv };
});

vi.mock("~/env.js", () => ({
  env: mockEnv,
}));

// Mock NextAuth dependencies
vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn().mockReturnValue({
    createUser: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({
    id: "google",
    name: "Google",
    type: "oauth",
    clientId: "test-google-client-id",
    clientSecret: "test-google-client-secret",
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => ({
    id: "credentials",
    name: config?.name || "Credentials",
    type: "credentials",
    credentials: config?.credentials || {},
    authorize: config?.authorize || vi.fn(),
    options: config,
  })),
}));

// Test data factories for session integration
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  image: null,
  ...overrides,
});

const createMockUserRecord = (
  overrides: {
    onboardingCompleted?: boolean;
    invitedBy?: string | null;
  } = {},
) => ({
  onboardingCompleted: false,
  invitedBy: null,
  ...overrides,
});

const createMockOrganization = () => ({
  id: "org-apc",
  name: "Austin Pinball Collective",
  subdomain: "apc",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createMockMembership = (
  overrides: {
    role?: { name: string };
  } = {},
) => ({
  id: "membership-123",
  userId: "user-123",
  organizationId: "org-apc",
  roleId: "role-admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  role: {
    id: "role-admin",
    name: "Admin",
    organizationId: "org-apc",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides.role,
  },
});

interface MockContext {
  db: ExtendedPrismaClient;
}

const createMockContext = (): MockContext => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
    },
  } as unknown as ExtendedPrismaClient,
});

describe("NextAuth Session Integration", () => {
  let ctx: MockContext;
  let db: ExtendedPrismaClient;
  let authConfig: ReturnType<typeof createAuthConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockContext();
    db = ctx.db;
    authConfig = createAuthConfig(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("JWT Callback - User Data Fetching", () => {
    it("should fetch and populate onboardingCompleted and invitedBy fields", async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockUserRecord = createMockUserRecord({
        onboardingCompleted: true,
        invitedBy: "user-456",
      });
      const mockOrganization = createMockOrganization();
      const mockMembership = createMockMembership();

      // Setup database mocks
      db.user.findUnique = vi.fn().mockResolvedValue(mockUserRecord);
      db.organization.findUnique = vi.fn().mockResolvedValue(mockOrganization);
      db.membership.findUnique = vi.fn().mockResolvedValue(mockMembership);

      const initialToken: JWT = {} as JWT;

      // Act
      const result = await authConfig.callbacks?.jwt?.({
        token: initialToken,
        user: mockUser,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.["id"]).toBe("user-123");
      expect(result?.["onboardingCompleted"]).toBe(true);
      expect(result?.["invitedBy"]).toBe("user-456");
      expect(result?.["role"]).toBe("Admin");
      expect(result?.["organizationId"]).toBe("org-apc");

      // Verify database calls
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" },
        select: {
          onboardingCompleted: true,
          invitedBy: true,
        },
      });
    });

    it("should handle user with incomplete onboarding", async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockUserRecord = createMockUserRecord({
        onboardingCompleted: false,
        invitedBy: "admin-user",
      });
      const mockOrganization = createMockOrganization();
      const mockMembership = createMockMembership();

      // Setup database mocks
      db.user.findUnique = vi.fn().mockResolvedValue(mockUserRecord);
      db.organization.findUnique = vi.fn().mockResolvedValue(mockOrganization);
      db.membership.findUnique = vi.fn().mockResolvedValue(mockMembership);

      const initialToken: JWT = {} as JWT;

      // Act
      const result = await authConfig.callbacks?.jwt?.({
        token: initialToken,
        user: mockUser,
      });

      // Assert
      expect(result?.["onboardingCompleted"]).toBe(false);
      expect(result?.["invitedBy"]).toBe("admin-user");
    });

    it("should handle user without invitation (self-registered)", async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockUserRecord = createMockUserRecord({
        onboardingCompleted: true,
        invitedBy: null,
      });
      const mockOrganization = createMockOrganization();
      const mockMembership = createMockMembership();

      // Setup database mocks
      db.user.findUnique = vi.fn().mockResolvedValue(mockUserRecord);
      db.organization.findUnique = vi.fn().mockResolvedValue(mockOrganization);
      db.membership.findUnique = vi.fn().mockResolvedValue(mockMembership);

      const initialToken: JWT = {} as JWT;

      // Act
      const result = await authConfig.callbacks?.jwt?.({
        token: initialToken,
        user: mockUser,
      });

      // Assert
      expect(result?.["onboardingCompleted"]).toBe(true);
      expect(result?.["invitedBy"]).toBeUndefined(); // Not set in token when null
    });

    it("should handle missing user record gracefully", async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockOrganization = createMockOrganization();
      const mockMembership = createMockMembership();

      // Setup database mocks - user record not found
      db.user.findUnique = vi.fn().mockResolvedValue(null);
      db.organization.findUnique = vi.fn().mockResolvedValue(mockOrganization);
      db.membership.findUnique = vi.fn().mockResolvedValue(mockMembership);

      const initialToken: JWT = {} as JWT;

      // Act
      const result = await authConfig.callbacks?.jwt?.({
        token: initialToken,
        user: mockUser,
      });

      // Assert
      expect(result?.["id"]).toBe("user-123");
      expect(result?.["onboardingCompleted"]).toBeUndefined();
      expect(result?.["invitedBy"]).toBeUndefined();
      expect(result?.["role"]).toBe("Admin"); // Still gets role from membership
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const mockUser = createMockUser();

      // Setup database mocks to throw error
      db.user.findUnique = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));
      db.organization.findUnique = vi
        .fn()
        .mockResolvedValue(createMockOrganization());
      db.membership.findUnique = vi
        .fn()
        .mockResolvedValue(createMockMembership());

      const initialToken: JWT = {} as JWT;

      // Act & Assert
      await expect(async () => {
        await authConfig.callbacks?.jwt?.({
          token: initialToken,
          user: mockUser,
        });
      }).rejects.toThrow("Database error");
    });

    it("should handle missing organization gracefully", async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockUserRecord = createMockUserRecord({
        onboardingCompleted: true,
        invitedBy: "user-456",
      });

      // Setup database mocks - organization not found
      db.user.findUnique = vi.fn().mockResolvedValue(mockUserRecord);
      db.organization.findUnique = vi.fn().mockResolvedValue(null);

      const initialToken: JWT = {} as JWT;

      // Act
      const result = await authConfig.callbacks?.jwt?.({
        token: initialToken,
        user: mockUser,
      });

      // Assert
      expect(result?.["id"]).toBe("user-123");
      expect(result?.["onboardingCompleted"]).toBe(true);
      expect(result?.["invitedBy"]).toBe("user-456");
      expect(result?.["role"]).toBeUndefined(); // No role without org
      expect(result?.["organizationId"]).toBeUndefined();
    });

    it("should handle missing membership gracefully", async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockUserRecord = createMockUserRecord({
        onboardingCompleted: true,
        invitedBy: "user-456",
      });
      const mockOrganization = createMockOrganization();

      // Setup database mocks - membership not found
      db.user.findUnique = vi.fn().mockResolvedValue(mockUserRecord);
      db.organization.findUnique = vi.fn().mockResolvedValue(mockOrganization);
      db.membership.findUnique = vi.fn().mockResolvedValue(null);

      const initialToken: JWT = {} as JWT;

      // Act
      const result = await authConfig.callbacks?.jwt?.({
        token: initialToken,
        user: mockUser,
      });

      // Assert
      expect(result?.["id"]).toBe("user-123");
      expect(result?.["onboardingCompleted"]).toBe(true);
      expect(result?.["invitedBy"]).toBe("user-456");
      expect(result?.["role"]).toBeUndefined(); // No role without membership
      expect(result?.["organizationId"]).toBeUndefined(); // No org ID without membership
    });

    it("should only process token when user is provided", async () => {
      // Arrange
      const existingToken: JWT = {
        id: "existing-user",
        role: "ExistingRole",
        organizationId: "existing-org",
        onboardingCompleted: true,
        invitedBy: "existing-inviter",
      };

      // Act - No user provided (subsequent token refresh)
      const result = await authConfig.callbacks?.jwt?.({
        token: existingToken,
        user: undefined as any,
      });

      // Assert
      expect(result).toEqual(existingToken); // Token unchanged
      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.organization.findUnique).not.toHaveBeenCalled();
      expect(db.membership.findUnique).not.toHaveBeenCalled();
    });

    it("should handle invalid user object gracefully", async () => {
      // Arrange
      const invalidUser = { name: "Test" } as User; // Missing id
      const initialToken: JWT = {} as JWT;

      // Act
      const result = await authConfig.callbacks?.jwt?.({
        token: initialToken,
        user: invalidUser,
      });

      // Assert
      expect(result).toEqual(initialToken); // Token unchanged
      expect(db.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("Session Callback - JWT to Session Transfer", () => {
    it("should transfer all JWT fields to session", () => {
      // Arrange
      const mockJWT: JWT = {
        id: "user-123",
        role: "Admin",
        organizationId: "org-456",
        onboardingCompleted: true,
        invitedBy: "user-789",
      };

      const mockSession = {
        user: {
          id: "old-id", // This should be overridden
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Act
      const result = authConfig.callbacks?.session?.({
        session: mockSession,
        token: mockJWT,
      } as any) as any;

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe("user-123");
      expect(result.user.name).toBe("Test User"); // Preserved
      expect(result.user.email).toBe("test@example.com"); // Preserved
      expect(result.user.role).toBe("Admin");
      expect(result.user.organizationId).toBe("org-456");
      expect(result.user.onboardingCompleted).toBe(true);
      expect(result.user.invitedBy).toBe("user-789");
      expect(result.expires).toBe(mockSession.expires); // Preserved
    });

    it("should handle JWT with only required fields", () => {
      // Arrange
      const mockJWT: JWT = {
        id: "user-minimal",
      };

      const mockSession = {
        user: {
          id: "old-id",
          name: "Minimal User",
          email: "minimal@example.com",
          image: "avatar.jpg",
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Act
      const result = authConfig.callbacks?.session?.({
        session: mockSession,
        token: mockJWT,
      } as any) as any;

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe("user-minimal");
      expect(result.user.name).toBe("Minimal User");
      expect(result.user.email).toBe("minimal@example.com");
      expect(result.user.image).toBe("avatar.jpg");
      expect(result.user.role).toBeUndefined();
      expect(result.user.organizationId).toBeUndefined();
      expect(result.user.onboardingCompleted).toBeUndefined();
      expect(result.user.invitedBy).toBeUndefined();
    });

    it("should handle JWT with partial invitation data", () => {
      // Arrange
      const mockJWT: JWT = {
        id: "user-partial",
        onboardingCompleted: false,
        // No invitedBy - user self-registered
      };

      const mockSession = {
        user: {
          id: "old-id",
          name: "Partial User",
          email: "partial@example.com",
          image: null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Act
      const result = authConfig.callbacks?.session?.({
        session: mockSession,
        token: mockJWT,
      } as any) as any;

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe("user-partial");
      expect(result.user.onboardingCompleted).toBe(false);
      expect(result.user.invitedBy).toBeUndefined(); // Not in JWT
      expect(result.user.role).toBeUndefined();
      expect(result.user.organizationId).toBeUndefined();
    });

    it("should handle JWT with invalid type values gracefully", () => {
      // Arrange - JWT with wrong types (should be filtered out)
      const mockJWT: JWT = {
        id: "user-invalid-types",
        role: 123 as any, // Invalid type - should be filtered
        organizationId: true as any, // Invalid type - should be filtered
        onboardingCompleted: "true" as any, // Invalid type - should be filtered
        invitedBy: null as any, // Invalid type - should be filtered
      };

      const mockSession = {
        user: {
          id: "old-id",
          name: "Invalid Types User",
          email: "invalid@example.com",
          image: null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Act
      const result = authConfig.callbacks?.session?.({
        session: mockSession,
        token: mockJWT,
      } as any) as any;

      // Assert - Only valid types should be transferred
      expect(result).toBeDefined();
      expect(result.user.id).toBe("user-invalid-types");
      expect(result.user.role).toBeUndefined(); // Filtered out
      expect(result.user.organizationId).toBeUndefined(); // Filtered out
      expect(result.user.onboardingCompleted).toBeUndefined(); // Filtered out
      expect(result.user.invitedBy).toBeUndefined(); // Filtered out
    });

    it("should handle empty JWT gracefully", () => {
      // Arrange
      const mockJWT: JWT = {} as JWT;

      const mockSession = {
        user: {
          id: "old-id",
          name: "Empty JWT User",
          email: "empty@example.com",
          image: null,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // Act
      const result = authConfig.callbacks?.session?.({
        session: mockSession,
        token: mockJWT,
      } as any) as any;

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe(""); // Empty string fallback for missing id
      expect(result.user.role).toBeUndefined();
      expect(result.user.organizationId).toBeUndefined();
      expect(result.user.onboardingCompleted).toBeUndefined();
      expect(result.user.invitedBy).toBeUndefined();
    });

    it("should preserve all original session properties", () => {
      // Arrange
      const mockJWT: JWT = {
        id: "user-preserve",
        role: "Member",
      };

      const mockSession = {
        user: {
          id: "old-id",
          name: "Preserve User",
          email: "preserve@example.com",
          image: "preserve-avatar.jpg",
          // Additional properties that should be preserved
          emailVerified: new Date("2024-01-01"),
        },
        expires: "2024-12-31T23:59:59.999Z",
        // Additional session properties
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
      };

      // Act
      const result = authConfig.callbacks?.session?.({
        session: mockSession,
        token: mockJWT,
      } as any) as any;

      // Assert - All original properties preserved
      expect(result).toBeDefined();

      // New values from JWT
      expect(result.user.id).toBe("user-preserve");
      expect(result.user.role).toBe("Member");

      // Preserved from original session
      expect(result.user.name).toBe("Preserve User");
      expect(result.user.email).toBe("preserve@example.com");
      expect(result.user.image).toBe("preserve-avatar.jpg");
      expect(result.user.emailVerified).toEqual(new Date("2024-01-01"));
      expect(result.expires).toBe("2024-12-31T23:59:59.999Z");
      expect(result.accessToken).toBe("test-access-token");
      expect(result.refreshToken).toBe("test-refresh-token");
    });
  });
});
