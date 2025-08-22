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

import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

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

// ENHANCED: Test data factories with organizational scoping
function createMockSupabaseUser(
  overrides: Partial<PinPointSupabaseUser> = {},
  organizationId: string = SEED_TEST_IDS.ORGANIZATIONS.primary,
): PinPointSupabaseUser {
  return {
    id: overrides.id || SEED_TEST_IDS.USERS.ADMIN,
    aud: "authenticated",
    role: "authenticated",
    email: `test-${organizationId}@example.com`,
    email_confirmed_at: "2023-01-01T00:00:00Z",
    phone: "",
    last_sign_in_at: "2023-01-01T00:00:00Z",
    app_metadata: {
      provider: "google",
      organization_id: organizationId,
      role: "member",
    },
    user_metadata: {
      name: "Test User",
      email: `test-${organizationId}@example.com`,
    },
    identities: [],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    is_anonymous: false,
    ...overrides,
  };
}

// Helper for creating competitor org users
function createCompetitorOrgUser(
  overrides: Partial<PinPointSupabaseUser> = {},
): PinPointSupabaseUser {
  return createMockSupabaseUser(
    {
      id: "test-competitor-user",
      ...overrides,
    },
    SEED_TEST_IDS.ORGANIZATIONS.competitor,
  );
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

function createMockOrganization(
  organizationId: string = SEED_TEST_IDS.ORGANIZATIONS.primary,
) {
  return {
    id: organizationId,
    name:
      organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary
        ? "Primary Organization"
        : "Competitor Organization",
    subdomain:
      organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary
        ? "primary-org"
        : "competitor-org",
  };
}

// Helper for creating competitor org
function createCompetitorOrganization() {
  return createMockOrganization(SEED_TEST_IDS.ORGANIZATIONS.competitor);
}

function createMockMembership(
  userId: string = SEED_TEST_IDS.USERS.ADMIN,
  organizationId: string = SEED_TEST_IDS.ORGANIZATIONS.primary,
  permissions: string[] = ["upload:create", "file:manage"],
) {
  return {
    id: `membership-${userId}-${organizationId}`,
    userId,
    organizationId,
    roleId: `${organizationId}-admin-role`,
    role: {
      id: `${organizationId}-admin-role`,
      name: "admin",
      rolePermissions: permissions.map((permName) => ({
        permission: { name: permName },
      })),
    },
  };
}

// Helper for creating competitor org membership
function createCompetitorMembership(permissions: string[] = ["upload:create"]) {
  return createMockMembership(
    "test-competitor-user",
    SEED_TEST_IDS.ORGANIZATIONS.competitor,
    permissions,
  );
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
      mockRequest = createMockRequest({ "x-subdomain": "primary-org" });

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

      mockRequest = createMockRequest({ "x-subdomain": "primary-org" });
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

      mockRequest = createMockRequest({ "x-subdomain": "primary-org" });
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

      mockRequest = createMockRequest({ "x-subdomain": "primary-org" });
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        undefined,
      );

      // Act & Assert
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: 'Organization with subdomain "primary-org" not found',
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

      mockRequest = createMockRequest({ "x-subdomain": "primary-org" });
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

  // === CRITICAL CROSS-TENANT SECURITY TESTS ===
  describe("CRITICAL - Cross-Tenant Upload Security", () => {
    it("CRITICAL - Should prevent cross-organizational upload access via subdomain manipulation", async () => {
      // Arrange: Primary org user tries to access competitor org uploads via subdomain header
      const primaryOrgUser = createMockSupabaseUser(
        {},
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      const competitorOrg = createCompetitorOrganization();

      mockGetSupabaseUser.mockResolvedValue(primaryOrgUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(false); // Not a member of competitor org

      // Malicious subdomain header pointing to competitor org
      mockRequest = createMockRequest({ "x-subdomain": "competitor-org" });

      // Set up database mocks
      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        competitorOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        null,
      ); // No membership

      // Act & Assert
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "User is not a member of this organization",
        }),
      );

      // Verify queries were made but access was denied
      expect(mockDrizzle.query.organizations.findFirst).toHaveBeenCalled();
      expect(mockDrizzle.query.memberships.findFirst).toHaveBeenCalled();
    });

    it("CRITICAL - Should validate user organization matches subdomain organization", async () => {
      // Arrange: User claims to be from primary org but subdomain points to competitor
      const primaryOrgUser = createMockSupabaseUser(
        {},
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      const competitorOrg = createCompetitorOrganization();

      mockGetSupabaseUser.mockResolvedValue(primaryOrgUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(false);

      // User's org_metadata says primary, but subdomain says competitor
      mockRequest = createMockRequest({ "x-subdomain": "competitor-org" });

      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        competitorOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        null,
      );

      // Act & Assert: Should fail because user's org context doesn't match subdomain org
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "User is not a member of this organization",
        }),
      );
    });

    it("CRITICAL - Should prevent cross-tenant upload permission escalation", async () => {
      // Arrange: Setup two separate organizational contexts
      const primaryOrgUser = createMockSupabaseUser(
        {},
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      const primaryOrg = createMockOrganization(
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      const primaryMembership = createMockMembership(
        SEED_TEST_IDS.USERS.ADMIN,
        SEED_TEST_IDS.ORGANIZATIONS.primary,
        ["upload:create", "admin:full"], // High permissions in primary org
      );

      // Test 1: Primary org user accessing their own org (should succeed)
      mockGetSupabaseUser.mockResolvedValue(primaryOrgUser);
      mockIsValidOrganization.mockReturnValue(true);
      mockIsValidMembership.mockReturnValue(true);
      mockRequest = createMockRequest({ "x-subdomain": "primary-org" });

      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        primaryOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        primaryMembership,
      );

      const primaryOrgContext = await getUploadAuthContext(
        mockRequest,
        mockDrizzle,
      );

      // Should have permissions in own org
      expect(() => {
        requireUploadPermission(primaryOrgContext, "upload:create");
      }).not.toThrow();

      expect(() => {
        requireUploadPermission(primaryOrgContext, "admin:full");
      }).not.toThrow();

      // Test 2: Same user context but accessing competitor org uploads (should fail)
      const competitorOrg = createCompetitorOrganization();
      mockRequest = createMockRequest({ "x-subdomain": "competitor-org" });

      vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
        competitorOrg,
      );
      vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
        null,
      ); // No membership in competitor org
      mockIsValidMembership.mockReturnValue(false);

      // Should be denied access to competitor org
      await expect(
        getUploadAuthContext(mockRequest, mockDrizzle),
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "User is not a member of this organization",
        }),
      );
    });

    it("CRITICAL - Should isolate upload permissions across organizations", async () => {
      // Arrange: Create auth contexts for both organizations
      const primaryOrgContext = {
        user: createMockSupabaseUser({}, SEED_TEST_IDS.ORGANIZATIONS.primary),
        organization: createMockOrganization(
          SEED_TEST_IDS.ORGANIZATIONS.primary,
        ),
        membership: createMockMembership(
          SEED_TEST_IDS.USERS.ADMIN,
          SEED_TEST_IDS.ORGANIZATIONS.primary,
          ["upload:create", "upload:delete", "admin:manage"],
        ),
        userPermissions: ["upload:create", "upload:delete", "admin:manage"],
      };

      const competitorOrgContext = {
        user: createCompetitorOrgUser(),
        organization: createCompetitorOrganization(),
        membership: createCompetitorMembership(["upload:create"]), // Limited permissions
        userPermissions: ["upload:create"],
      };

      // Test: Primary org user has admin permissions in their org
      expect(() => {
        requireUploadPermission(primaryOrgContext, "upload:create");
      }).not.toThrow();

      expect(() => {
        requireUploadPermission(primaryOrgContext, "upload:delete");
      }).not.toThrow();

      expect(() => {
        requireUploadPermission(primaryOrgContext, "admin:manage");
      }).not.toThrow();

      // Test: Competitor org user has limited permissions in their org
      expect(() => {
        requireUploadPermission(competitorOrgContext, "upload:create");
      }).not.toThrow();

      expect(() => {
        requireUploadPermission(competitorOrgContext, "upload:delete");
      }).toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Permission required: upload:delete",
        }),
      );

      expect(() => {
        requireUploadPermission(competitorOrgContext, "admin:manage");
      }).toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Permission required: admin:manage",
        }),
      );
    });

    it("CRITICAL - Should prevent subdomain spoofing attacks", async () => {
      // Arrange: Attempt various subdomain spoofing techniques
      const spoofingAttempts = [
        {
          subdomain: "primary-org.competitor-org",
          description: "DNS-style spoofing",
        },
        {
          subdomain: "primary-org/../competitor-org",
          description: "Path traversal attempt",
        },
        { subdomain: "PRIMARY-ORG", description: "Case manipulation" },
        {
          subdomain: "primary-org; DROP TABLE uploads; --",
          description: "SQL injection attempt",
        },
        { subdomain: "", description: "Empty subdomain" },
        { subdomain: "null", description: "Null string spoofing" },
      ];

      const primaryOrgUser = createMockSupabaseUser(
        {},
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      mockGetSupabaseUser.mockResolvedValue(primaryOrgUser);

      for (const attempt of spoofingAttempts) {
        // Reset mocks
        vi.clearAllMocks();
        mockGetSupabaseUser.mockResolvedValue(primaryOrgUser);
        mockIsValidOrganization.mockReturnValue(false); // Spoofed subdomains won't match valid orgs

        mockRequest = createMockRequest({ "x-subdomain": attempt.subdomain });
        vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
          null,
        );

        // Act & Assert: All spoofing attempts should be denied
        await expect(
          getUploadAuthContext(mockRequest, mockDrizzle),
        ).rejects.toThrow(TRPCError);

        // Additional check for the specific error message pattern
        try {
          await getUploadAuthContext(mockRequest, mockDrizzle);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("NOT_FOUND");
          expect((error as TRPCError).message).toContain("not found");
        }
      }
    });

    it("CRITICAL - Should handle concurrent cross-tenant access attempts", async () => {
      // Arrange: Simulate concurrent access attempts from different orgs
      const primaryOrgUser = createMockSupabaseUser(
        {},
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      const competitorOrgUser = createCompetitorOrgUser();

      const primaryOrg = createMockOrganization(
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      const competitorOrg = createCompetitorOrganization();

      const primaryMembership = createMockMembership(
        SEED_TEST_IDS.USERS.ADMIN,
        SEED_TEST_IDS.ORGANIZATIONS.primary,
      );
      const competitorMembership = createCompetitorMembership();

      // Test concurrent access patterns
      const concurrentTests = [
        {
          user: primaryOrgUser,
          subdomain: "primary-org",
          org: primaryOrg,
          membership: primaryMembership,
          shouldSucceed: true,
          description: "Primary org user accessing own org",
        },
        {
          user: competitorOrgUser,
          subdomain: "competitor-org",
          org: competitorOrg,
          membership: competitorMembership,
          shouldSucceed: true,
          description: "Competitor org user accessing own org",
        },
        {
          user: primaryOrgUser,
          subdomain: "competitor-org",
          org: competitorOrg,
          membership: null, // No cross-org membership
          shouldSucceed: false,
          description: "Primary org user attempting competitor org access",
        },
        {
          user: competitorOrgUser,
          subdomain: "primary-org",
          org: primaryOrg,
          membership: null, // No cross-org membership
          shouldSucceed: false,
          description: "Competitor org user attempting primary org access",
        },
      ];

      for (const testCase of concurrentTests) {
        // Setup mocks for this test case
        vi.clearAllMocks();
        mockGetSupabaseUser.mockResolvedValue(testCase.user);
        mockIsValidOrganization.mockReturnValue(true);
        mockIsValidMembership.mockReturnValue(testCase.shouldSucceed);

        mockRequest = createMockRequest({ "x-subdomain": testCase.subdomain });
        vi.mocked(mockDrizzle.query.organizations.findFirst).mockResolvedValue(
          testCase.org,
        );
        vi.mocked(mockDrizzle.query.memberships.findFirst).mockResolvedValue(
          testCase.membership,
        );

        if (testCase.shouldSucceed) {
          // Should succeed
          const result = await getUploadAuthContext(mockRequest, mockDrizzle);
          expect(result.organization.id).toBe(testCase.org.id);
          expect(result.user.id).toBe(testCase.user.id);
        } else {
          // Should fail with FORBIDDEN
          await expect(
            getUploadAuthContext(mockRequest, mockDrizzle),
          ).rejects.toThrow(
            new TRPCError({
              code: "FORBIDDEN",
              message: "User is not a member of this organization",
            }),
          );
        }
      }
    });
  });

  // === UPLOAD PERMISSION MATRIX SECURITY ===
  describe("Upload Permission Matrix Security", () => {
    it("should validate upload permission matrix across organizational boundaries", () => {
      // Test comprehensive upload permission scenarios
      const permissionMatrix = [
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.primary,
          permissions: ["upload:create", "upload:delete", "admin:full"],
          testPermission: "upload:create",
          shouldSucceed: true,
          description: "Primary org admin with upload create",
        },
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.primary,
          permissions: ["upload:create"],
          testPermission: "upload:delete",
          shouldSucceed: false,
          description: "Primary org user without delete permission",
        },
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          permissions: ["upload:create"],
          testPermission: "upload:create",
          shouldSucceed: true,
          description: "Competitor org user with upload create",
        },
        {
          org: SEED_TEST_IDS.ORGANIZATIONS.competitor,
          permissions: ["upload:create"],
          testPermission: "cross_org:access",
          shouldSucceed: false,
          description: "Competitor org user attempting cross-org access",
        },
      ];

      for (const testCase of permissionMatrix) {
        // Create context for this test case
        const authContext = {
          user: createMockSupabaseUser({}, testCase.org),
          organization: createMockOrganization(testCase.org),
          membership: createMockMembership(
            SEED_TEST_IDS.USERS.ADMIN,
            testCase.org,
            testCase.permissions,
          ),
          userPermissions: testCase.permissions,
        };

        if (testCase.shouldSucceed) {
          expect(() => {
            requireUploadPermission(authContext, testCase.testPermission);
          }).not.toThrow();
        } else {
          expect(() => {
            requireUploadPermission(authContext, testCase.testPermission);
          }).toThrow(
            new TRPCError({
              code: "FORBIDDEN",
              message: `Permission required: ${testCase.testPermission}`,
            }),
          );
        }
      }
    });
  });
});
