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
    expect(getAccessLevel("technician")).toBe("technician");
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
      expect(checkPermission("issues.update.reporting", "guest", context)).toBe(
        true
      );
    });

    it("should deny guest updating others issue", () => {
      const context: OwnershipContext = {
        userId,
        reporterId: otherUserId, // Different user
      };
      expect(checkPermission("issues.update.reporting", "guest", context)).toBe(
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
      expect(checkPermission("issues.update.reporting", "guest")).toBe(false);
      expect(checkPermission("machines.edit", "member")).toBe(false);
    });

    it("should resolve machines.settings.manage by ownership for members (PP-43q3)", () => {
      const asOwner: OwnershipContext = { userId, machineOwnerId: userId };
      const asNonOwner: OwnershipContext = {
        userId,
        machineOwnerId: otherUserId,
      };
      // Member: only their own machine.
      expect(
        checkPermission("machines.settings.manage", "member", asOwner)
      ).toBe(true);
      expect(
        checkPermission("machines.settings.manage", "member", asNonOwner)
      ).toBe(false);
      // Technician/admin: any machine, ownership irrelevant.
      expect(
        checkPermission("machines.settings.manage", "technician", asNonOwner)
      ).toBe(true);
      expect(
        checkPermission("machines.settings.manage", "admin", asNonOwner)
      ).toBe(true);
    });

    it("should deny if userId not provided for conditional permission", () => {
      const context: OwnershipContext = {
        reporterId: userId,
      };
      expect(checkPermission("issues.update.reporting", "guest", context)).toBe(
        false
      );
    });
  });

  describe("technician role specific permissions", () => {
    it("should allow technician to create machines", () => {
      expect(checkPermission("machines.create", "technician")).toBe(true);
    });

    it("should allow technician to edit any machine without ownership", () => {
      const context: OwnershipContext = {
        userId,
        machineOwnerId: otherUserId, // Owned by someone else
      };
      expect(checkPermission("machines.edit", "technician", context)).toBe(
        true
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
    expect(checkPermission("issues.update.reporting", "guest", context)).toBe(
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
    const state = getPermissionState(
      "issues.update.reporting",
      "guest",
      context
    );
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
    const state = getPermissionState(
      "issues.update.reporting",
      "guest",
      context
    );
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

  it("should return technician/admin message for member role denial", () => {
    const reason = getPermissionDeniedReason("machines.create", "member");
    expect(reason).toContain("Technicians");
  });

  it("should return admin message for technician role denial", () => {
    const reason = getPermissionDeniedReason("admin.access", "technician");
    expect(reason).toContain("admin");
  });

  it("should return ownership message for ownership denial", () => {
    const context: OwnershipContext = {
      userId: "user-123",
      reporterId: "other-user",
    };
    const reason = getPermissionDeniedReason(
      "issues.update.reporting",
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
    expect(isConditionalPermission("issues.update.reporting", "guest")).toBe(
      true
    );
  });

  it("should return true for owner-based permissions", () => {
    expect(isConditionalPermission("machines.edit", "member")).toBe(true);
  });

  it("should return false for boolean permissions", () => {
    expect(isConditionalPermission("issues.view", "guest")).toBe(false);
    expect(isConditionalPermission("issues.update.reporting", "member")).toBe(
      false
    );
    expect(isConditionalPermission("admin.access", "admin")).toBe(false);
  });
});

describe("Integration: Comment ownership flow", () => {
  const userId = "user-123";
  const otherUserId = "user-456";

  it("should allow guest to edit own comment via ownership check", () => {
    const context: OwnershipContext = {
      userId,
      reporterId: userId, // reporterId maps to comment author for "own" checks
    };
    expect(checkPermission("comments.edit", "guest", context)).toBe(true);
    expect(checkPermission("comments.delete", "guest", context)).toBe(true);
  });

  it("should deny guest editing others comments", () => {
    const context: OwnershipContext = {
      userId,
      reporterId: otherUserId,
    };
    expect(checkPermission("comments.edit", "guest", context)).toBe(false);
    expect(checkPermission("comments.delete", "guest", context)).toBe(false);
  });

  it("should allow member to edit/delete only own comments", () => {
    const ownContext: OwnershipContext = { userId, reporterId: userId };
    const otherContext: OwnershipContext = { userId, reporterId: otherUserId };
    expect(checkPermission("comments.edit", "member", ownContext)).toBe(true);
    expect(checkPermission("comments.delete", "member", ownContext)).toBe(true);
    expect(checkPermission("comments.edit", "member", otherContext)).toBe(
      false
    );
    expect(checkPermission("comments.delete", "member", otherContext)).toBe(
      false
    );
  });

  it("should allow technician to edit/delete only own comments", () => {
    const ownContext: OwnershipContext = { userId, reporterId: userId };
    const otherContext: OwnershipContext = { userId, reporterId: otherUserId };
    expect(checkPermission("comments.edit", "technician", ownContext)).toBe(
      true
    );
    expect(checkPermission("comments.delete", "technician", ownContext)).toBe(
      true
    );
    expect(checkPermission("comments.edit", "technician", otherContext)).toBe(
      false
    );
    expect(checkPermission("comments.delete", "technician", otherContext)).toBe(
      false
    );
  });

  it("should allow admin to edit/delete only own comments", () => {
    const ownContext: OwnershipContext = { userId, reporterId: userId };
    const otherContext: OwnershipContext = { userId, reporterId: otherUserId };
    expect(checkPermission("comments.edit", "admin", ownContext)).toBe(true);
    expect(checkPermission("comments.delete", "admin", ownContext)).toBe(true);
    expect(checkPermission("comments.edit", "admin", otherContext)).toBe(false);
    expect(checkPermission("comments.delete", "admin", otherContext)).toBe(
      false
    );
  });

  it("should deny unauthenticated from editing any comment", () => {
    expect(checkPermission("comments.edit", "unauthenticated")).toBe(false);
    expect(checkPermission("comments.delete", "unauthenticated")).toBe(false);
  });
});

describe("Integration: Machine text field permissions", () => {
  it("should allow any authenticated user to view ownerRequirements", () => {
    expect(checkPermission("machines.view.ownerRequirements", "guest")).toBe(
      true
    );
    expect(checkPermission("machines.view.ownerRequirements", "member")).toBe(
      true
    );
    expect(checkPermission("machines.view.ownerRequirements", "admin")).toBe(
      true
    );
  });

  it("should deny unauthenticated users from viewing ownerRequirements", () => {
    expect(
      checkPermission("machines.view.ownerRequirements", "unauthenticated")
    ).toBe(false);
  });
});

describe("checkPermission - own_or_owner scope (PP-0x98)", () => {
  const authorId = "user-author";
  const ownerId = "user-machine-owner";
  const thirdPartyId = "user-third-party";

  it("allows the comment author to delete (reporterId match)", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "member", {
        userId: authorId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(true);
  });

  it("allows the machine owner to delete any comment (machineOwnerId match)", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "member", {
        userId: ownerId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(true);
  });

  it("denies a third party who is neither author nor machine owner", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "member", {
        userId: thirdPartyId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(false);
  });

  it("denies when context.userId is undefined", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "member", {
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(false);
  });

  it("denies when no context is provided", () => {
    expect(checkPermission("machines.timeline.comment.delete", "member")).toBe(
      false
    );
  });

  it("denies when both reporterId and machineOwnerId are null", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "member", {
        userId: authorId,
        reporterId: null,
        machineOwnerId: null,
      })
    ).toBe(false);
  });

  it("admin override: admins always allowed without ownership context", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "admin", {
        userId: thirdPartyId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(true);
    // Even without any context at all
    expect(checkPermission("machines.timeline.comment.delete", "admin")).toBe(
      true
    );
  });

  it("denies guest and unauthenticated regardless of authorship", () => {
    const context: OwnershipContext = {
      userId: authorId,
      reporterId: authorId,
      machineOwnerId: authorId,
    };
    expect(
      checkPermission("machines.timeline.comment.delete", "guest", context)
    ).toBe(false);
    expect(
      checkPermission("machines.timeline.comment.delete", "unauthenticated")
    ).toBe(false);
  });

  it("technician with own_or_owner scope: author path allowed", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "technician", {
        userId: authorId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(true);
  });

  it("technician with own_or_owner scope: machine-owner path allowed", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "technician", {
        userId: ownerId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(true);
  });

  it("technician with own_or_owner scope: third party denied", () => {
    expect(
      checkPermission("machines.timeline.comment.delete", "technician", {
        userId: thirdPartyId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      })
    ).toBe(false);
  });
});

describe("getPermissionState - own_or_owner scope (PP-0x98)", () => {
  const authorId = "user-author";
  const ownerId = "user-machine-owner";
  const thirdPartyId = "user-third-party";

  it("returns allowed: true on author path", () => {
    const state = getPermissionState(
      "machines.timeline.comment.delete",
      "member",
      {
        userId: authorId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      }
    );
    expect(state.allowed).toBe(true);
  });

  it("returns allowed: true on machine-owner path", () => {
    const state = getPermissionState(
      "machines.timeline.comment.delete",
      "member",
      {
        userId: ownerId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      }
    );
    expect(state.allowed).toBe(true);
  });

  it("returns reason: ownership for third party", () => {
    const state = getPermissionState(
      "machines.timeline.comment.delete",
      "member",
      {
        userId: thirdPartyId,
        reporterId: authorId,
        machineOwnerId: ownerId,
      }
    );
    expect(state.allowed).toBe(false);
    if (!state.allowed) {
      expect(state.reason).toBe("ownership");
    }
  });
});

describe("isConditionalPermission - own_or_owner scope (PP-0x98)", () => {
  it("returns true for own_or_owner permissions", () => {
    expect(
      isConditionalPermission("machines.timeline.comment.delete", "member")
    ).toBe(true);
    expect(
      isConditionalPermission("machines.timeline.comment.delete", "technician")
    ).toBe(true);
  });

  it("returns false for admin (which has true, not own_or_owner)", () => {
    expect(
      isConditionalPermission("machines.timeline.comment.delete", "admin")
    ).toBe(false);
  });
});

describe("machines.timeline.comment.add (PP-0x98)", () => {
  it("denies unauthenticated and guest", () => {
    expect(
      checkPermission("machines.timeline.comment.add", "unauthenticated")
    ).toBe(false);
    expect(checkPermission("machines.timeline.comment.add", "guest")).toBe(
      false
    );
  });

  it("allows member, technician, and admin without ownership context", () => {
    expect(checkPermission("machines.timeline.comment.add", "member")).toBe(
      true
    );
    expect(checkPermission("machines.timeline.comment.add", "technician")).toBe(
      true
    );
    expect(checkPermission("machines.timeline.comment.add", "admin")).toBe(
      true
    );
  });
});

describe("Integration: Guest issue update flow", () => {
  const guestId = "guest-user";
  const memberId = "member-user";

  it("should allow guest to update reporting fields on own issue", () => {
    const context: OwnershipContext = {
      userId: guestId,
      reporterId: guestId,
    };

    expect(checkPermission("issues.update.reporting", "guest", context)).toBe(
      true
    );
  });

  it("should deny guest triage fields even on own issue", () => {
    const context: OwnershipContext = {
      userId: guestId,
      reporterId: guestId,
    };

    expect(checkPermission("issues.update.triage", "guest", context)).toBe(
      false
    );
  });

  it("should allow member to update any issue (both tiers)", () => {
    const context: OwnershipContext = {
      userId: memberId,
      reporterId: guestId, // Issue reported by someone else
    };

    expect(checkPermission("issues.update.reporting", "member", context)).toBe(
      true
    );
    expect(checkPermission("issues.update.triage", "member", context)).toBe(
      true
    );
  });
});
