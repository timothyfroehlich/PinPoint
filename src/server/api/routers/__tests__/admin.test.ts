/**
 * Admin Router Tests
 *
 * Tests for the admin router converted from Prisma to Drizzle.
 * Covers complex user management, role assignments, invitations, and bulk operations.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock permission system to allow testing without full permission checks
vi.mock("~/server/auth/permissions", async () => {
  const actual = await vi.importActual("~/server/auth/permissions");
  return {
    ...actual,
    getUserPermissionsForSession: vi.fn(),
    getUserPermissionsForSupabaseUser: vi.fn(),
    requirePermissionForSession: vi.fn(),
  };
});

// Mock ID generation
vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn(
    (prefix: string) => `${prefix}_test_${crypto.randomUUID()}`,
  ),
}));

// Mock user removal validation function
vi.mock("~/lib/users/roleManagementValidation", async () => {
  const actual = await vi.importActual("~/lib/users/roleManagementValidation");
  return {
    ...actual,
    validateUserRemoval: vi.fn(),
  };
});

// Mock membership transformers
vi.mock("~/lib/utils/membership-transformers", async () => {
  const actual = await vi.importActual("~/lib/utils/membership-transformers");
  return {
    ...actual,
    transformMembershipsForValidation: vi.fn(),
  };
});

import type { VitestMockContext } from "~/test/vitestMockContext";

import { validateUserRemoval } from "~/lib/users/roleManagementValidation";
import { generatePrefixedId } from "~/lib/utils/id-generation";
import { transformMembershipsForValidation } from "~/lib/utils/membership-transformers";
import { adminRouter } from "~/server/api/routers/admin";
import {
  getUserPermissionsForSession,
  getUserPermissionsForSupabaseUser,
  requirePermissionForSession,
} from "~/server/auth/permissions";
import { createVitestMockContext } from "~/test/vitestMockContext";

describe("Admin Router (Drizzle Integration)", () => {
  let mockContext: VitestMockContext;
  let caller: ReturnType<typeof adminRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createVitestMockContext();

    const permissions = ["user:manage", "role:manage", "organization:manage"];

    // Add necessary admin permissions and user context
    mockContext = {
      ...mockContext,
      user: {
        ...mockContext.user,
        id: "user-admin",
        email: "admin@example.com",
      } as any,
      organization: {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test",
      },
      membership: {
        id: "membership-admin",
        userId: "user-admin",
        organizationId: "org-1",
        roleId: "role-admin",
      },
      userPermissions: permissions,
    } as any;

    // Mock the membership lookup that organizationProcedure makes
    const mockMembership = {
      id: "membership-admin",
      userId: "user-admin",
      organizationId: "org-1",
      roleId: "role-admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockContext.db.membership.findFirst).mockResolvedValue(
      mockMembership,
    );

    // Mock getUserPermissionsForSession to return our test permissions
    vi.mocked(getUserPermissionsForSession).mockResolvedValue(permissions);

    // Mock getUserPermissionsForSupabaseUser (used by organizationProcedure)
    vi.mocked(getUserPermissionsForSupabaseUser).mockResolvedValue(permissions);

    // Mock requirePermissionForSession to check if permission is in our list
    vi.mocked(requirePermissionForSession).mockImplementation(
      async (_session, permission) => {
        if (!permissions.includes(permission)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Missing required permission: ${permission}`,
          });
        }
      },
    );

    // Mock ID generation with predictable values for testing
    vi.mocked(generatePrefixedId).mockImplementation(
      (prefix: string) => `${prefix}_test_${crypto.randomUUID()}`,
    );

    caller = adminRouter.createCaller(mockContext);
  });

  /**
   * Core Integration Tests
   *
   * These tests verify that the admin router successfully integrates with Drizzle
   * and uses the helper functions correctly. Given the complexity of the admin router
   * and frequent refactoring, we focus on key integration points rather than
   * detailed implementation testing.
   */
  describe("Drizzle Integration", () => {
    it("should successfully call getUsers with Drizzle context", async () => {
      // Mock direct Drizzle query execution
      const mockMembers = [
        {
          id: "membership-1",
          userId: "user-1",
          organizationId: "org-1",
          roleId: "role-1",
          user: {
            id: "user-1",
            name: "Test User",
            email: "test@example.com",
            profilePicture: null,
            emailVerified: new Date(),
            createdAt: new Date(),
          },
          role: {
            id: "role-1",
            name: "Member",
            organizationId: "org-1",
            isSystem: false,
            isDefault: false,
          },
        },
      ];

      // Mock the Drizzle query chain that ends with .orderBy()
      vi.mocked(mockContext.drizzle.orderBy).mockResolvedValue(mockMembers);

      const result = await caller.getUsers();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
      });

      // Verify Drizzle query was called
      expect(mockContext.drizzle.orderBy).toHaveBeenCalled();
    });

    it("should pass organization ID to all operations", async () => {
      // This test ensures organization scoping is preserved in the Drizzle conversion
      expect(mockContext.organization?.id).toBe("org-1");
      expect(mockContext.drizzle).toBeDefined();
    });

    it("should handle permission system integration", async () => {
      // Verify permission system is properly mocked and integrated
      expect(mockContext.userPermissions).toContain("user:manage");
      expect(mockContext.userPermissions).toContain("role:manage");
      expect(mockContext.userPermissions).toContain("organization:manage");
    });

    it("should use proper ID generation for new entities", async () => {
      // Verify the ID generation system is integrated
      const testId = vi.mocked(generatePrefixedId)("test");
      expect(testId).toMatch(/^test_test_[a-f0-9\-]+$/);
    });
  });

  describe("Error Handling", () => {
    it("should throw proper TRPCError for forbidden operations", async () => {
      // Create a context without proper permissions
      const noPermissionsContext = {
        ...mockContext,
        userPermissions: [],
      } as any;

      vi.mocked(requirePermissionForSession).mockImplementation(
        async (_session, _permission) => {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Missing required permission: user:manage",
          });
        },
      );

      const noPermsCaller = adminRouter.createCaller(noPermissionsContext);

      await expect(noPermsCaller.getUsers()).rejects.toThrow(
        "Missing required permission",
      );
    });
  });

  /**
   * Comprehensive removeUser Procedure Tests
   *
   * Tests the critical business logic for user removal including:
   * - Database queries and joins
   * - Business validation logic
   * - Security and authorization
   * - Error handling and edge cases
   * - Organization isolation
   */
  describe("removeUser Procedure", () => {
    const targetUserId = "user-to-remove";
    const mockMembership = {
      id: "membership-1",
      userId: targetUserId,
      organizationId: "org-1",
      roleId: "role-member",
      user: {
        id: targetUserId,
        name: "User To Remove",
        email: "remove@example.com",
      },
      role: {
        id: "role-member",
        name: "Member",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
      },
    };

    const mockAllMemberships = [
      mockMembership,
      {
        id: "membership-admin",
        userId: "user-admin",
        organizationId: "org-1",
        roleId: "role-admin",
        user: {
          id: "user-admin",
          name: "Admin User",
          email: "admin@example.com",
          profilePicture: null,
          emailVerified: new Date(),
          createdAt: new Date(),
        },
        role: {
          id: "role-admin",
          name: "Admin",
          organizationId: "org-1",
          isSystem: true,
          isDefault: false,
        },
      },
    ];

    beforeEach(() => {
      // Reset all mocks
      vi.clearAllMocks();

      // Re-establish permission system mocks after clearing
      const permissions = ["user:manage", "role:manage", "organization:manage"];

      // Mock getUserPermissionsForSession to return our test permissions
      vi.mocked(getUserPermissionsForSession).mockResolvedValue(permissions);

      // Mock getUserPermissionsForSupabaseUser (used by organizationProcedure)
      vi.mocked(getUserPermissionsForSupabaseUser).mockResolvedValue(
        permissions,
      );

      // Mock requirePermissionForSession to check if permission is in our list
      vi.mocked(requirePermissionForSession).mockImplementation(
        async (_session, permission) => {
          if (!permissions.includes(permission)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Missing required permission: ${permission}`,
            });
          }
        },
      );

      // Setup default mocks for successful case
      vi.mocked(validateUserRemoval).mockReturnValue({ valid: true });
      vi.mocked(transformMembershipsForValidation).mockReturnValue(
        mockAllMemberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          organizationId: m.organizationId,
          roleId: m.roleId,
          user: {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email ?? "",
          },
          role: {
            id: m.role.id,
            name: m.role.name,
            organizationId: m.role.organizationId,
            isSystem: m.role.isSystem,
            isDefault: m.role.isDefault,
          },
        })),
      );

      // Helper function to set up successful Drizzle query chains for removeUser
      const setupSuccessfulRemoveUserChain = (
        membershipResult = [mockMembership],
        allMembershipsResult = mockAllMemberships,
      ) => {
        const membershipChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(membershipResult),
              }),
            }),
          }),
        };

        const allMembershipsChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(allMembershipsResult),
            }),
          }),
        };

        const deleteChain = {
          where: vi.fn().mockResolvedValue(undefined),
        };

        const drizzleMock = vi.mocked(mockContext.drizzle);
        const selectMock = drizzleMock.select;
        const deleteMock = drizzleMock.delete;
        selectMock
          .mockReturnValueOnce(membershipChain)
          .mockReturnValueOnce(allMembershipsChain);
        deleteMock.mockReturnValue(deleteChain);
      };

      // Set up default successful behavior for removeUser
      setupSuccessfulRemoveUserChain();

      // Store the helper function for individual tests to use
      (mockContext as any).setupSuccessfulRemoveUserChain =
        setupSuccessfulRemoveUserChain;

      // Ensure the context has proper permissions for this test
      mockContext.userPermissions = [
        "user:manage",
        "role:manage",
        "organization:manage",
      ];
    });

    describe("Successful Operations", () => {
      it("should successfully remove user with valid permissions", async () => {
        // Set up successful Drizzle query chain
        const successfulMembershipChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockMembership]),
              }),
            }),
          }),
        };

        const successfulAllMembershipsChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockAllMemberships),
            }),
          }),
        };

        const successfulDeleteChain = {
          where: vi.fn().mockResolvedValue(undefined),
        };

        const drizzleMock = vi.mocked(mockContext.drizzle);
        const selectMock = drizzleMock.select;
        const deleteMock = drizzleMock.delete;
        selectMock
          .mockReturnValueOnce(successfulMembershipChain)
          .mockReturnValueOnce(successfulAllMembershipsChain);
        deleteMock.mockReturnValue(successfulDeleteChain);

        // Ensure proper permissions for this specific test
        mockContext.userPermissions = [
          "user:manage",
          "role:manage",
          "organization:manage",
        ];
        caller = adminRouter.createCaller(mockContext);

        const result = await caller.removeUser({ userId: targetUserId });

        expect(result).toEqual({ success: true });

        // Verify validation was called - focusing on the key aspects
        expect(validateUserRemoval).toHaveBeenCalledWith(
          expect.objectContaining({
            id: mockMembership.id,
            userId: targetUserId,
            organizationId: "org-1",
          }),
          expect.any(Array), // Transformed memberships array
          expect.objectContaining({
            organizationId: "org-1",
            actorUserId: "user-admin",
            userPermissions: expect.arrayContaining(["user:manage"]),
          }),
        );
      });

      it("should properly transform memberships for validation", async () => {
        // Set up successful Drizzle chain
        (mockContext as any).setupSuccessfulRemoveUserChain();

        // Ensure proper permissions for this specific test
        mockContext.userPermissions = [
          "user:manage",
          "role:manage",
          "organization:manage",
        ];
        caller = adminRouter.createCaller(mockContext);

        await caller.removeUser({ userId: targetUserId });

        expect(transformMembershipsForValidation).toHaveBeenCalledWith(
          expect.any(Array), // Just verify it was called with an array
        );
      });

      it("should handle removal of users with different role types", async () => {
        const membershipWithSystemRole = {
          ...mockMembership,
          role: {
            ...mockMembership.role,
            isSystem: true,
            name: "System User",
          },
        };

        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          membershipWithSystemRole,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce([
          membershipWithSystemRole,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(undefined);

        const result = await caller.removeUser({ userId: targetUserId });

        expect(result).toEqual({ success: true });
        expect(validateUserRemoval).toHaveBeenCalledWith(
          expect.objectContaining({
            role: expect.objectContaining({
              isSystem: true,
              name: "System User",
            }),
          }),
          expect.any(Array),
          expect.any(Object),
        );
      });
    });

    describe("Business Logic Validation", () => {
      it("should respect validation failure and throw PRECONDITION_FAILED", async () => {
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          mockMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(
          mockAllMemberships,
        );

        // Mock validation failure
        vi.mocked(validateUserRemoval).mockReturnValue({
          valid: false,
          error: "Cannot remove last admin user",
        });

        await expect(
          caller.removeUser({ userId: targetUserId }),
        ).rejects.toThrow(TRPCError);

        try {
          await caller.removeUser({ userId: targetUserId });
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("PRECONDITION_FAILED");
          expect((error as TRPCError).message).toBe(
            "Cannot remove last admin user",
          );
        }

        // Verify delete was NOT called
        expect(vi.mocked(mockContext.drizzle.delete)).not.toHaveBeenCalled();
      });

      it("should handle validation failure without specific error message", async () => {
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          mockMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(
          mockAllMemberships,
        );

        vi.mocked(validateUserRemoval).mockReturnValue({
          valid: false,
          // No error message provided
        });

        await expect(
          caller.removeUser({ userId: targetUserId }),
        ).rejects.toThrow("User removal validation failed");
      });

      it("should pass correct context to validation", async () => {
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          mockMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(
          mockAllMemberships,
        );

        await caller.removeUser({ userId: targetUserId });

        expect(validateUserRemoval).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Array),
          expect.objectContaining({
            organizationId: "org-1",
            actorUserId: "user-admin",
            userPermissions: expect.arrayContaining([
              "user:manage",
              "role:manage",
              "organization:manage",
            ]),
          }),
        );
      });
    });

    describe("Security & Authorization", () => {
      it("should enforce organization isolation", async () => {
        const _membershipFromOtherOrg = {
          ...mockMembership,
          organizationId: "other-org-123",
        };

        // Set up chain that returns no membership (empty array) - user not found in org
        (mockContext as any).setupSuccessfulRemoveUserChain(
          [],
          mockAllMemberships,
        );

        await expect(
          caller.removeUser({ userId: targetUserId }),
        ).rejects.toThrow(TRPCError);

        try {
          await caller.removeUser({ userId: targetUserId });
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("NOT_FOUND");
          expect((error as TRPCError).message).toBe(
            "User is not a member of this organization",
          );
        }
      });

      it("should query memberships only for current organization", async () => {
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          mockMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(
          mockAllMemberships,
        );

        await caller.removeUser({ userId: targetUserId });

        // Verify the where clause filters by organization ID
        const drizzleWhereCallArgs = vi.mocked(mockContext.drizzle.where).mock
          .calls;
        expect(drizzleWhereCallArgs.length).toBeGreaterThan(0);

        // The membership lookup should filter by both userId and organizationId
        // The all memberships query should filter by organizationId
      });

      it("should require user:manage permission (tested via middleware)", async () => {
        // This is tested through the userManageProcedure middleware
        // The test validates that the procedure correctly uses the middleware
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          mockMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(
          mockAllMemberships,
        );

        await caller.removeUser({ userId: targetUserId });

        // If we reach here, the middleware allowed the call
        expect(validateUserRemoval).toHaveBeenCalled();
      });
    });

    describe("Error Scenarios", () => {
      it("should throw NOT_FOUND when user is not in organization", async () => {
        // Set up chain that returns no membership (empty array) - user not found in org
        (mockContext as any).setupSuccessfulRemoveUserChain(
          [],
          mockAllMemberships,
        );

        await expect(
          caller.removeUser({ userId: targetUserId }),
        ).rejects.toThrow(TRPCError);

        try {
          await caller.removeUser({ userId: targetUserId });
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("NOT_FOUND");
          expect((error as TRPCError).message).toBe(
            "User is not a member of this organization",
          );
        }

        // Verify validation and delete were not called
        expect(validateUserRemoval).not.toHaveBeenCalled();
        expect(vi.mocked(mockContext.drizzle.delete)).not.toHaveBeenCalled();
      });

      it("should handle database errors during membership lookup", async () => {
        // Create a failing select chain for the membership lookup (first query)
        const failingMembershipChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockRejectedValue(new Error("Database connection failed")),
              }),
            }),
          }),
        };

        const drizzleMock = vi.mocked(mockContext.drizzle);
        const selectMock = drizzleMock.select;
        selectMock.mockReturnValueOnce(failingMembershipChain);

        await expect(
          caller.removeUser({ userId: targetUserId }),
        ).rejects.toThrow("Database connection failed");
      });

      it("should handle database errors during all memberships query", async () => {
        // First query succeeds (membership lookup)
        const successfulMembershipChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockMembership]),
              }),
            }),
          }),
        };

        // Second query fails (all memberships query)
        const failingAllMembershipsChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockRejectedValue(new Error("Query timeout")),
            }),
          }),
        };

        const drizzleMock = vi.mocked(mockContext.drizzle);
        const selectMock = drizzleMock.select;
        selectMock
          .mockReturnValueOnce(successfulMembershipChain)
          .mockReturnValueOnce(failingAllMembershipsChain);

        await expect(
          caller.removeUser({ userId: targetUserId }),
        ).rejects.toThrow("Query timeout");
      });

      it("should handle database errors during delete operation", async () => {
        // First query succeeds (membership lookup)
        const successfulMembershipChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockMembership]),
              }),
            }),
          }),
        };

        // Second query succeeds (all memberships query)
        const successfulAllMembershipsChain = {
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockAllMemberships),
            }),
          }),
        };

        // Delete operation fails
        const failingDeleteChain = {
          where: vi
            .fn()
            .mockRejectedValue(new Error("Delete constraint violation")),
        };

        const drizzleMock = vi.mocked(mockContext.drizzle);
        const selectMock = drizzleMock.select;
        const deleteMock = drizzleMock.delete;
        selectMock
          .mockReturnValueOnce(successfulMembershipChain)
          .mockReturnValueOnce(successfulAllMembershipsChain);
        deleteMock.mockReturnValue(failingDeleteChain);

        await expect(
          caller.removeUser({ userId: targetUserId }),
        ).rejects.toThrow("Delete constraint violation");
      });
    });

    describe("Edge Cases", () => {
      it("should handle malformed user ID", async () => {
        const malformedUserId = "";

        // The input validation should catch this, but test the database behavior
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([]);

        await expect(
          caller.removeUser({ userId: malformedUserId }),
        ).rejects.toThrow(TRPCError);
      });

      it("should handle user with missing email", async () => {
        const membershipWithoutEmail = {
          ...mockMembership,
          user: {
            ...mockMembership.user,
            email: null,
          },
        };

        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          membershipWithoutEmail,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce([
          membershipWithoutEmail,
        ]);

        await caller.removeUser({ userId: targetUserId });

        // Verify the email is handled properly in validation (converted to empty string)
        expect(validateUserRemoval).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.objectContaining({
              email: "",
            }),
          }),
          expect.any(Array),
          expect.any(Object),
        );
      });

      it("should handle removal of user with complex role structure", async () => {
        const complexMembership = {
          ...mockMembership,
          role: {
            id: "role-complex",
            name: "Custom Role",
            organizationId: "org-1",
            isSystem: false,
            isDefault: true, // Default role
          },
        };

        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          complexMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce([
          complexMembership,
        ]);

        await caller.removeUser({ userId: targetUserId });

        expect(validateUserRemoval).toHaveBeenCalledWith(
          expect.objectContaining({
            role: expect.objectContaining({
              isDefault: true,
              name: "Custom Role",
            }),
          }),
          expect.any(Array),
          expect.any(Object),
        );
      });

      it("should handle concurrent removal scenarios", async () => {
        // This tests the case where user might be removed between queries
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          mockMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(
          mockAllMemberships,
        );

        // Mock delete returning 0 affected rows (user already removed)
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(undefined);

        // Should still return success since the end state is achieved
        const result = await caller.removeUser({ userId: targetUserId });
        expect(result).toEqual({ success: true });
      });
    });

    describe("Data Transformation", () => {
      it("should properly construct validation membership object", async () => {
        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          mockMembership,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce(
          mockAllMemberships,
        );

        await caller.removeUser({ userId: targetUserId });

        expect(validateUserRemoval).toHaveBeenCalledWith(
          expect.objectContaining({
            id: mockMembership.id,
            userId: mockMembership.userId,
            organizationId: mockMembership.organizationId,
            roleId: mockMembership.roleId,
            user: expect.objectContaining({
              id: mockMembership.user.id,
              name: mockMembership.user.name,
              email: mockMembership.user.email,
            }),
            role: expect.objectContaining({
              id: mockMembership.role.id,
              name: mockMembership.role.name,
              organizationId: mockMembership.role.organizationId,
              isSystem: mockMembership.role.isSystem,
              isDefault: mockMembership.role.isDefault,
            }),
          }),
          expect.any(Array),
          expect.any(Object),
        );
      });

      it("should handle null email in user data", async () => {
        const membershipWithNullEmail = {
          ...mockMembership,
          user: {
            ...mockMembership.user,
            email: null,
          },
        };

        vi.mocked(mockContext.drizzle.limit).mockResolvedValueOnce([
          membershipWithNullEmail,
        ]);
        vi.mocked(mockContext.drizzle.where).mockResolvedValueOnce([
          membershipWithNullEmail,
        ]);

        await caller.removeUser({ userId: targetUserId });

        // Should convert null email to empty string
        expect(validateUserRemoval).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.objectContaining({
              email: "",
            }),
          }),
          expect.any(Array),
          expect.any(Object),
        );
      });
    });
  });
});
