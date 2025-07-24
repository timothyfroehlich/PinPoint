/**
 * @jest-environment node
 */

import { PermissionService } from "../permissionService";

// Mock the permission constants
jest.mock("../../auth/permissions.constants", () => ({
  PERMISSION_DEPENDENCIES: {
    "issue:edit": ["issue:view"],
    "issue:delete": ["issue:view"],
    "issue:assign": ["issue:view"],
    "issue:bulk_manage": ["issue:view", "issue:edit"],
    "machine:edit": ["machine:view"],
    "machine:delete": ["machine:view"],
    "location:edit": ["location:view"],
    "location:delete": ["location:view"],
    "attachment:delete": ["attachment:view"],
  },
  SYSTEM_ROLES: {
    ADMIN: "Admin",
    UNAUTHENTICATED: "Unauthenticated",
  },
  UNAUTHENTICATED_PERMISSIONS: ["issue:view", "machine:view"],
  ALL_PERMISSIONS: [
    "issue:view",
    "issue:create",
    "issue:edit",
    "issue:delete",
    "machine:view",
    "machine:create",
    "machine:edit",
    "machine:delete",
  ],
}));

// Mock ExtendedPrismaClient since we're only testing expandPermissionsWithDependencies

const mockPrisma = {} as any;

describe("PermissionService - expandPermissionsWithDependencies", () => {
  let permissionService: PermissionService;

  beforeEach(() => {
    permissionService = new PermissionService(mockPrisma);
  });

  describe("with no dependencies", () => {
    it("should return original permissions when no dependencies exist", () => {
      const input = ["issue:create", "machine:create"];
      const result = permissionService.expandPermissionsWithDependencies(input);

      expect(result).toEqual(expect.arrayContaining(input));
      expect(result).toHaveLength(input.length);
    });

    it("should handle empty permissions array", () => {
      const result = permissionService.expandPermissionsWithDependencies([]);
      expect(result).toEqual([]);
    });
  });

  describe("with simple dependencies", () => {
    it("should include dependencies for single permission", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:edit",
      ]);

      expect(result).toEqual(
        expect.arrayContaining(["issue:edit", "issue:view"]),
      );
      expect(result).toHaveLength(2);
    });

    it("should include dependencies for multiple permissions", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:edit",
        "machine:edit",
      ]);

      expect(result).toEqual(
        expect.arrayContaining([
          "issue:edit",
          "issue:view",
          "machine:edit",
          "machine:view",
        ]),
      );
      expect(result).toHaveLength(4);
    });

    it("should not duplicate permissions when dependencies overlap", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:edit",
        "issue:delete",
      ]);

      // Both depend on "issue:view", should only include it once
      expect(result).toEqual(
        expect.arrayContaining(["issue:edit", "issue:delete", "issue:view"]),
      );
      expect(result).toHaveLength(3);
    });
  });

  describe("with complex dependencies", () => {
    it("should handle multi-level dependencies", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:bulk_manage",
      ]);

      // issue:bulk_manage depends on ["issue:view", "issue:edit"]
      // issue:edit also depends on ["issue:view"]
      // Should include all without duplicates
      expect(result).toEqual(
        expect.arrayContaining([
          "issue:bulk_manage",
          "issue:view",
          "issue:edit",
        ]),
      );
      expect(result).toHaveLength(3);
    });

    it("should handle permissions that are both base and dependency", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:view",
        "issue:edit",
      ]);

      // issue:edit depends on issue:view, but issue:view is already included
      expect(result).toEqual(
        expect.arrayContaining(["issue:view", "issue:edit"]),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    it("should handle permissions with no matching dependencies", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "unknown:permission",
      ]);

      expect(result).toEqual(["unknown:permission"]);
    });

    it("should handle mixed known and unknown permissions", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:edit",
        "unknown:permission",
      ]);

      expect(result).toEqual(
        expect.arrayContaining([
          "issue:edit",
          "issue:view",
          "unknown:permission",
        ]),
      );
      expect(result).toHaveLength(3);
    });

    it("should preserve original order while adding dependencies", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:edit",
        "machine:edit",
      ]);

      // Original permissions should be included
      expect(result).toContain("issue:edit");
      expect(result).toContain("machine:edit");
      // Dependencies should be added
      expect(result).toContain("issue:view");
      expect(result).toContain("machine:view");
    });
  });

  describe("return value characteristics", () => {
    it("should return unique permissions (no duplicates)", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:edit",
        "issue:delete",
        "issue:view", // This overlaps with dependencies
      ]);

      const uniqueResult = [...new Set(result)];
      expect(result).toHaveLength(uniqueResult.length);
    });

    it("should always include original permissions in result", () => {
      const originalPermissions = [
        "issue:edit",
        "machine:create",
        "unknown:permission",
      ];
      const result =
        permissionService.expandPermissionsWithDependencies(
          originalPermissions,
        );

      originalPermissions.forEach((permission) => {
        expect(result).toContain(permission);
      });
    });

    it("should return array type", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:view",
      ]);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("specific dependency scenarios", () => {
    it("should expand attachment permissions correctly", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "attachment:delete",
      ]);

      expect(result).toEqual(
        expect.arrayContaining(["attachment:delete", "attachment:view"]),
      );
    });

    it("should handle permissions without dependencies correctly", () => {
      const result = permissionService.expandPermissionsWithDependencies([
        "issue:view",
        "machine:view",
      ]);

      // These are view permissions with no dependencies
      expect(result).toEqual(
        expect.arrayContaining(["issue:view", "machine:view"]),
      );
      expect(result).toHaveLength(2);
    });

    it("should handle complex permission sets", () => {
      const complexSet = [
        "issue:bulk_manage", // depends on issue:view, issue:edit
        "machine:delete", // depends on machine:view
        "location:edit", // depends on location:view
      ];

      const result =
        permissionService.expandPermissionsWithDependencies(complexSet);

      expect(result).toEqual(
        expect.arrayContaining([
          "issue:bulk_manage",
          "issue:view",
          "issue:edit",
          "machine:delete",
          "machine:view",
          "location:edit",
          "location:view",
        ]),
      );
      expect(result).toHaveLength(7);
    });
  });
});
