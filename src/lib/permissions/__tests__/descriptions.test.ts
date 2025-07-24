import { describe, it, expect } from "vitest";

import {
  PERMISSION_DESCRIPTIONS,
  getPermissionDescription,
} from "../descriptions";

describe("Permission Descriptions", () => {
  describe("PERMISSION_DESCRIPTIONS constant", () => {
    it("should contain all expected permission categories", () => {
      const expectedPermissions = [
        // Issues
        "issue:view",
        "issue:create",
        "issue:edit",
        "issue:delete",
        "issue:assign",
        "issue:bulk_manage",
        // Machines
        "machine:view",
        "machine:create",
        "machine:edit",
        "machine:delete",
        // Locations
        "location:view",
        "location:create",
        "location:edit",
        "location:delete",
        // Attachments
        "attachment:view",
        "attachment:create",
        "attachment:delete",
        // Organization & Admin
        "organization:manage",
        "organization:admin",
        "role:manage",
        "user:manage",
        "admin:view_analytics",
      ];

      expectedPermissions.forEach((permission) => {
        expect(PERMISSION_DESCRIPTIONS).toHaveProperty(permission);
      });
    });

    it("should have non-empty descriptions for all permissions", () => {
      Object.entries(PERMISSION_DESCRIPTIONS).forEach(
        ([permission, description]) => {
          expect(description).toBeTruthy();
          expect(typeof description).toBe("string");
          expect(description.length).toBeGreaterThan(0);
          expect(description).not.toBe(permission);
        },
      );
    });

    it("should use consistent description formatting", () => {
      Object.values(PERMISSION_DESCRIPTIONS).forEach((description) => {
        // Should start with capital letter
        expect(description[0]).toMatch(/[A-Z]/);
        // Should not end with period (since we add prefix)
        expect(description).not.toMatch(/\.$/);
        // Should be descriptive (at least 2 words)
        expect(description.split(" ").length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should match expected permission naming conventions", () => {
      Object.keys(PERMISSION_DESCRIPTIONS).forEach((permission) => {
        // Should follow "resource:action" pattern
        expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
        // Should contain exactly one colon
        expect(permission.split(":")).toHaveLength(2);
      });
    });
  });

  describe("getPermissionDescription function", () => {
    describe("with known permissions", () => {
      it("should return formatted description for issue permissions", () => {
        const result = getPermissionDescription("issue:edit");
        expect(result).toBe("This action requires: Edit existing issues");
      });

      it("should return formatted description for machine permissions", () => {
        const result = getPermissionDescription("machine:view");
        expect(result).toBe(
          "This action requires: View machines and their details",
        );
      });

      it("should return formatted description for admin permissions", () => {
        const result = getPermissionDescription("admin:view_analytics");
        expect(result).toBe(
          "This action requires: Access analytics and reports",
        );
      });
    });

    describe("with unknown permissions", () => {
      it("should return fallback message for non-existent permission", () => {
        const result = getPermissionDescription("unknown:permission");
        expect(result).toBe(
          "You don't have permission to perform this action (unknown:permission)",
        );
      });

      it("should return fallback message for empty string", () => {
        const result = getPermissionDescription("");
        expect(result).toBe(
          "You don't have permission to perform this action ()",
        );
      });

      it("should return fallback message for malformed permission", () => {
        const malformedPermission = "malformed-permission";
        const result = getPermissionDescription(malformedPermission);
        expect(result).toBe(
          `You don't have permission to perform this action (${malformedPermission})`,
        );
      });
    });

    describe("edge cases", () => {
      it("should handle null input gracefully", () => {
        const result = getPermissionDescription(null as any);
        expect(result).toBe(
          "You don't have permission to perform this action (null)",
        );
      });

      it("should handle undefined input gracefully", () => {
        const result = getPermissionDescription(undefined as any);
        expect(result).toBe(
          "You don't have permission to perform this action (undefined)",
        );
      });

      it("should handle special characters in permission names", () => {
        const specialPermission = "test:action@#$%";
        const result = getPermissionDescription(specialPermission);
        expect(result).toBe(
          `You don't have permission to perform this action (${specialPermission})`,
        );
      });
    });
  });

  describe("integration with common permissions", () => {
    it("should provide descriptions for core CRUD operations", () => {
      const crudPermissions = [
        "issue:view",
        "issue:create",
        "issue:edit",
        "issue:delete",
      ];

      crudPermissions.forEach((permission) => {
        const description = getPermissionDescription(permission);
        expect(description).toContain("This action requires:");
        expect(description.length).toBeGreaterThan(25); // Should be descriptive
      });
    });

    it("should have consistent verb usage across similar operations", () => {
      // View permissions should use "View"
      expect(PERMISSION_DESCRIPTIONS["issue:view"]).toContain("View");
      expect(PERMISSION_DESCRIPTIONS["machine:view"]).toContain("View");
      expect(PERMISSION_DESCRIPTIONS["location:view"]).toContain("View");

      // Edit permissions should use "Edit"
      expect(PERMISSION_DESCRIPTIONS["issue:edit"]).toContain("Edit");
      expect(PERMISSION_DESCRIPTIONS["machine:edit"]).toContain("Edit");
      expect(PERMISSION_DESCRIPTIONS["location:edit"]).toContain("Edit");
    });
  });
});
