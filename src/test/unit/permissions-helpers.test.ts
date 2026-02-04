import { describe, it, expect } from "vitest";

import {
  getAccessLevel,
  checkPermission,
  getPermissionState,
  getPermissionDeniedReason,
  checkPermissions,
  checkAnyPermission,
  isConditionalPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";

/**
 * Unit tests for permission helper utilities.
 *
 * Tests the functions that check permissions with ownership context.
 */

describe("getAccessLevel", () => {
  it("should return unauthenticated for null/undefined", () => {
    expect(getAccessLevel(null)).toBe("unauthenticated");
    expect(getAccessLevel(undefined)).toBe("unauthenticated");
  });

  it("should return the role for valid roles", () => {
    expect(getAccessLevel("guest")).toBe("guest");
    expect(getAccessLevel("member")).toBe("member");
    expect(getAccessLevel("admin")).toBe("admin");
  });
});

describe("checkPermission", () => {
  const userId = "user-123";
  const otherUserId = "user-456";

  it("should return true for simple allowed permissions", () => {
    expect(checkPermission("issues.view", "unauthenticated")).toBe(true);
    expect(checkPermission("comments.add", "guest")).toBe(true);
    expect(checkPermission("admin.access", "admin")).toBe(true);
  });

  it("should return false for denied permissions", () => {
    expect(checkPermission("comments.add", "unauthenticated")).toBe(false);
    expect(checkPermission("machines.create", "member")).toBe(false);
  });

  describe("ownership-based permissions", () => {
    it("should allow guest to update own issue", () => {
      const context: OwnershipContext = {
        userId,
        reporterId: userId, // Same as user - owns the issue
      };
      expect(checkPermission("issues.update.status", "guest", context)).toBe(
        true
      );
    });

    it("should deny guest updating others issue", () => {
      const context: OwnershipContext = {
        userId,
        reporterId: otherUserId, // Different user
      };
      expect(checkPermission("issues.update.status", "guest", context)).toBe(
        false
      );
    });

    it("should allow member to edit their own machine", () => {
      const context: OwnershipContext = {
        userId,
        machineOwnerId: userId,
      };
      expect(checkPermission("machines.edit", "member", context)).toBe(true);
    });

    it("should deny member editing others machine", () => {
      const context: OwnershipContext = {
        userId,
        machineOwnerId: otherUserId,
      };
      expect(checkPermission("machines.edit", "member", context)).toBe(false);
    });

    it("should deny if no context provided for conditional permission", () => {
      expect(checkPermission("issues.update.status", "guest")).toBe(false);
      expect(checkPermission("machines.edit", "member")).toBe(false);
    });

    it("should deny if userId not provided for conditional permission", () => {
      const context: OwnershipContext = {
        reporterId: userId,
      };
      expect(checkPermission("issues.update.status", "guest", context)).toBe(
        false
      );
    });
  });

  it("should handle null reporterId/machineOwnerId", () => {
    const context: OwnershipContext = {
      userId,
      reporterId: null,
      machineOwnerId: null,
    };
    // null !== userId, so should be false
    expect(checkPermission("issues.update.status", "guest", context)).toBe(
      false
    );
    expect(checkPermission("machines.edit", "member", context)).toBe(false);
  });
});

describe("getPermissionState", () => {
  const userId = "user-123";

  it("should return allowed: true for granted permissions", () => {
    const state = getPermissionState("issues.view", "guest");
    expect(state.allowed).toBe(true);
  });

  it("should return reason: unauthenticated for unauthenticated users", () => {
    const state = getPermissionState("comments.add", "unauthenticated");
    expect(state.allowed).toBe(false);
    if (!state.allowed) {
      expect(state.reason).toBe("unauthenticated");
    }
  });

  it("should return reason: role for role-based denial", () => {
    const state = getPermissionState("machines.create", "member");
    expect(state.allowed).toBe(false);
    if (!state.allowed) {
      expect(state.reason).toBe("role");
    }
  });

  it("should return reason: ownership for ownership-based denial", () => {
    const context: OwnershipContext = {
      userId,
      reporterId: "other-user",
    };
    const state = getPermissionState("issues.update.status", "guest", context);
    expect(state.allowed).toBe(false);
    if (!state.allowed) {
      expect(state.reason).toBe("ownership");
    }
  });

  it("should return allowed: true for ownership match", () => {
    const context: OwnershipContext = {
      userId,
      reporterId: userId,
    };
    const state = getPermissionState("issues.update.status", "guest", context);
    expect(state.allowed).toBe(true);
  });
});

describe("getPermissionDeniedReason", () => {
  it("should return null for granted permissions", () => {
    expect(getPermissionDeniedReason("issues.view", "guest")).toBeNull();
  });

  it("should return login message for unauthenticated users", () => {
    const reason = getPermissionDeniedReason("comments.add", "unauthenticated");
    expect(reason).toContain("Log in");
  });

  it("should return member message for guest role denial", () => {
    const reason = getPermissionDeniedReason("machines.create", "guest");
    expect(reason).toContain("Members");
  });

  it("should return ownership message for ownership denial", () => {
    const context: OwnershipContext = {
      userId: "user-123",
      reporterId: "other-user",
    };
    const reason = getPermissionDeniedReason(
      "issues.update.status",
      "guest",
      context
    );
    expect(reason).toContain("owner");
  });
});

describe("checkPermissions", () => {
  it("should return true if all permissions are granted", () => {
    expect(
      checkPermissions(["issues.view", "issues.report"], "unauthenticated")
    ).toBe(true);
  });

  it("should return false if any permission is denied", () => {
    expect(
      checkPermissions(["issues.view", "comments.add"], "unauthenticated")
    ).toBe(false);
  });

  it("should return true for empty array", () => {
    expect(checkPermissions([], "unauthenticated")).toBe(true);
  });
});

describe("checkAnyPermission", () => {
  it("should return true if any permission is granted", () => {
    expect(
      checkAnyPermission(["comments.add", "issues.view"], "unauthenticated")
    ).toBe(true);
  });

  it("should return false if no permission is granted", () => {
    expect(
      checkAnyPermission(["comments.add", "machines.create"], "unauthenticated")
    ).toBe(false);
  });

  it("should return false for empty array", () => {
    expect(checkAnyPermission([], "unauthenticated")).toBe(false);
  });
});

describe("isConditionalPermission", () => {
  it("should return true for own-based permissions", () => {
    expect(isConditionalPermission("issues.update.status", "guest")).toBe(true);
  });

  it("should return true for owner-based permissions", () => {
    expect(isConditionalPermission("machines.edit", "member")).toBe(true);
  });

  it("should return false for boolean permissions", () => {
    expect(isConditionalPermission("issues.view", "guest")).toBe(false);
    expect(isConditionalPermission("issues.update.status", "member")).toBe(
      false
    );
    expect(isConditionalPermission("admin.access", "admin")).toBe(false);
  });
});

describe("Integration: Guest issue update flow", () => {
  const guestId = "guest-user";
  const memberId = "member-user";

  it("should allow guest to update all descriptive fields on own issue", () => {
    const context: OwnershipContext = {
      userId: guestId,
      reporterId: guestId,
    };

    expect(checkPermission("issues.update.severity", "guest", context)).toBe(
      true
    );
    expect(checkPermission("issues.update.frequency", "guest", context)).toBe(
      true
    );
    expect(checkPermission("issues.update.status", "guest", context)).toBe(
      true
    );
  });

  it("should deny guest workflow fields even on own issue", () => {
    const context: OwnershipContext = {
      userId: guestId,
      reporterId: guestId,
    };

    // Priority and assignee are always denied for guests
    expect(checkPermission("issues.update.priority", "guest", context)).toBe(
      false
    );
    expect(checkPermission("issues.update.assignee", "guest", context)).toBe(
      false
    );
  });

  it("should allow member to update any issue", () => {
    const context: OwnershipContext = {
      userId: memberId,
      reporterId: guestId, // Issue reported by someone else
    };

    expect(checkPermission("issues.update.severity", "member", context)).toBe(
      true
    );
    expect(checkPermission("issues.update.priority", "member", context)).toBe(
      true
    );
    expect(checkPermission("issues.update.status", "member", context)).toBe(
      true
    );
  });
});
