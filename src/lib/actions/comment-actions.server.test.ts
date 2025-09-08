/**
 * Comment Server Actions Tests - Permission behavior
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { addCommentAction } from "./comment-actions";

// Mock the canonical auth resolver used by Server Actions
vi.mock("~/server/auth/context", () => ({
  getRequestAuthContext: vi.fn(),
  requireAuthorized: vi.fn(),
}));

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

const { getRequestAuthContext } = await import("~/server/auth/context");
const mockGetRequestAuthContext = vi.mocked(getRequestAuthContext);
const { requirePermission } = await import("~/server/auth/permissions");
const mockRequirePermission = vi.mocked(requirePermission);

describe("addCommentAction permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestAuthContext.mockResolvedValue({
      kind: "authorized",
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Test User",
      },
      org: {
        id: "org-1",
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: "role-1",
          name: "Member",
          permissions: [],
        },
        userId: "user-1",
        organizationId: "org-1",
      },
    });
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
