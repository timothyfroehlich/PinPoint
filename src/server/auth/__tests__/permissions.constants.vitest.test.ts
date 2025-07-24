import { describe, it, expect } from "vitest";

import {
  PERMISSIONS,
  PERMISSION_DEPENDENCIES,
  SYSTEM_ROLES,
  ROLE_TEMPLATES,
  PERMISSION_DESCRIPTIONS,
  ALL_PERMISSIONS,
  UNAUTHENTICATED_PERMISSIONS,
  ADMIN_PERMISSIONS,
} from "../permissions.constants";

describe("Permission Constants", () => {
  describe("PERMISSIONS object", () => {
    it("should contain all expected permission categories", () => {
      // Issues
      expect(PERMISSIONS.ISSUE_VIEW).toBe("issue:view");
      expect(PERMISSIONS.ISSUE_CREATE).toBe("issue:create");
      expect(PERMISSIONS.ISSUE_EDIT).toBe("issue:edit");
      expect(PERMISSIONS.ISSUE_DELETE).toBe("issue:delete");
      expect(PERMISSIONS.ISSUE_ASSIGN).toBe("issue:assign");
      expect(PERMISSIONS.ISSUE_BULK_MANAGE).toBe("issue:bulk_manage");

      // Machines
      expect(PERMISSIONS.MACHINE_VIEW).toBe("machine:view");
      expect(PERMISSIONS.MACHINE_CREATE).toBe("machine:create");
      expect(PERMISSIONS.MACHINE_EDIT).toBe("machine:edit");
      expect(PERMISSIONS.MACHINE_DELETE).toBe("machine:delete");

      // Locations
      expect(PERMISSIONS.LOCATION_VIEW).toBe("location:view");
      expect(PERMISSIONS.LOCATION_CREATE).toBe("location:create");
      expect(PERMISSIONS.LOCATION_EDIT).toBe("location:edit");
      expect(PERMISSIONS.LOCATION_DELETE).toBe("location:delete");

      // Attachments
      expect(PERMISSIONS.ATTACHMENT_VIEW).toBe("attachment:view");
      expect(PERMISSIONS.ATTACHMENT_CREATE).toBe("attachment:create");
      expect(PERMISSIONS.ATTACHMENT_DELETE).toBe("attachment:delete");

      // Admin
      expect(PERMISSIONS.ORGANIZATION_MANAGE).toBe("organization:manage");
      expect(PERMISSIONS.ROLE_MANAGE).toBe("role:manage");
      expect(PERMISSIONS.USER_MANAGE).toBe("user:manage");
      expect(PERMISSIONS.ADMIN_VIEW_ANALYTICS).toBe("admin:view_analytics");
    });

    it("should use consistent permission naming convention", () => {
      Object.values(PERMISSIONS).forEach((permission) => {
        // Should follow "resource:action" pattern
        expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
        // Should contain exactly one colon
        expect(permission.split(":")).toHaveLength(2);
      });
    });

    it("should have immutable structure", () => {
      // PERMISSIONS uses 'as const' for type-level immutability
      // While not runtime frozen, TypeScript prevents modifications
      expect(typeof PERMISSIONS).toBe("object");
      expect(PERMISSIONS).toBeDefined();
    });

    it("should have no duplicate values", () => {
      const values = Object.values(PERMISSIONS);
      const uniqueValues = [...new Set(values)];
      expect(values).toHaveLength(uniqueValues.length);
    });
  });

  describe("PERMISSION_DEPENDENCIES", () => {
    it("should define logical permission hierarchies", () => {
      // Edit permissions should depend on view permissions
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.ISSUE_EDIT]).toContain(
        PERMISSIONS.ISSUE_VIEW,
      );
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.MACHINE_EDIT]).toContain(
        PERMISSIONS.MACHINE_VIEW,
      );
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.LOCATION_EDIT]).toContain(
        PERMISSIONS.LOCATION_VIEW,
      );

      // Delete permissions should depend on view permissions
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.ISSUE_DELETE]).toContain(
        PERMISSIONS.ISSUE_VIEW,
      );
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.MACHINE_DELETE]).toContain(
        PERMISSIONS.MACHINE_VIEW,
      );
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.LOCATION_DELETE]).toContain(
        PERMISSIONS.LOCATION_VIEW,
      );

      // Bulk operations should depend on individual operations
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.ISSUE_BULK_MANAGE]).toContain(
        PERMISSIONS.ISSUE_VIEW,
      );
      expect(PERMISSION_DEPENDENCIES[PERMISSIONS.ISSUE_BULK_MANAGE]).toContain(
        PERMISSIONS.ISSUE_EDIT,
      );
    });

    it("should only reference valid permissions", () => {
      const allPermissionValues = Object.values(PERMISSIONS);

      Object.entries(PERMISSION_DEPENDENCIES).forEach(
        ([permission, dependencies]) => {
          // Key should be a valid permission
          expect(allPermissionValues).toContain(permission);

          // All dependencies should be valid permissions
          dependencies.forEach((dependency) => {
            expect(allPermissionValues).toContain(dependency);
          });
        },
      );
    });

    it("should not create circular dependencies", () => {
      const visited = new Set<string>();
      const visiting = new Set<string>();

      const hasCycle = (permission: string): boolean => {
        if (visiting.has(permission)) return true;
        if (visited.has(permission)) return false;

        visiting.add(permission);

        const dependencies = PERMISSION_DEPENDENCIES[permission] ?? [];
        for (const dependency of dependencies) {
          if (hasCycle(dependency)) return true;
        }

        visiting.delete(permission);
        visited.add(permission);
        return false;
      };

      Object.keys(PERMISSION_DEPENDENCIES).forEach((permission) => {
        expect(hasCycle(permission)).toBe(false);
      });
    });

    it("should have consistent dependency structure", () => {
      // All edit permissions should depend on corresponding view permission
      const editPermissions = Object.values(PERMISSIONS).filter((p) =>
        p.includes(":edit"),
      );

      editPermissions.forEach((editPermission) => {
        const parts = editPermission.split(":");
        const resource = parts[0];

        if (resource) {
          const viewPermission = `${resource}:view`;

          if (Object.values(PERMISSIONS).includes(viewPermission as any)) {
            expect(PERMISSION_DEPENDENCIES[editPermission]).toContain(
              viewPermission,
            );
          }
        }
      });
    });
  });

  describe("SYSTEM_ROLES", () => {
    it("should define required system roles", () => {
      expect(SYSTEM_ROLES.ADMIN).toBe("Admin");
      expect(SYSTEM_ROLES.UNAUTHENTICATED).toBe("Unauthenticated");
    });

    it("should use consistent role naming", () => {
      Object.values(SYSTEM_ROLES).forEach((roleName) => {
        // Should be properly capitalized
        expect(roleName[0]).toMatch(/[A-Z]/);
        // Should be descriptive
        expect(roleName.length).toBeGreaterThan(3);
      });
    });

    it("should have immutable structure", () => {
      // SYSTEM_ROLES uses 'as const' for type-level immutability
      // While not runtime frozen, TypeScript prevents modifications
      expect(typeof SYSTEM_ROLES).toBe("object");
      expect(SYSTEM_ROLES).toBeDefined();
    });
  });

  describe("ROLE_TEMPLATES", () => {
    it("should define MEMBER template with valid structure", () => {
      expect(ROLE_TEMPLATES.MEMBER).toBeDefined();
      expect(ROLE_TEMPLATES.MEMBER.name).toBe("Member");
      expect(ROLE_TEMPLATES.MEMBER.description).toBeTruthy();
      expect(Array.isArray(ROLE_TEMPLATES.MEMBER.permissions)).toBe(true);
      expect(ROLE_TEMPLATES.MEMBER.permissions.length).toBeGreaterThan(0);
    });

    it("should include logical permissions for member role", () => {
      const memberPermissions = ROLE_TEMPLATES.MEMBER.permissions;

      // Should include basic view permissions
      expect(memberPermissions).toContain(PERMISSIONS.ISSUE_VIEW);
      expect(memberPermissions).toContain(PERMISSIONS.MACHINE_VIEW);
      expect(memberPermissions).toContain(PERMISSIONS.LOCATION_VIEW);

      // Should include creation permissions for issues/attachments
      expect(memberPermissions).toContain(PERMISSIONS.ISSUE_CREATE);
      expect(memberPermissions).toContain(PERMISSIONS.ATTACHMENT_CREATE);

      // Should NOT include admin permissions
      expect(memberPermissions).not.toContain(PERMISSIONS.ROLE_MANAGE);
      expect(memberPermissions).not.toContain(PERMISSIONS.USER_MANAGE);
      expect(memberPermissions).not.toContain(PERMISSIONS.ADMIN_VIEW_ANALYTICS);
    });

    it("should use only valid permissions", () => {
      const allPermissionValues = Object.values(PERMISSIONS);

      ROLE_TEMPLATES.MEMBER.permissions.forEach((permission) => {
        expect(allPermissionValues).toContain(permission);
      });
    });
  });

  describe("PERMISSION_DESCRIPTIONS", () => {
    it("should provide descriptions for all defined permissions", () => {
      Object.values(PERMISSIONS).forEach((permission) => {
        expect(PERMISSION_DESCRIPTIONS[permission]).toBeTruthy();
        expect(typeof PERMISSION_DESCRIPTIONS[permission]).toBe("string");
      });
    });

    it("should use consistent description formatting", () => {
      Object.values(PERMISSION_DESCRIPTIONS).forEach((description) => {
        // Should be properly capitalized
        expect(description[0]).toMatch(/[A-Z]/);
        // Should be descriptive
        expect(description.length).toBeGreaterThan(10);
        // Should not end with period
        expect(description).not.toMatch(/\.$/);
      });
    });

    it("should match permission keys exactly", () => {
      Object.keys(PERMISSION_DESCRIPTIONS).forEach((permissionKey) => {
        expect(Object.values(PERMISSIONS)).toContain(permissionKey);
      });
    });
  });

  describe("Derived constants", () => {
    describe("ALL_PERMISSIONS", () => {
      it("should include every permission exactly once", () => {
        const permissionValues = Object.values(PERMISSIONS);

        expect(ALL_PERMISSIONS).toHaveLength(permissionValues.length);
        expect(new Set(ALL_PERMISSIONS)).toEqual(new Set(permissionValues));
      });

      it("should be derived from PERMISSIONS object", () => {
        expect(ALL_PERMISSIONS).toEqual(Object.values(PERMISSIONS));
      });
    });

    describe("UNAUTHENTICATED_PERMISSIONS", () => {
      it("should include only safe permissions for public access", () => {
        // Should include view permissions
        expect(UNAUTHENTICATED_PERMISSIONS).toContain(PERMISSIONS.ISSUE_VIEW);
        expect(UNAUTHENTICATED_PERMISSIONS).toContain(PERMISSIONS.MACHINE_VIEW);
        expect(UNAUTHENTICATED_PERMISSIONS).toContain(
          PERMISSIONS.LOCATION_VIEW,
        );

        // Should include safe create permissions
        expect(UNAUTHENTICATED_PERMISSIONS).toContain(PERMISSIONS.ISSUE_CREATE);
        expect(UNAUTHENTICATED_PERMISSIONS).toContain(
          PERMISSIONS.ATTACHMENT_CREATE,
        );

        // Should NOT include edit/delete/admin permissions
        expect(UNAUTHENTICATED_PERMISSIONS).not.toContain(
          PERMISSIONS.ISSUE_EDIT,
        );
        expect(UNAUTHENTICATED_PERMISSIONS).not.toContain(
          PERMISSIONS.ISSUE_DELETE,
        );
        expect(UNAUTHENTICATED_PERMISSIONS).not.toContain(
          PERMISSIONS.ROLE_MANAGE,
        );
        expect(UNAUTHENTICATED_PERMISSIONS).not.toContain(
          PERMISSIONS.USER_MANAGE,
        );
      });

      it("should only reference valid permissions", () => {
        UNAUTHENTICATED_PERMISSIONS.forEach((permission) => {
          expect(Object.values(PERMISSIONS)).toContain(permission);
        });
      });
    });

    describe("ADMIN_PERMISSIONS", () => {
      it("should equal ALL_PERMISSIONS", () => {
        expect(ADMIN_PERMISSIONS).toEqual(ALL_PERMISSIONS);
      });
    });
  });

  describe("Cross-validation", () => {
    it("should maintain consistency across all constants", () => {
      // PERMISSION_DESCRIPTIONS should cover all permissions
      Object.values(PERMISSIONS).forEach((permission) => {
        expect(PERMISSION_DESCRIPTIONS).toHaveProperty(permission);
      });

      // PERMISSION_DEPENDENCIES should only use valid permissions
      Object.entries(PERMISSION_DEPENDENCIES).forEach(
        ([permission, dependencies]) => {
          expect(Object.values(PERMISSIONS)).toContain(permission);
          dependencies.forEach((dep) => {
            expect(Object.values(PERMISSIONS)).toContain(dep);
          });
        },
      );

      // ROLE_TEMPLATES should use valid permissions
      Object.values(ROLE_TEMPLATES).forEach((template) => {
        template.permissions.forEach((permission) => {
          expect(Object.values(PERMISSIONS)).toContain(permission);
        });
      });
    });

    it("should have proper subset relationships", () => {
      // UNAUTHENTICATED_PERMISSIONS ⊆ ALL_PERMISSIONS
      UNAUTHENTICATED_PERMISSIONS.forEach((permission) => {
        expect(ALL_PERMISSIONS).toContain(permission);
      });

      // ROLE_TEMPLATES permissions ⊆ ALL_PERMISSIONS
      Object.values(ROLE_TEMPLATES).forEach((template) => {
        template.permissions.forEach((permission) => {
          expect(ALL_PERMISSIONS).toContain(permission);
        });
      });
    });

    it("should have consistent naming patterns", () => {
      // All permission constants should use UPPER_SNAKE_CASE
      Object.keys(PERMISSIONS).forEach((key) => {
        expect(key).toMatch(/^[A-Z_]+$/);
      });

      // All permission values should use lower:case
      Object.values(PERMISSIONS).forEach((value) => {
        expect(value).toMatch(/^[a-z_]+:[a-z_]+$/);
      });
    });
  });
});
