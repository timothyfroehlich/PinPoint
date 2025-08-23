import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RoleService } from "../roleService";
import {
  roles,
  permissions,
  rolePermissions,
  memberships,
} from "~/server/db/schema";
import { DrizzleClient } from "~/server/db/drizzle";
import {
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
} from "~/server/auth/permissions.constants";
import { generatePrefixedId } from "~/lib/utils/id-generation";

// Mock dependencies that are not the main focus of the test
vi.mock("../permissionService", () => ({
  PermissionService: vi.fn(() => ({
    getPermissions: vi.fn().mockResolvedValue([]),
    expandPermissionsWithDependencies: vi
      .fn()
      .mockImplementation((perms) => perms),
  })),
}));

vi.mock("~/lib/utils/id-generation");

const createLocalMockDb = () => {
  const db: any = {
    query: {
      roles: { findFirst: vi.fn(), findMany: vi.fn() },
      permissions: { findMany: vi.fn() },
      memberships: { findMany: vi.fn() },
      rolePermissions: { findMany: vi.fn() },
    },
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    delete: vi.fn(),
  };

  // Setup chaining
  db.update.mockImplementation(() => db);
  db.set.mockImplementation(() => db);
  db.where.mockImplementation(() => db);
  db.insert.mockImplementation(() => db);
  db.values.mockImplementation(() => db);
  db.returning.mockImplementation(() => db);
  db.delete.mockImplementation(() => db);

  // Default return values
  db.returning.mockResolvedValue([]);

  return db as unknown as DrizzleClient;
};

let service: RoleService;
let mockDb: DrizzleClient;

describe("RoleService (Isolated)", () => {
  afterAll(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
    await vi.resetModules();
  });

  beforeEach(() => {
    mockDb = createLocalMockDb();
    // Assuming organizationId is required by the constructor
    service = new RoleService(mockDb, "test-org-id");
  });

  describe("deleteRole", () => {
    it("should throw NOT_FOUND when role does not exist", async () => {
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(null);
      await expect(service.deleteRole("non-existent-id")).rejects.toThrow(
        "Role not found",
      );
    });

    it("should throw FORBIDDEN when trying to delete a system role", async () => {
      const systemRole = { id: "sys-role", isSystem: true };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(
        systemRole as any,
      );
      await expect(service.deleteRole("sys-role")).rejects.toThrow(
        "System roles cannot be deleted",
      );
    });

    it("should successfully delete a role with no members", async () => {
      const roleToDelete = {
        id: "del-role-1",
        isSystem: false,
        memberships: [],
      };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(
        roleToDelete as any,
      );
      const defaultRole = { id: "default-role" };
      // The findFirst for default role
      vi.mocked(mockDb.query.roles.findFirst)
        .mockResolvedValueOnce(roleToDelete as any)
        .mockResolvedValueOnce(defaultRole as any);

      await service.deleteRole("del-role-1");

      expect(mockDb.delete).toHaveBeenCalledWith(roles);
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("createTemplateRole", () => {
    it("should create a new role from a template", async () => {
      const template = ROLE_TEMPLATES.MEMBER;
      const newRoleId = "new-role-id";
      const newRole = {
        id: newRoleId,
        name: template.name,
        isDefault: template.isDefault,
        isSystem: false,
      };
      vi.mocked(generatePrefixedId).mockReturnValue(newRoleId);

      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(null);
      vi.mocked(mockDb.returning).mockResolvedValue([newRole]);
      vi.mocked(mockDb.query.permissions.findMany).mockResolvedValue([
        { id: "p1", name: "issue:create" },
      ]);

      const result = await service.createTemplateRole("MEMBER");

      expect(result.name).toBe(template.name);
      expect(mockDb.insert).toHaveBeenCalledWith(roles);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ name: template.name }),
      );
    });

    it("should update an existing role from a template", async () => {
      const template = ROLE_TEMPLATES.MEMBER;
      const existingRole = { id: "existing-member", name: "Old Member Name" };
      const updatedRole = {
        ...existingRole,
        name: "Old Member Name",
        isDefault: true,
        isSystem: false,
      };

      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(
        existingRole as any,
      );
      vi.mocked(mockDb.returning).mockResolvedValue([updatedRole]);
      vi.mocked(mockDb.query.permissions.findMany).mockResolvedValue([]);

      const result = await service.createTemplateRole("MEMBER", {
        name: "Old Member Name",
      });

      expect(result.name).toBe("Old Member Name");
      expect(mockDb.update).toHaveBeenCalledWith(roles);
      // The service does not update the name, only the flags. This is the key fix.
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isDefault: true,
          isSystem: false,
        }),
      );
    });
  });
});
