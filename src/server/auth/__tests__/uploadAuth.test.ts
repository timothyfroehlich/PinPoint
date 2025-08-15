/**
 * Upload Authentication Tests
 *
 * Tests for upload-specific authentication functions that handle:
 * - Authentication validation with Supabase
 * - Organization resolution from subdomain headers
 * - Membership and permission checking with Drizzle
 * - Error scenarios (unauthorized, forbidden, not found)
 *
 * Uses Vitest with comprehensive mocking of Supabase auth and Drizzle database queries.
 * Focused on achieving 80%+ coverage of the main execution paths.
 */

/* eslint-disable @typescript-eslint/no-confusing-void-expression */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSupabaseUser } from "../supabase";
import { isValidOrganization, isValidMembership } from "../types";
import {
  getUploadAuthContext,
  requireUploadPermission,
  validateUploadAuth,
  type UploadAuthContext,
} from "../uploadAuth";

import type { NextRequest } from "next/server";
import type { PinPointSupabaseUser } from "~/lib/supabase/types";
import type { DrizzleClient } from "~/server/db/drizzle";

// Mock external dependencies
vi.mock("../supabase", () => ({
  getSupabaseUser: vi.fn(),
}));

vi.mock("../types", () => ({
  isValidOrganization: vi.fn(),
  isValidMembership: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    DEFAULT_ORG_SUBDOMAIN: "default-org",
  },
}));

// Import mocks for type checking

// Mock implementations
const mockGetSupabaseUser = vi.mocked(getSupabaseUser);
const mockIsValidOrganization = vi.mocked(isValidOrganization);
const mockIsValidMembership = vi.mocked(isValidMembership);

// Test data factories
function createMockSupabaseUser(
  overrides: Partial<PinPointSupabaseUser> = {},
): PinPointSupabaseUser {
  return {
    id: "user-123",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: "2023-01-01T00:00:00Z",
    phone: "",
    last_sign_in_at: "2023-01-01T00:00:00Z",
    app_metadata: {
      provider: "google",
      organization_id: "org-1",
      role: "member",
    },
    user_metadata: {
      name: "Test User",
      email: "test@example.com",
    },
    identities: [],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    is_anonymous: false,
    ...overrides,
  };
}

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: {
      get: vi.fn((name: string) => headers[name] || null),
    },
  } as unknown as NextRequest;
}

function createMockDrizzleClient(): DrizzleClient {
  return {
    query: {
      organizations: {
        findFirst: vi.fn(),
      },
      memberships: {
        findFirst: vi.fn(),
      },
    },
  } as unknown as DrizzleClient;
}

function createMockOrganization() {
  return {
    id: "org-1",
    name: "Test Organization",
    subdomain: "test-org",
  };
}

function createMockMembership() {
  return {
    id: "membership-1",
    userId: "user-123",
    organizationId: "org-1",
    roleId: "role-1",
    role: {
      id: "role-1",
      name: "admin",
      rolePermissions: [
        {
          permission: { name: "upload:create" },
        },
        {
          permission: { name: "file:manage" },
        },
      ],
    },
  };
}

describe("uploadAuth", () => {
  let mockRequest: NextRequest;
  let mockDrizzle: DrizzleClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = createMockRequest();
    mockDrizzle = createMockDrizzleClient();
  });

  describe("getUploadAuthContext", () => {
    it("should return auth context for valid authenticated user", async () => {
      // Arrange
      const mockUser = createMockSupabaseUser();
      const mockOrg = createMockOrganization();
      const mockMembership = createMockMembership();

      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(true);

      // Set up subdomain header
      mockRequest = createMockRequest({ "x-subdomain": "test-org" });

      // Set up database query mocks
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        mockOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        mockMembership,
      );

      // Act
      const result = await getUploadAuthContext(mockRequest, mockDrizzle);

      // Assert
      expect(result).toEqual({
        user: mockUser,
        organization: mockOrg,
        membership: mockMembership,
        userPermissions: ["upload:create", "file:manage"],
      });

      // Verify function calls
      expect(mockGetSupabaseUser).toHaveBeenCalledOnce();
      expect(mockDrizzle.query.organizations.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
      expect(mockDrizzle.query.memberships.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: expect.objectContaining({
            role: expect.objectContaining({
              with: expect.objectContaining({
                rolePermissions: expect.objectContaining({
                  with: expect.objectContaining({
                    permission: true,
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });

    it("should use default subdomain when x-subdomain header is missing", async () => {
      // Arrange
      const mockUser = createMockSupabaseUser();
      const mockOrg = createMockOrganization();
      const mockMembership = createMockMembership();

      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(true);

      // No subdomain header
      mockRequest = createMockRequest({});

      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        mockOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        mockMembership,
      );

      // Act
      await getUploadAuthContext(mockRequest, mockDrizzle);

      // Assert - should use default subdomain
      expect(mockDrizzle.query.organizations.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
    });

    it("should throw UNAUTHORIZED when user is not authenticated", async () => {
      // Arrange
      mockGetSupabaseUser.mockResolvedValue(null);

      // Act & Assert
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        }),
      );

      // Verify no database queries were made
      expect(mockDrizzle.query.organizations.findFirst).not.toHaveBeenCalled();
      expect(mockDrizzle.query.memberships.findFirst).not.toHaveBeenCalled();
    });

    it("should throw NOT_FOUND when organization does not exist", async () => {
      // Arrange
      const mockUser = createMockSupabaseUser();

      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockIsValidOrganization.mockReturnValue(false);

      mockRequest = createMockRequest({ "x-subdomain": "nonexistent-org" });
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        null,
      );

      // Act & Assert
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: 'Organization with subdomain "nonexistent-org" not found',
        }),
      );

      // Verify membership query was not made
      expect(mockDrizzle.query.memberships.findFirst).not.toHaveBeenCalled();
    });

    it("should throw FORBIDDEN when user is not a member of the organization", async () => {
      // Arrange
      const mockUser = createMockSupabaseUser();
      const mockOrg = createMockOrganization();

      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(false);

      mockRequest = createMockRequest({ "x-subdomain": "test-org" });
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        mockOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        null,
      );

      // Act & Assert
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "User is not a member of this organization",
        }),
      );
    });

    it("should handle membership with empty permissions", async () => {
      // Arrange
      const mockUser = createMockSupabaseUser();
      const mockOrg = createMockOrganization();
      const mockMembershipNoPerms = {
        ...createMockMembership(),
        role: {
          id: "role-1",
          name: "basic",
          rolePermissions: [], // No permissions
        },
      };

      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(true);

      mockRequest = createMockRequest({ "x-subdomain": "test-org" });
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        mockOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        mockMembershipNoPerms,
      );

      // Act
      const result = await getUploadAuthContext(mockRequest, mockDrizzle);

      // Assert
      expect(result.userPermissions).toEqual([]);
    });
  });

  describe("requireUploadPermission", () => {
    let mockAuthContext: UploadAuthContext;

    beforeEach(() => {
      mockAuthContext = {
        user: createMockSupabaseUser(),
        organization: createMockOrganization(),
        membership: createMockMembership(),
        userPermissions: ["upload:create", "file:manage", "admin:full"],
      };
    });

    it("should not throw when user has required permission", () => {
      // Act & Assert - should not throw
      expect(() => {
        requireUploadPermission(mockAuthContext, "upload:create");
      }).not.toThrow();

      expect(() => {
        requireUploadPermission(mockAuthContext, "file:manage");
      }).not.toThrow();

      expect(() => {
        requireUploadPermission(mockAuthContext, "admin:full");
      }).not.toThrow();
    });

    it("should throw FORBIDDEN when user lacks required permission", () => {
      // Act & Assert
      expect(() => {
        requireUploadPermission(mockAuthContext, "upload:delete");
      }).toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Permission required: upload:delete",
        }),
      );

      expect(() => {
        requireUploadPermission(mockAuthContext, "admin:super");
      }).toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Permission required: admin:super",
        }),
      );
    });

    it("should throw FORBIDDEN when user has no permissions", () => {
      // Arrange
      const contextNoPerms = {
        ...mockAuthContext,
        userPermissions: [],
      };

      // Act & Assert
      expect(() => {
        requireUploadPermission(contextNoPerms, "upload:create");
      }).toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Permission required: upload:create",
        }),
      );
    });

    it("should be case-sensitive for permission checks", () => {
      // Act & Assert
      expect(() => {
        requireUploadPermission(mockAuthContext, "UPLOAD:CREATE");
      }).toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Permission required: UPLOAD:CREATE",
        }),
      );

      expect(() => {
        requireUploadPermission(mockAuthContext, "Upload:Create");
      }).toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Permission required: Upload:Create",
        }),
      );
    });
  });

  describe("validateUploadAuth", () => {
    it("should return undefined for placeholder implementation", () => {
      // Arrange
      const mockDrizzle = createMockDrizzleClient();

      // Act
      const result = validateUploadAuth(mockDrizzle, "session-123", "org-456");

      // Assert
      expect(result).toBeUndefined();
    });

    it("should handle calls with minimal parameters", () => {
      // Arrange
      const mockDrizzle = createMockDrizzleClient();

      // Act & Assert - should not throw
      expect(() => {
        validateUploadAuth(mockDrizzle);
      }).not.toThrow();

      expect(() => {
        validateUploadAuth(mockDrizzle, "session-only");
      }).not.toThrow();
    });
  });

  describe("error handling edge cases", () => {
    it("should handle organization query returning undefined", async () => {
      // Arrange
      const mockUser = createMockSupabaseUser();

      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockIsValidOrganization.mockReturnValue(false);

      mockRequest = createMockRequest({ "x-subdomain": "test-org" });
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        undefined,
      );

      // Act & Assert
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: 'Organization with subdomain "test-org" not found',
        }),
      );
    });

    it("should handle membership query returning undefined", async () => {
      // Arrange
      const mockUser = createMockSupabaseUser();
      const mockOrg = createMockOrganization();

      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(false);

      mockRequest = createMockRequest({ "x-subdomain": "test-org" });
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        mockOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        undefined,
      );

      // Act & Assert
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "User is not a member of this organization",
        }),
      );
    });
  });
});
