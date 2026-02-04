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

describe("Role defaults", () => {
  describe("userProfiles.role", () => {
    it("should default to 'guest' for new signups", () => {
      // Access the default value from the Drizzle column definition
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

  describe("Role hierarchy intent", () => {
    it("should have guest as lowest permission level (default for untrusted signups)", () => {
      // Document the intent: guest < member < admin
      const roleColumn = userProfiles.role;
      expect(roleColumn.default).toBe("guest");
    });

    it("should have member as trusted level (default for invited users)", () => {
      // Invited users are trusted, so they get member access
      const roleColumn = invitedUsers.role;
      expect(roleColumn.default).toBe("member");
    });
  });
});
