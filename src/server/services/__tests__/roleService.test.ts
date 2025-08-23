import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoleService } from "../roleService";
import { createAdminServiceMock } from "~/test/helpers/service-mock-database";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import type { DrizzleClient } from "~/server/db/drizzle";
import {
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
} from "~/server/auth/permissions.constants";

const { valuesReturningMock, whereReturningMock, setMock, ...mockDb } =
  createAdminServiceMock();

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

import { generatePrefixedId } from "~/lib/utils/id-generation";

vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: vi.fn(),
}));

vi.mock("../permissionService", () => ({
  PermissionService: vi.fn(() => ({
    getPermissions: vi.fn().mockResolvedValue([]),
    expandPermissionsWithDependencies: vi
      .fn()
      .mockReturnValue(["permission:1", "permission:2"]),
  })),
}));

describe("RoleService", () => {
  let service: RoleService;

  beforeEach(() => {
    service = new RoleService(
      mockDb as unknown as DrizzleClient,
      SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
    );
    vi.clearAllMocks();
    valuesReturningMock.mockClear();
    whereReturningMock.mockClear();
    setMock.mockClear();
  });

  it("should instantiate properly", () => {
    expect(service).toBeInstanceOf(RoleService);
  });

  describe("deleteRole", () => {
    it("should throw NOT_FOUND when role does not exist", async () => {
      mockDb.query.roles.findFirst.mockResolvedValue(null);

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

      mockDb.query.roles.findFirst.mockResolvedValue(systemRole);

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

      mockDb.query.roles.findFirst
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
        isSystem: false,
        isDefault: true,
      };

      mockDb.query.roles.findFirst.mockResolvedValue(null);
      vi.mocked(generatePrefixedId).mockReturnValue(
        SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
      );

      const mockReturning = vi.fn().mockResolvedValue([mockNewRole]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDb.insert = vi.fn().mockReturnValue({ values: mockValues });

      mockDb.query.permissions.findMany.mockResolvedValue([]);
      mockDb.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName);

      expect(result).toEqual(mockNewRole);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        id: SEED_TEST_IDS.MOCK_PATTERNS.ROLE,
        name: ROLE_TEMPLATES.MEMBER.name,
        organizationId: SEED_TEST_IDS.MOCK_PATTERNS.ORGANIZATION,
        isSystem: false,
        isDefault: true,
      });
    });

    it("should update existing role when template role already exists", async () => {
      const templateName = "MEMBER" as keyof typeof ROLE_TEMPLATES;
      const existingRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-existing`,
        name: ROLE_TEMPLATES.MEMBER.name,
        isSystem: true, // Will be updated to false
        isDefault: false, // Will be updated to true
      };

      const updatedRole = { ...existingRole, isSystem: false, isDefault: true };

      mockDb.query.roles.findFirst.mockResolvedValue(existingRole);

      const mockReturning = vi.fn().mockResolvedValue([updatedRole]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.update = vi.fn().mockReturnValue({ set: mockSet });

      mockDb.query.permissions.findMany.mockResolvedValue([]);
      mockDb.query.rolePermissions.findMany.mockResolvedValue([]);

      const result = await service.createTemplateRole(templateName);

      expect(result).toEqual(updatedRole);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystem: false,
          isDefault: true,
        }),
      );
    });
  });

  describe("ensureAtLeastOneAdmin", () => {
    it("should throw error when no admin users exist", async () => {
      const adminRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`,
        name: SYSTEM_ROLES.ADMIN,
        memberships: [], // No admin memberships
      };
      mockDb.query.roles.findFirst.mockResolvedValue(adminRole);

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
        ],
      };
      mockDb.query.roles.findFirst.mockResolvedValue(adminRole);

      await expect(service.ensureAtLeastOneAdmin()).resolves.not.toThrow();
    });
  });

  describe("getDefaultRole", () => {
    it("should return null when no default role exists", async () => {
      mockDb.query.roles.findFirst.mockResolvedValue(null);

      const result = await service.getDefaultRole();

      expect(result).toBeNull();
      expect(mockDb.query.roles.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
    });

    it("should return default role when it exists", async () => {
      const defaultRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-default`,
        name: "Default Role",
        isDefault: true,
      };

      mockDb.query.roles.findFirst.mockResolvedValue(defaultRole);

      const result = await service.getDefaultRole();

      expect(result).toEqual(defaultRole);
    });
  });

  describe("getAdminRole", () => {
    it("should return null when admin role does not exist", async () => {
      mockDb.query.roles.findFirst.mockResolvedValue(null);

      const result = await service.getAdminRole();

      expect(result).toBeNull();
    });

    it("should return admin role when it exists", async () => {
      const adminRole = {
        id: `${SEED_TEST_IDS.MOCK_PATTERNS.ROLE}-admin`,
        name: SYSTEM_ROLES.ADMIN,
        isSystem: true,
      };

      mockDb.query.roles.findFirst.mockResolvedValue(adminRole);

      const result = await service.getAdminRole();

      expect(result).toEqual(adminRole);
    });
  });

  describe("updateRole", () => {
    it("should throw NOT_FOUND when role does not exist", async () => {
      mockDb.query.roles.findFirst.mockResolvedValue(null);

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
      };

      mockDb.query.roles.findFirst.mockResolvedValue(systemRole);

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
