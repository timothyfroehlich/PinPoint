/**
 * Permission Checking Integration Tests
 * Tests for permission-based access control in Server Components
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasPermission, getUserPermissions } from "../permissions";
import { PERMISSIONS } from "../permissions.constants";
import { db } from "~/server/db/drizzle";

// Mock the database
vi.mock("~/server/db/drizzle", () => ({
  db: {
    query: {
      roles: {
        findFirst: vi.fn(),
      },
      permissions: {
        findMany: vi.fn(),
      },
    },
  },
}));

describe("Permission Checking for Server Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasPermission", () => {
    it("should return true for Admin role checking USER_MANAGE permission", async () => {
      // Mock Admin role
      vi.mocked(db.query.roles.findFirst).mockResolvedValue({
        id: "role-admin",
        name: "Admin",
        rolePermissions: [],
      });

      const membership = { roleId: "role-admin" };
      const result = await hasPermission(
        membership,
        PERMISSIONS.USER_MANAGE,
        db,
      );

      expect(result).toBe(true);
    });

    it("should return false for Member role without USER_MANAGE permission", async () => {
      // Mock Member role without USER_MANAGE
      vi.mocked(db.query.roles.findFirst).mockResolvedValue({
        id: "role-member",
        name: "Member",
        rolePermissions: [
          { permission: { name: PERMISSIONS.ISSUE_VIEW } },
          { permission: { name: PERMISSIONS.ISSUE_CREATE_FULL } },
        ],
      });

      const membership = { roleId: "role-member" };
      const result = await hasPermission(
        membership,
        PERMISSIONS.USER_MANAGE,
        db,
      );

      expect(result).toBe(false);
    });

    it("should return true for custom role with USER_MANAGE permission", async () => {
      // Mock custom role with USER_MANAGE
      vi.mocked(db.query.roles.findFirst).mockResolvedValue({
        id: "role-custom",
        name: "Custom Manager",
        rolePermissions: [
          { permission: { name: PERMISSIONS.USER_MANAGE } },
          { permission: { name: PERMISSIONS.ISSUE_VIEW } },
        ],
      });

      const membership = { roleId: "role-custom" };
      const result = await hasPermission(
        membership,
        PERMISSIONS.USER_MANAGE,
        db,
      );

      expect(result).toBe(true);
    });

    it("should return false for null roleId", async () => {
      const membership = { roleId: null };
      const result = await hasPermission(
        membership,
        PERMISSIONS.USER_MANAGE,
        db,
      );

      expect(result).toBe(false);
      expect(db.query.roles.findFirst).not.toHaveBeenCalled();
    });

    it("should return false when role not found", async () => {
      vi.mocked(db.query.roles.findFirst).mockResolvedValue(null);

      const membership = { roleId: "non-existent-role" };
      const result = await hasPermission(
        membership,
        PERMISSIONS.USER_MANAGE,
        db,
      );

      expect(result).toBe(false);
    });
  });

  describe("getUserPermissions", () => {
    it("should return all permissions for Admin role", async () => {
      // Mock Admin role
      vi.mocked(db.query.roles.findFirst).mockResolvedValue({
        id: "role-admin",
        name: "Admin",
        rolePermissions: [],
      });

      // Mock all available permissions
      vi.mocked(db.query.permissions.findMany).mockResolvedValue([
        { name: PERMISSIONS.USER_MANAGE },
        { name: PERMISSIONS.ORGANIZATION_MANAGE },
        { name: PERMISSIONS.ISSUE_VIEW },
        { name: PERMISSIONS.ISSUE_CREATE_FULL },
      ]);

      const membership = { roleId: "role-admin" };
      const result = await getUserPermissions(membership, db);

      expect(result).toContain(PERMISSIONS.USER_MANAGE);
      expect(result).toContain(PERMISSIONS.ORGANIZATION_MANAGE);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return role permissions with dependencies for non-Admin role", async () => {
      // Mock Member role with basic permissions
      vi.mocked(db.query.roles.findFirst).mockResolvedValue({
        id: "role-member",
        name: "Member",
        rolePermissions: [
          { permission: { name: PERMISSIONS.ISSUE_CREATE_FULL } },
        ],
      });

      const membership = { roleId: "role-member" };
      const result = await getUserPermissions(membership, db);

      // ISSUE_CREATE_FULL should include its dependencies
      expect(result).toContain(PERMISSIONS.ISSUE_CREATE_FULL);
      expect(result).toContain(PERMISSIONS.ISSUE_VIEW); // dependency
      expect(result).toContain(PERMISSIONS.ISSUE_CREATE_BASIC); // dependency
      expect(result).not.toContain(PERMISSIONS.USER_MANAGE);
    });

    it("should return empty array for null roleId", async () => {
      const membership = { roleId: null };
      const result = await getUserPermissions(membership, db);

      expect(result).toEqual([]);
      expect(db.query.roles.findFirst).not.toHaveBeenCalled();
    });

    it("should return empty array when role not found", async () => {
      vi.mocked(db.query.roles.findFirst).mockResolvedValue(null);

      const membership = { roleId: "non-existent-role" };
      const result = await getUserPermissions(membership, db);

      expect(result).toEqual([]);
    });
  });

  describe("Permission checking for specific scenarios", () => {
    it("should correctly determine user management permission for Admin", async () => {
      vi.mocked(db.query.roles.findFirst).mockResolvedValue({
        id: "role-admin",
        name: "Admin",
        rolePermissions: [],
      });

      const membership = { roleId: "role-admin" };
      const canManageUsers = await hasPermission(
        membership,
        PERMISSIONS.USER_MANAGE,
        db,
      );
      const canManageOrg = await hasPermission(
        membership,
        PERMISSIONS.ORGANIZATION_MANAGE,
        db,
      );

      expect(canManageUsers).toBe(true);
      expect(canManageOrg).toBe(true);
    });

    it("should correctly determine user management permission for Member", async () => {
      vi.mocked(db.query.roles.findFirst).mockResolvedValue({
        id: "role-member",
        name: "Member",
        rolePermissions: [
          { permission: { name: PERMISSIONS.ISSUE_VIEW } },
          { permission: { name: PERMISSIONS.ISSUE_CREATE_FULL } },
        ],
      });

      const membership = { roleId: "role-member" };
      const canManageUsers = await hasPermission(
        membership,
        PERMISSIONS.USER_MANAGE,
        db,
      );
      const canManageOrg = await hasPermission(
        membership,
        PERMISSIONS.ORGANIZATION_MANAGE,
        db,
      );

      expect(canManageUsers).toBe(false);
      expect(canManageOrg).toBe(false);
    });
  });
});
