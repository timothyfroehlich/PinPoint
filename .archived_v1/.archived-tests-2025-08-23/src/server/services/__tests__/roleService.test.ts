/**
 * RoleService Unit Tests
 *
 * Tests for the RoleService class covering error scenarios,
 * edge cases, and business logic not covered by integration tests.
 *
 * Focus areas:
 * - Error handling (NOT_FOUND, FORBIDDEN, PRECONDITION_FAILED)
 * - Admin protection logic
 * - Template creation edge cases
 * - Permission assignment validation
 * - Role deletion constraints
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ROLE_TEMPLATES,
  SYSTEM_ROLES,
} from "~/server/auth/permissions.constants";
import { RoleService } from "~/server/services/roleService";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock dependencies
vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn(() => SEED_TEST_IDS.MOCK_PATTERNS.ROLE),
}));

vi.mock("../permissionService", () => ({
  PermissionService: vi.fn(() => ({
    getPermissions: vi.fn().mockResolvedValue([]),
    expandPermissionsWithDependencies: vi
      .fn()
      .mockReturnValue(["permission:1", "permission:2"]),
  })),
}));

// Mock schema imports
vi.mock("~/server/db/schema", () => ({
  roles: {
    id: "roles.id",
    name: "roles.name",
    organizationId: "roles.organizationId",
    isSystem: "roles.isSystem",
    isDefault: "roles.isDefault",
    createdAt: "roles.createdAt",
    updatedAt: "roles.updatedAt",
  },
  permissions: {
    id: "permissions.id",
    name: "permissions.name",
  },
  role_permissions: {
    roleId: "role_permissions.roleId",
    permissionId: "role_permissions.permissionId",
  },
  memberships: {
    roleId: "memberships.roleId",
    userId: "memberships.userId",
  },
}));

// Mock drizzle client
const createMockDrizzleClient = () => ({
  query: {
    roles: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    permissions: {
      findMany: vi.fn(),
    },
    memberships: {
      findMany: vi.fn(),
    },
    rolePermissions: {
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn().mockResolvedValue(undefined),
  })),
});

describe("RoleService", () => {
  let service: RoleService;
  let mockDrizzle: ReturnType<typeof createMockDrizzleClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDrizzle = createMockDrizzleClient();
    service = new RoleService(mockDrizzle as any);
  });

  describe("deleteRole", () => {
    it("should throw NOT_FOUND when role does not exist", async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteRole(`${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-nonexistent`),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "NOT_FOUND",
          message: "Role not found",
        }),
      );
    });

    it("should throw FORBIDDEN when trying to delete system role", async () => {
      const systemRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`,
        name: SYSTEM_ROLES.ADMIN,
        isSystem: true,
        memberships: [],
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(systemRole);

      await expect(
        service.deleteRole(`${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "FORBIDDEN",
          message: "System roles cannot be deleted",
        }),
      );
    });

    it("should throw PRECONDITION_FAILED when no default role available for reassignment", async () => {
      const customRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-custom`,
        name: "Custom Role",
        isSystem: false,
        memberships: [{ userId: SEED_TEST_IDS.MOCK_PATTERNS.USER }],
      };

      mockDrizzle.query.roles.findFirst
        .mockResolvedValueOnce(customRole) // First call: find role to delete
        .mockResolvedValueOnce(null); // Second call: find default role

      await expect(
        service.deleteRole(`${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-custom`),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "PRECONDITION_FAILED",
          message: "No default role available for member reassignment",
        }),
      );
    });
  });

  describe("createTemplateRole", () => {
    it("should create new role when template role does not exist", async () => {
      const templateName = "MEMBER" as keyof typeof ROLE_TEMPLATES;
      const mockNewRole = {
        id: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
        name: ROLE_TEMPLATES.MEMBER.name,
        // organizationId handled by RLS
        isSystem: false,
        isDefault: true,
      };

      // Role doesn't exist
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      // Mock insert chain
      const mockReturning = vi.fn().mockResolvedValue([mockNewRole]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDrizzle.insert.mockReturnValue({ values: mockValues });

      // Mock permission queries for template setup
      mockDrizzle.query.permissions.findMany.mockResolvedValue([]);
      mockDrizzle.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName);

      expect(result).toEqual(mockNewRole);
      expect(mockDrizzle.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        id: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
        name: ROLE_TEMPLATES.MEMBER.name,
        // organizationId set automatically by RLS trigger
        isSystem: false,
        isDefault: true,
      });
    });

    it("should update existing role when template role already exists", async () => {
      const templateName = "MEMBER" as keyof typeof ROLE_TEMPLATES;
      const existingRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-existing`,
        name: ROLE_TEMPLATES.MEMBER.name,
        // organizationId handled by RLS
        isSystem: true, // Will be updated to false
        isDefault: false, // Will be updated to true
      };

      const updatedRole = { ...existingRole, isSystem: false, isDefault: true };

      // Role exists
      mockDrizzle.query.roles.findFirst.mockResolvedValue(existingRole);

      // Mock update chain
      const mockReturning = vi.fn().mockResolvedValue([updatedRole]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDrizzle.update.mockReturnValue({ set: mockSet });

      // Mock permission queries
      mockDrizzle.query.permissions.findMany.mockResolvedValue([]);
      mockDrizzle.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName);

      expect(result).toEqual(updatedRole);
      expect(mockDrizzle.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystem: false,
          isDefault: true,
        }),
      );
    });

    it("should apply name override when provided", async () => {
      const templateName = "MEMBER" as keyof typeof ROLE_TEMPLATES;
      const customName = "Custom Member Role";
      const mockNewRole = {
        id: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
        name: customName,
        // organizationId handled by RLS
        isSystem: false,
        isDefault: false,
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      const mockReturning = vi.fn().mockResolvedValue([mockNewRole]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDrizzle.insert.mockReturnValue({ values: mockValues });

      mockDrizzle.query.permissions.findMany.mockResolvedValue([]);
      mockDrizzle.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName, {
        name: customName,
        isDefault: false,
      });

      expect(result.name).toBe(customName);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: customName,
          isDefault: false,
        }),
      );
    });
  });

  describe("ensureAtLeastOneAdmin", () => {
    it("should throw error when no admin users exist", async () => {
      // Admin role exists but has no memberships
      const adminRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`,
        name: SYSTEM_ROLES.ADMIN,
        memberships: [], // No admin memberships
      };
      mockDrizzle.query.roles.findFirst.mockResolvedValue(adminRole);

      await expect(service.ensureAtLeastOneAdmin()).rejects.toThrow(
        expect.objectContaining({
          code: "PRECONDITION_FAILED",
          message: "Organization must have at least one admin",
        }),
      );
    });

    it("should pass when admin users exist", async () => {
      const adminRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`,
        name: SYSTEM_ROLES.ADMIN,
        memberships: [
          {
            id: SEED_TEST_IDS.MOCK_PATTERNS.MEMBERSHIP,
            userId: `${SEED_TEST_IDS.MOCK_PATTERNS.USER}-admin`,
          },
        ], // Has admin members
      };
      mockDrizzle.query.roles.findFirst.mockResolvedValue(adminRole);

      await expect(service.ensureAtLeastOneAdmin()).resolves.not.toThrow();
    });
  });

  describe("getDefaultRole", () => {
    it("should return null when no default role exists", async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      const result = await service.getDefaultRole();

      expect(result).toBeNull();
      expect(mockDrizzle.query.roles.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object), // and(eq(isDefault, true), eq(isSystem, false)) - RLS handles org scoping
      });
    });

    it("should return default role when it exists", async () => {
      const defaultRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-default`,
        name: "Default Role",
        // organizationId handled by RLS
        isDefault: true,
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(defaultRole);

      const result = await service.getDefaultRole();

      expect(result).toEqual(defaultRole);
    });
  });

  describe("getAdminRole", () => {
    it("should return null when admin role does not exist", async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      const result = await service.getAdminRole();

      expect(result).toBeNull();
    });

    it("should return admin role when it exists", async () => {
      const adminRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`,
        name: SYSTEM_ROLES.ADMIN,
        // organizationId handled by RLS
        isSystem: true,
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(adminRole);

      const result = await service.getAdminRole();

      expect(result).toEqual(adminRole);
    });
  });

  describe("updateRole", () => {
    it("should throw NOT_FOUND when role does not exist", async () => {
      mockDrizzle.query.roles.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRole(`${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-nonexistent`, {
          name: "New Name",
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "NOT_FOUND",
          message: "Role not found",
        }),
      );
    });

    it("should throw FORBIDDEN when trying to update system role", async () => {
      const systemRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`,
        name: SYSTEM_ROLES.ADMIN,
        isSystem: true,
        // organizationId handled by RLS
      };

      mockDrizzle.query.roles.findFirst.mockResolvedValue(systemRole);

      await expect(
        service.updateRole(`${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`, {
          name: "New Admin",
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "FORBIDDEN",
          message: "Admin role cannot be modified",
        }),
      );
    });
  });
});
