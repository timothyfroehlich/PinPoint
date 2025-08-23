import { TRPCError } from "@trpc/server";
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterAll,
} from "vitest";

import {
  hasPermission,
  requirePermission,
  getUserPermissions,
} from "../permissions";
import { SYSTEM_ROLES } from "../permissions.constants";
import { DrizzleClient } from "~/server/db/drizzle";

// Create a deep mock of the DrizzleClient specifically for this test file.
// This ensures complete isolation from any shared mock contexts.
const createLocalMockDb = () =>
  ({
    query: {
      roles: {
        findFirst: vi.fn(),
      },
      permissions: {
        findMany: vi.fn(),
      },
    },
  }) as unknown as DrizzleClient;

let mockDb: DrizzleClient;

describe("Permission System (Isolated)", () => {
  // Aggressive cleanup solution suggested by user to prevent mock pollution
  beforeAll(() => {
    // Per user suggestion, capture clean state, though not strictly needed
    // for this file as it uses local mocks. The afterAll hook is the critical part.
  });

  afterAll(async () => {
    // Aggressively clean up ALL mocks to prevent leakage into other test files
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // Force reload modules that other tests (like drizzle-singleton) depend on
    await vi.resetModules();
  });

  beforeEach(() => {
    // Create a fresh mock db for every test to ensure isolation
    mockDb = createLocalMockDb();
  });

  describe("hasPermission", () => {
    it("should return true when user has the required permission", async () => {
      const membership = { roleId: "role-with-perms" };
      const permission = "issue:create";
      const mockRole = {
        name: "Member",
        rolePermissions: [{ permission: { name: "issue:create" } }],
      };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(mockRole);

      const result = await hasPermission(membership, permission, mockDb);

      expect(result).toBe(true);
      expect(mockDb.query.roles.findFirst).toHaveBeenCalledTimes(1);
    });

    it("should return false when user does not have the required permission", async () => {
      const membership = { roleId: "role-with-perms" };
      const permission = "issue:delete";
      const mockRole = {
        name: "Member",
        rolePermissions: [{ permission: { name: "issue:create" } }],
      };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(mockRole);

      const result = await hasPermission(membership, permission, mockDb);

      expect(result).toBe(false);
    });

    it("should return true for an admin user", async () => {
      const membership = { roleId: "admin-role" };
      const mockRole = {
        name: SYSTEM_ROLES.ADMIN,
        rolePermissions: [],
      };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(mockRole);

      const result = await hasPermission(membership, "any:permission", mockDb);

      expect(result).toBe(true);
    });

    it("should return false when the role does not exist", async () => {
      const membership = { roleId: "non-existent-role" };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(null);

      const result = await hasPermission(membership, "issue:create", mockDb);

      expect(result).toBe(false);
    });

    it("should return false for a null membership", async () => {
      const result = await hasPermission(null, "issue:create", mockDb);
      expect(result).toBe(false);
      expect(mockDb.query.roles.findFirst).not.toHaveBeenCalled();
    });

    it("should return false for an undefined membership", async () => {
      const result = await hasPermission(undefined, "issue:create", mockDb);
      expect(result).toBe(false);
      expect(mockDb.query.roles.findFirst).not.toHaveBeenCalled();
    });

    it("should return false for a membership with a null roleId", async () => {
      const result = await hasPermission(
        { roleId: null },
        "issue:create",
        mockDb,
      );
      expect(result).toBe(false);
      expect(mockDb.query.roles.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("requirePermission", () => {
    it("should not throw if user has the permission", async () => {
      const membership = { roleId: "role-with-perms" };
      const mockRole = {
        name: "Member",
        rolePermissions: [{ permission: { name: "issue:create" } }],
      };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(mockRole);

      await expect(
        requirePermission(membership, "issue:create", mockDb),
      ).resolves.not.toThrow();
    });

    it("should throw a TRPCError if user does not have the permission", async () => {
      const membership = { roleId: "role-without-perms" };
      const permission = "issue:delete";
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue({
        name: "Member",
        rolePermissions: [],
      });

      await expect(
        requirePermission(membership, permission, mockDb),
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: `Permission required: ${permission}`,
        }),
      );
    });

    it("should throw a TRPCError for a null membership", async () => {
      const permission = "issue:create";
      await expect(requirePermission(null, permission, mockDb)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: `Permission required: ${permission}`,
        }),
      );
    });
  });

  describe("getUserPermissions", () => {
    it("should return the correct list of permissions for a role", async () => {
      const membership = { roleId: "test-role" };
      const mockRole = {
        name: "Member",
        rolePermissions: [
          { permission: { name: "issue:create" } },
          { permission: { name: "issue:view" } },
        ],
      };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(mockRole);

      const permissions = await getUserPermissions(membership, mockDb);

      expect(permissions).toEqual(
        expect.arrayContaining(["issue:create", "issue:view"]),
      );
    });

    it("should return all permissions for an admin role", async () => {
      const membership = { roleId: "admin-role" };
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue({
        name: SYSTEM_ROLES.ADMIN,
        rolePermissions: [],
      });
      const mockAllPermissions = [
        { name: "issue:create" },
        { name: "user:manage" },
      ];
      vi.mocked(mockDb.query.permissions.findMany).mockResolvedValue(
        mockAllPermissions,
      );

      const permissions = await getUserPermissions(membership, mockDb);

      expect(permissions).toEqual(["issue:create", "user:manage"]);
    });

    it("should return an empty array if the role does not exist", async () => {
      vi.mocked(mockDb.query.roles.findFirst).mockResolvedValue(null);
      const permissions = await getUserPermissions(
        { roleId: "non-existent" },
        mockDb,
      );
      expect(permissions).toEqual([]);
    });

    it("should return an empty array for a null membership", async () => {
      const permissions = await getUserPermissions(null, mockDb);
      expect(permissions).toEqual([]);
    });
  });
});
