import { TRPCError } from "@trpc/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  createVitestMockContext,
  type VitestMockContext,
} from "../../../test/vitestMockContext";
import {
  hasPermission,
  requirePermission,
  getUserPermissions,
} from "../permissions";

describe("Permission System Core Functions", () => {
  let mockContext: VitestMockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createVitestMockContext();
  });

  describe("hasPermission", () => {
    it("should return true when user has the required permission", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const permission = "issue:create";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            id: "perm-1",
            name: "issue:create",
            description: "Create issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      // Act
      const result = await hasPermission(
        membership,
        permission,
        mockContext.db,
      );

      // Assert
      expect(result).toBe(true);
      expect(mockContext.db.role.findUnique).toHaveBeenCalledWith({
        where: { id: "role-1" },
        select: { name: true, permissions: { select: { name: true } } },
      });
    });

    it("should return false when user does not have the required permission", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const permission = "issue:delete";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [], // No permissions
      });

      // Act
      const result = await hasPermission(
        membership,
        permission,
        mockContext.db,
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should return false when role does not exist", async () => {
      // Arrange
      const membership = { roleId: "non-existent-role" };
      const permission = "issue:create";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue(null);

      // Act
      const result = await hasPermission(
        membership,
        permission,
        mockContext.db,
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should handle system roles with admin permissions", async () => {
      // Arrange
      const membership = { roleId: "system-admin-role" };
      const permission = "organization:manage";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "system-admin-role",
        name: "System Admin",
        organizationId: "org-1",
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            id: "perm-org-manage",
            name: "organization:manage",
            description: "Manage organization",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      // Act
      const result = await hasPermission(
        membership,
        permission,
        mockContext.db,
      );

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("requirePermission", () => {
    it("should not throw when user has required permission", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const permission = "issue:edit";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            id: "perm-1",
            name: "issue:edit",
            description: "Edit issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      // Act & Assert
      await expect(
        requirePermission(membership, permission, mockContext.db),
      ).resolves.not.toThrow();
    });

    it("should throw FORBIDDEN error when user lacks required permission", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const permission = "issue:delete";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [], // No permissions
      });

      // Act & Assert
      await expect(
        requirePermission(membership, permission, mockContext.db),
      ).rejects.toThrow(TRPCError);
      await expect(
        requirePermission(membership, permission, mockContext.db),
      ).rejects.toThrow("Permission required: issue:delete");
    });

    it("should throw FORBIDDEN error with correct error code", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const permission = "user:manage";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      });

      // Act & Assert
      try {
        await requirePermission(membership, permission, mockContext.db);
        expect.fail("Should have thrown TRPCError");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe(
          "Permission required: user:manage",
        );
      }
    });
  });

  describe("getUserPermissions", () => {
    it("should return all permissions for a user's role", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const expectedPermissions = ["issue:create", "issue:edit", "issue:view"];

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            id: "perm-1",
            name: "issue:create",
            description: "Create issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "perm-2",
            name: "issue:edit",
            description: "Edit issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "perm-3",
            name: "issue:view",
            description: "View issues",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      // Act
      const result = await getUserPermissions(membership, mockContext.db);

      // Assert
      expect(result).toEqual(expectedPermissions);
      expect(mockContext.db.role.findUnique).toHaveBeenCalledWith({
        where: { id: "role-1" },
        select: { name: true, permissions: { select: { name: true } } },
      });
    });

    it("should return empty array when role has no permissions", async () => {
      // Arrange
      const membership = { roleId: "role-1" };

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      });

      // Act
      const result = await getUserPermissions(membership, mockContext.db);

      // Assert
      expect(result).toEqual([]);
    });

    it("should return empty array when role does not exist", async () => {
      // Arrange
      const membership = { roleId: "non-existent-role" };

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue(null);

      // Act
      const result = await getUserPermissions(membership, mockContext.db);

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle admin role with multiple permissions", async () => {
      // Arrange
      const membership = { roleId: "admin-role" };
      const adminPermissions = [
        "issue:create",
        "issue:edit",
        "issue:delete",
        "issue:assign",
        "machine:edit",
        "machine:delete",
        "location:edit",
        "location:delete",
        "organization:manage",
        "role:manage",
        "user:manage",
      ];

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "admin-role",
        name: "Admin",
        organizationId: "org-1",
        isSystem: true,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: adminPermissions.map((name, index) => ({
          id: `perm-${(index + 1).toString()}`,
          name,
          description: `${name} permission`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      });

      // Mock the permission.findMany call for admin users
      vi.mocked(mockContext.db.permission.findMany).mockResolvedValue(
        adminPermissions.map((name, index) => ({
          id: `perm-${(index + 1).toString()}`,
          name,
          description: `${name} permission`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );

      // Act
      const result = await getUserPermissions(membership, mockContext.db);

      // Assert
      expect(result).toEqual(adminPermissions);
      expect(result).toHaveLength(11);
    });
  });

  describe("Permission System Edge Cases", () => {
    it("should handle null/undefined membership gracefully", async () => {
      // Arrange
      const membership = { roleId: "" };
      const permission = "issue:create";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue(null);

      // Act
      const result = await hasPermission(
        membership,
        permission,
        mockContext.db,
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should handle empty permission string", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const permission = "";

      vi.mocked(mockContext.db.role.findUnique).mockResolvedValue({
        id: "role-1",
        name: "Test Role",
        organizationId: "org-1",
        isSystem: false,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      });

      // Act
      const result = await hasPermission(
        membership,
        permission,
        mockContext.db,
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const membership = { roleId: "role-1" };
      const permission = "issue:create";

      vi.mocked(mockContext.db.role.findUnique).mockRejectedValue(
        new Error("Database connection error"),
      );

      // Act & Assert
      await expect(
        hasPermission(membership, permission, mockContext.db),
      ).rejects.toThrow("Database connection error");
    });
  });
});
