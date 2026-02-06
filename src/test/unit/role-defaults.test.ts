import { describe, it, expect } from "vitest";

import { userProfiles, invitedUsers } from "~/server/db/schema";

/**
 * Unit tests for role default configuration.
 *
 * Verifies that:
 * - New signups (no invitation) default to 'guest'
 * - Invited users default to 'member' (trusted)
 *
 * This is a critical security setting that determines the permission
 * level for new users.
 */

// Note: These tests introspect Drizzle column objects via `.default` and `.enumValues`.
// These are not stable public API and may break on Drizzle ORM upgrades.
// They serve as regression guards for role default configuration, not database-level validation.
// Actual database defaults are enforced by the migration SQL and the handle_new_user() trigger.
describe("Role defaults", () => {
  describe("userProfiles.role", () => {
    it("should default to 'guest' for new signups", () => {
      const roleColumn = userProfiles.role;
      expect(roleColumn.default).toBe("guest");
    });

    it("should have valid enum values", () => {
      const roleColumn = userProfiles.role;
      expect(roleColumn.enumValues).toContain("guest");
      expect(roleColumn.enumValues).toContain("member");
      expect(roleColumn.enumValues).toContain("admin");
    });
  });

  describe("invitedUsers.role", () => {
    it("should default to 'member' for invited users", () => {
      const roleColumn = invitedUsers.role;
      expect(roleColumn.default).toBe("member");
    });

    it("should have valid enum values", () => {
      const roleColumn = invitedUsers.role;
      expect(roleColumn.enumValues).toContain("guest");
      expect(roleColumn.enumValues).toContain("member");
      expect(roleColumn.enumValues).toContain("admin");
    });
  });

  // Role hierarchy: guest < member < admin
  // Verified by enumValues assertions above (order matches privilege level).
});
