import { describe, it, expect } from "vitest";

import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVEL_DESCRIPTIONS,
  PERMISSIONS_MATRIX,
  PERMISSIONS_BY_ID,
  getPermission,
  hasPermission,
  requiresOwnershipCheck,
} from "~/lib/permissions/matrix";

/**
 * Unit tests for the permissions matrix.
 *
 * Tests the single source of truth for all permissions in the system.
 */

describe("ACCESS_LEVELS", () => {
  it("should define all five access levels in order", () => {
    expect(ACCESS_LEVELS).toEqual([
      "unauthenticated",
      "guest",
      "member",
      "technician",
      "admin",
    ]);
  });

  it("should have labels for all access levels", () => {
    for (const level of ACCESS_LEVELS) {
      expect(ACCESS_LEVEL_LABELS[level]).toBeDefined();
      expect(typeof ACCESS_LEVEL_LABELS[level]).toBe("string");
    }
  });

  it("should have descriptions for all access levels", () => {
    for (const level of ACCESS_LEVELS) {
      expect(ACCESS_LEVEL_DESCRIPTIONS[level]).toBeDefined();
      expect(typeof ACCESS_LEVEL_DESCRIPTIONS[level]).toBe("string");
    }
  });
});

describe("PERMISSIONS_MATRIX", () => {
  it("should have all expected categories", () => {
    const categoryIds = PERMISSIONS_MATRIX.map((c) => c.id);
    expect(categoryIds).toContain("issues");
    expect(categoryIds).toContain("comments");
    expect(categoryIds).toContain("machines");
    expect(categoryIds).toContain("images");
    expect(categoryIds).toContain("admin");
  });

  it("should have valid permission definitions", () => {
    for (const category of PERMISSIONS_MATRIX) {
      expect(category.id).toBeDefined();
      expect(category.label).toBeDefined();
      expect(Array.isArray(category.permissions)).toBe(true);

      for (const permission of category.permissions) {
        expect(permission.id).toBeDefined();
        expect(permission.label).toBeDefined();
        expect(permission.description).toBeDefined();
        expect(permission.access).toBeDefined();

        // Every permission should have all access levels defined
        for (const level of ACCESS_LEVELS) {
          const value = permission.access[level];
          // Type system guarantees value is PermissionValue (boolean | "own" | "owner")
          // Just verify it's defined
          expect(value).toBeDefined();
        }
      }
    }
  });

  it("should have unique permission IDs", () => {
    const allIds: string[] = [];
    for (const category of PERMISSIONS_MATRIX) {
      for (const permission of category.permissions) {
        expect(allIds).not.toContain(permission.id);
        allIds.push(permission.id);
      }
    }
  });
});

describe("PERMISSIONS_BY_ID", () => {
  it("should contain all permissions from the matrix", () => {
    let count = 0;
    for (const category of PERMISSIONS_MATRIX) {
      for (const permission of category.permissions) {
        expect(PERMISSIONS_BY_ID[permission.id]).toBeDefined();
        expect(PERMISSIONS_BY_ID[permission.id]).toBe(permission);
        count++;
      }
    }
    expect(Object.keys(PERMISSIONS_BY_ID).length).toBe(count);
  });
});

describe("getPermission", () => {
  it("should return correct permission values", () => {
    // Issues can be viewed by anyone
    expect(getPermission("issues.view", "unauthenticated")).toBe(true);
    expect(getPermission("issues.view", "guest")).toBe(true);
    expect(getPermission("issues.view", "member")).toBe(true);
    expect(getPermission("issues.view", "admin")).toBe(true);
  });

  it("should return false for unknown permissions", () => {
    expect(getPermission("nonexistent.permission", "admin")).toBe(false);
  });

  it("should return conditional values for ownership-based permissions", () => {
    // Guests can only update their own issues
    expect(getPermission("issues.update.status", "guest")).toBe("own");
    expect(getPermission("issues.update.status", "member")).toBe(true);

    // Members can only edit machines they own
    expect(getPermission("machines.edit", "member")).toBe("owner");
    expect(getPermission("machines.edit", "admin")).toBe(true);
  });
});

describe("hasPermission", () => {
  it("should return true for simple allowed permissions", () => {
    expect(hasPermission("issues.view", "unauthenticated")).toBe(true);
    expect(hasPermission("comments.add", "guest")).toBe(true);
    expect(hasPermission("admin.access", "admin")).toBe(true);
  });

  it("should return false for denied permissions", () => {
    expect(hasPermission("comments.add", "unauthenticated")).toBe(false);
    expect(hasPermission("machines.create", "member")).toBe(false);
    expect(hasPermission("admin.access", "member")).toBe(false);
  });

  it("should throw for ownership-based permissions to prevent silent bugs", () => {
    // hasPermission throws for 'own'/'owner' values to force callers to use
    // requiresOwnershipCheck() or checkPermission() from helpers.ts
    expect(() => hasPermission("issues.update.status", "guest")).toThrow(
      /ownership-based permissions/
    );
    expect(() => hasPermission("machines.edit", "member")).toThrow(
      /ownership-based permissions/
    );
  });
});

describe("requiresOwnershipCheck", () => {
  it("should return true for ownership-based permissions", () => {
    expect(requiresOwnershipCheck("issues.update.status", "guest")).toBe(true);
    expect(requiresOwnershipCheck("issues.update.severity", "guest")).toBe(
      true
    );
    expect(requiresOwnershipCheck("machines.edit", "member")).toBe(true);
  });

  it("should return false for simple boolean permissions", () => {
    expect(requiresOwnershipCheck("issues.view", "unauthenticated")).toBe(
      false
    );
    expect(requiresOwnershipCheck("issues.update.status", "member")).toBe(
      false
    );
    expect(requiresOwnershipCheck("admin.access", "admin")).toBe(false);
    expect(requiresOwnershipCheck("machines.create", "member")).toBe(false);
  });
});

describe("Permission hierarchy", () => {
  // Permissions where admin intentionally does NOT escalate beyond technician.
  // - ownerNotes: privacy-scoped to machine owner, even admins can't see/edit
  // - comments.edit/delete: all roles are "own" only; admin deleting others'
  //   comments is handled by the separate "comments.delete.any" permission
  const noAdminEscalation = new Set([
    "machines.edit.ownerNotes",
    "machines.view.ownerNotes",
    "comments.edit",
    "comments.delete",
  ]);

  it("should grant admin all permissions that technician has (except excluded)", () => {
    for (const category of PERMISSIONS_MATRIX) {
      for (const permission of category.permissions) {
        if (noAdminEscalation.has(permission.id)) continue;

        const techValue = permission.access.technician;
        const adminValue = permission.access.admin;

        // If technician has permission, admin should too
        if (techValue === true) {
          expect(adminValue).toBe(true);
        }
        // If technician has conditional, admin should have full
        if (techValue === "own" || techValue === "owner") {
          expect(adminValue).toBe(true);
        }
      }
    }
  });

  it("should grant technician all permissions that member has", () => {
    for (const category of PERMISSIONS_MATRIX) {
      for (const permission of category.permissions) {
        const memberValue = permission.access.member;
        const techValue = permission.access.technician;

        // If member has unconditional permission, technician should too (unconditional)
        if (memberValue === true) {
          expect(techValue).toBe(true);
        }

        // If member has conditional permission, technician should have at least the same
        if (memberValue === "own" || memberValue === "owner") {
          expect(
            techValue === true || techValue === "own" || techValue === "owner"
          ).toBe(true);
        }
      }
    }
  });

  it("should grant member all permissions that guest has", () => {
    for (const category of PERMISSIONS_MATRIX) {
      for (const permission of category.permissions) {
        const guestValue = permission.access.guest;
        const memberValue = permission.access.member;

        // If guest has unconditional permission, member should too
        if (guestValue === true) {
          expect(
            memberValue === true ||
              memberValue === "own" ||
              memberValue === "owner"
          ).toBe(true);
        }

        // If guest has conditional permission, member should have at least the same
        if (guestValue === "own" || guestValue === "owner") {
          expect(
            memberValue === true ||
              memberValue === "own" ||
              memberValue === "owner"
          ).toBe(true);
        }
      }
    }
  });
});

describe("Specific permission rules from design", () => {
  describe("Issue reporting", () => {
    it("should allow anyone to report issues", () => {
      expect(getPermission("issues.report", "unauthenticated")).toBe(true);
      expect(getPermission("issues.report", "guest")).toBe(true);
    });

    it("should only allow members+ to set workflow fields when reporting", () => {
      // Status, priority, assignee hidden for unauth/guest
      expect(getPermission("issues.report.status", "unauthenticated")).toBe(
        false
      );
      expect(getPermission("issues.report.status", "guest")).toBe(false);
      expect(getPermission("issues.report.status", "member")).toBe(true);

      expect(getPermission("issues.report.priority", "unauthenticated")).toBe(
        false
      );
      expect(getPermission("issues.report.priority", "guest")).toBe(false);
      expect(getPermission("issues.report.priority", "member")).toBe(true);

      expect(getPermission("issues.report.assignee", "unauthenticated")).toBe(
        false
      );
      expect(getPermission("issues.report.assignee", "guest")).toBe(false);
      expect(getPermission("issues.report.assignee", "member")).toBe(true);
    });
  });

  describe("Issue updates", () => {
    it("should allow guests to update their own issues (descriptive + status)", () => {
      expect(getPermission("issues.update.severity", "guest")).toBe("own");
      expect(getPermission("issues.update.frequency", "guest")).toBe("own");
      expect(getPermission("issues.update.status", "guest")).toBe("own");
    });

    it("should not allow guests to update workflow fields", () => {
      expect(getPermission("issues.update.priority", "guest")).toBe(false);
      expect(getPermission("issues.update.assignee", "guest")).toBe(false);
    });

    it("should allow members and technicians to update any issue", () => {
      for (const role of ["member", "technician"] as const) {
        expect(getPermission("issues.update.severity", role)).toBe(true);
        expect(getPermission("issues.update.frequency", role)).toBe(true);
        expect(getPermission("issues.update.status", role)).toBe(true);
        expect(getPermission("issues.update.priority", role)).toBe(true);
        expect(getPermission("issues.update.assignee", role)).toBe(true);
      }
    });
  });

  describe("Comments", () => {
    it("should allow viewing comments by anyone", () => {
      expect(getPermission("comments.view", "unauthenticated")).toBe(true);
    });

    it("should require authentication to add comments", () => {
      expect(getPermission("comments.add", "unauthenticated")).toBe(false);
      expect(getPermission("comments.add", "guest")).toBe(true);
    });

    it("should only allow editing own comments for all roles", () => {
      expect(getPermission("comments.edit", "unauthenticated")).toBe(false);
      expect(getPermission("comments.edit", "guest")).toBe("own");
      expect(getPermission("comments.edit", "member")).toBe("own");
      expect(getPermission("comments.edit", "technician")).toBe("own");
      expect(getPermission("comments.edit", "admin")).toBe("own");
    });

    it("should only allow deleting own comments for all roles", () => {
      expect(getPermission("comments.delete", "unauthenticated")).toBe(false);
      expect(getPermission("comments.delete", "guest")).toBe("own");
      expect(getPermission("comments.delete", "member")).toBe("own");
      expect(getPermission("comments.delete", "technician")).toBe("own");
      expect(getPermission("comments.delete", "admin")).toBe("own");
    });

    it("should only allow admin to delete others comments", () => {
      expect(getPermission("comments.delete.any", "guest")).toBe(false);
      expect(getPermission("comments.delete.any", "member")).toBe(false);
      expect(getPermission("comments.delete.any", "technician")).toBe(false);
      expect(getPermission("comments.delete.any", "admin")).toBe(true);
    });
  });

  describe("Machines", () => {
    it("should allow admin and technician to create machines", () => {
      expect(getPermission("machines.create", "guest")).toBe(false);
      expect(getPermission("machines.create", "member")).toBe(false);
      expect(getPermission("machines.create", "technician")).toBe(true);
      expect(getPermission("machines.create", "admin")).toBe(true);
    });

    it("should allow machine owners, technicians, and admins to edit machines", () => {
      expect(getPermission("machines.edit", "guest")).toBe(false);
      expect(getPermission("machines.edit", "member")).toBe("owner");
      expect(getPermission("machines.edit", "technician")).toBe(true);
      expect(getPermission("machines.edit", "admin")).toBe(true);
    });

    it("should require authentication to watch machines", () => {
      expect(getPermission("machines.watch", "unauthenticated")).toBe(false);
      expect(getPermission("machines.watch", "guest")).toBe(true);
    });

    it("should allow owner-only access for ownerNotes editing", () => {
      expect(getPermission("machines.edit.ownerNotes", "unauthenticated")).toBe(
        false
      );
      expect(getPermission("machines.edit.ownerNotes", "guest")).toBe(false);
      expect(getPermission("machines.edit.ownerNotes", "member")).toBe("owner");
      expect(getPermission("machines.edit.ownerNotes", "technician")).toBe(
        "owner"
      );
      expect(getPermission("machines.edit.ownerNotes", "admin")).toBe("owner");
    });

    it("should allow owner-only access for viewing ownerNotes", () => {
      expect(getPermission("machines.view.ownerNotes", "unauthenticated")).toBe(
        false
      );
      expect(getPermission("machines.view.ownerNotes", "guest")).toBe(false);
      expect(getPermission("machines.view.ownerNotes", "member")).toBe("owner");
      expect(getPermission("machines.view.ownerNotes", "technician")).toBe(
        "owner"
      );
      expect(getPermission("machines.view.ownerNotes", "admin")).toBe("owner");
    });

    it("should allow authenticated users to view ownerRequirements", () => {
      expect(
        getPermission("machines.view.ownerRequirements", "unauthenticated")
      ).toBe(false);
      expect(getPermission("machines.view.ownerRequirements", "guest")).toBe(
        true
      );
      expect(getPermission("machines.view.ownerRequirements", "member")).toBe(
        true
      );
      expect(
        getPermission("machines.view.ownerRequirements", "technician")
      ).toBe(true);
      expect(getPermission("machines.view.ownerRequirements", "admin")).toBe(
        true
      );
    });
  });

  describe("Admin", () => {
    it("should only allow admin to access admin features", () => {
      expect(getPermission("admin.access", "guest")).toBe(false);
      expect(getPermission("admin.access", "member")).toBe(false);
      expect(getPermission("admin.access", "technician")).toBe(false);
      expect(getPermission("admin.access", "admin")).toBe(true);

      expect(getPermission("admin.users.invite", "member")).toBe(false);
      expect(getPermission("admin.users.invite", "technician")).toBe(false);
      expect(getPermission("admin.users.invite", "admin")).toBe(true);

      expect(getPermission("admin.users.roles", "member")).toBe(false);
      expect(getPermission("admin.users.roles", "technician")).toBe(false);
      expect(getPermission("admin.users.roles", "admin")).toBe(true);
    });
  });
});
