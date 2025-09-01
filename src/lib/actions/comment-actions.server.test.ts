/**
 * Comment Server Actions Tests - Permission behavior
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { addCommentAction } from "./comment-actions";

vi.mock("./shared", async () => {
  const actual = await vi.importActual("./shared");
  return {
    ...actual,
    requireAuthContextWithRole: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("~/server/db/provider", () => ({
  getGlobalDatabaseProvider: vi.fn(() => ({
    getClient: vi.fn(() => ({
      query: {
        issues: {
          findFirst: vi.fn().mockResolvedValue({ id: "issue-1" }),
        },
      },
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    })),
  })),
}));

vi.mock("~/lib/services/notification-generator", () => ({
  generateCommentNotifications: vi.fn(),
}));

// Spyable permission module to assert not used by addCommentAction
vi.mock("~/server/auth/permissions", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    requirePermission: vi.fn(),
  };
});

const { requireAuthContextWithRole } = await import("./shared");
const mockRequireAuthContextWithRole = vi.mocked(requireAuthContextWithRole);
const { requirePermission } = await import("~/server/auth/permissions");
const mockRequirePermission = vi.mocked(requirePermission);

describe("addCommentAction permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthContextWithRole.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" } as any,
      organizationId: "org-1",
      membership: { roleId: "role-1" } as any,
      role: { id: "role-1", name: "Member" } as any,
      permissions: [],
    } as any);
  });

  it("allows commenting for users who can view the issue (no ISSUE_CREATE required)", async () => {
    const fd = new FormData();
    fd.append("content", "Hello world");

    const result = await addCommentAction("issue-1", null, fd);

    expect(result.success).toBe(true);
    // Ensure permission enforcement wasn't invoked for add comment
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });
});
