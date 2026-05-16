/**
 * Unit Tests: Comment Actions (add, edit, delete)
 *
 * Tests that:
 * - addCommentAction persists a comment on happy path
 * - editCommentAction updates a comment when the author makes the call, and
 *   returns UNAUTHORIZED for non-authors (including admins trying to edit
 *   another user's comment — i.e. admins can delete but cannot edit others)
 * - deleteCommentAction converts a comment to an audit trail message
 *   rather than actually deleting the row
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  addCommentAction,
  editCommentAction,
  deleteCommentAction,
} from "~/app/(app)/issues/actions";

// Mock Next.js modules
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock DB - using factory function to avoid hoisting issues
vi.mock("~/server/db", () => {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return {
    db: {
      update: mockUpdate,
      query: {
        issues: {
          findFirst: vi.fn(),
        },
        issueComments: {
          findFirst: vi.fn(),
        },
        userProfiles: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

// Mock schema (needed for eq comparisons)
vi.mock("~/server/db/schema", () => ({
  issues: { id: "issues.id" },
  issueComments: { id: "issueComments.id" },
  issueImages: { commentId: "issueImages.commentId" },
  userProfiles: { id: "userProfiles.id" },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value })),
}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock services
vi.mock("~/services/issues", () => ({
  updateIssueStatus: vi.fn(),
  updateIssueSeverity: vi.fn(),
  updateIssuePriority: vi.fn(),
  updateIssueFrequency: vi.fn(),
  addIssueComment: vi.fn(),
  updateIssueComment: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { log } from "~/lib/logger";
import { addIssueComment, updateIssueComment } from "~/services/issues";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Get typed references to the chainable mocks
function getMockUpdate() {
  return db.update as Mock;
}

function getMockSet() {
  const mockUpdate = getMockUpdate();
  const result = mockUpdate();
  return result.set as Mock;
}

describe("deleteCommentAction - Audit Trail", () => {
  const validCommentId = "123e4567-e89b-12d3-a456-426614174000";
  const validIssueId = "987e6543-e21b-12d3-a456-426614174000";
  const mockUserId = "user-123";
  const mockAdminId = "admin-456";
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user deletes their own comment", () => {
    beforeEach(() => {
      // Auth as comment author
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
          }),
        },
      } as unknown as SupabaseClient);

      // Comment exists and belongs to this user
      vi.mocked(db.query.issueComments.findFirst).mockResolvedValue({
        id: validCommentId,
        issueId: validIssueId,
        authorId: mockUserId,
        content: "Original comment content",
        isSystem: false,
      } as any);

      // User is a regular member
      vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
        role: "member",
      } as any);

      // Issue lookup for revalidation
      vi.mocked(db.query.issues.findFirst).mockResolvedValue({
        machineInitials: "MM",
        issueNumber: 1,
      } as any);
    });

    it("should convert comment to audit trail with 'User deleted their comment'", async () => {
      const formData = new FormData();
      formData.append("commentId", validCommentId);

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(true);

      // Verify db.update was called
      const mockUpdate = getMockUpdate();
      expect(mockUpdate).toHaveBeenCalled();

      // Verify the set call has correct structured audit trail event
      const mockSet = getMockSet();
      expect(mockSet).toHaveBeenCalledWith({
        isSystem: true,
        authorId: null,
        content: null,
        eventData: { type: "comment_deleted", deletedBy: "author" },
        updatedAt: expect.any(Date),
      });

      // Verify logging
      expect(log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          commentId: validCommentId,
          isOwnComment: true,
          action: "deleteComment",
        }),
        "Comment converted to audit trail"
      );

      // Verify revalidation
      expect(revalidatePath).toHaveBeenCalledWith("/m/MM/i/1");
    });
  });

  describe("when admin deletes another user's comment", () => {
    beforeEach(() => {
      // Auth as admin
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminId } },
          }),
        },
      } as unknown as SupabaseClient);

      // Comment exists but belongs to different user
      vi.mocked(db.query.issueComments.findFirst).mockResolvedValue({
        id: validCommentId,
        issueId: validIssueId,
        authorId: mockUserId, // Different from admin
        content: "User's comment content",
        isSystem: false,
      } as any);

      // User is admin
      vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
        role: "admin",
      } as any);

      // Issue lookup for revalidation
      vi.mocked(db.query.issues.findFirst).mockResolvedValue({
        machineInitials: "MM",
        issueNumber: 1,
      } as any);
    });

    it("should convert comment to audit trail with 'Comment removed by admin'", async () => {
      const formData = new FormData();
      formData.append("commentId", validCommentId);

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(true);

      // Verify the set call has correct structured admin audit event
      const mockSet = getMockSet();
      expect(mockSet).toHaveBeenCalledWith({
        isSystem: true,
        authorId: null,
        content: null,
        eventData: { type: "comment_deleted", deletedBy: "admin" },
        updatedAt: expect.any(Date),
      });

      // Verify logging shows isOwnComment: false
      expect(log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          commentId: validCommentId,
          isOwnComment: false,
          action: "deleteComment",
        }),
        "Comment converted to audit trail"
      );
    });
  });

  describe("authorization checks", () => {
    it("should return UNAUTHORIZED for unauthenticated user", async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as SupabaseClient);

      const formData = new FormData();
      formData.append("commentId", validCommentId);

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
      expect(getMockUpdate()).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND for non-existent comment", async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
          }),
        },
      } as unknown as SupabaseClient);

      vi.mocked(db.query.issueComments.findFirst).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("commentId", validCommentId);

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("NOT_FOUND");
      }
      expect(getMockUpdate()).not.toHaveBeenCalled();
    });

    it("should return UNAUTHORIZED for system comments", async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
          }),
        },
      } as unknown as SupabaseClient);

      // Comment is a system comment (audit event)
      vi.mocked(db.query.issueComments.findFirst).mockResolvedValue({
        id: validCommentId,
        issueId: validIssueId,
        authorId: null,
        eventData: { type: "status_changed", from: "new", to: "in_progress" },
        content: null,
        isSystem: true,
      } as any);

      const formData = new FormData();
      formData.append("commentId", validCommentId);

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
        expect(result.message).toBe("System comments cannot be deleted");
      }
      expect(getMockUpdate()).not.toHaveBeenCalled();
    });

    it("should return UNAUTHORIZED when non-admin tries to delete others comment", async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
          }),
        },
      } as unknown as SupabaseClient);

      // Comment belongs to different user
      vi.mocked(db.query.issueComments.findFirst).mockResolvedValue({
        id: validCommentId,
        issueId: validIssueId,
        authorId: "other-user-id",
        content: "Other user's comment",
        isSystem: false,
      } as any);

      // Current user is not admin
      vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
        role: "member",
      } as any);

      const formData = new FormData();
      formData.append("commentId", validCommentId);

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
      expect(getMockUpdate()).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("should return VALIDATION error for invalid commentId", async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
          }),
        },
      } as unknown as SupabaseClient);

      const formData = new FormData();
      formData.append("commentId", "not-a-uuid");

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
      expect(getMockUpdate()).not.toHaveBeenCalled();
    });

    it("should return VALIDATION error for missing commentId", async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
          }),
        },
      } as unknown as SupabaseClient);

      const formData = new FormData();
      // Not appending commentId

      const result = await deleteCommentAction(initialState, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
      expect(getMockUpdate()).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// addCommentAction
// ---------------------------------------------------------------------------

// Minimal ProseMirror doc with content so docToPlainText returns non-empty.
const validCommentDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello world" }],
    },
  ],
};

describe("addCommentAction", () => {
  const validIssueId = "987e6543-e21b-12d3-a456-426614174000";
  const mockUserId = "user-123";
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
        }),
      },
    } as unknown as SupabaseClient);

    vi.mocked(db.query.issues.findFirst).mockResolvedValue({
      machineInitials: "MM",
      issueNumber: 1,
    } as any);

    vi.mocked(addIssueComment).mockResolvedValue(undefined as any);
  });

  it("persists the comment and revalidates the issue page on happy path", async () => {
    const formData = new FormData();
    formData.append("issueId", validIssueId);
    formData.append("comment", JSON.stringify(validCommentDoc));

    const result = await addCommentAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(vi.mocked(addIssueComment)).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: validIssueId,
        userId: mockUserId,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/m/MM/i/1");
  });
});

// ---------------------------------------------------------------------------
// editCommentAction
// ---------------------------------------------------------------------------

describe("editCommentAction", () => {
  const validCommentId = "123e4567-e89b-12d3-a456-426614174000";
  const validIssueId = "987e6543-e21b-12d3-a456-426614174000";
  const mockUserId = "user-123";
  const mockAdminId = "admin-456";
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.query.issues.findFirst).mockResolvedValue({
      machineInitials: "MM",
      issueNumber: 1,
    } as any);

    vi.mocked(updateIssueComment).mockResolvedValue(undefined as any);
  });

  describe("when the author edits their own comment", () => {
    beforeEach(() => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
          }),
        },
      } as unknown as SupabaseClient);

      vi.mocked(db.query.issueComments.findFirst).mockResolvedValue({
        id: validCommentId,
        issueId: validIssueId,
        authorId: mockUserId,
        content: "Original content",
        isSystem: false,
      } as any);
    });

    it("updates the comment and revalidates the issue page", async () => {
      const formData = new FormData();
      formData.append("commentId", validCommentId);
      formData.append("comment", JSON.stringify(validCommentDoc));

      const result = await editCommentAction(initialState, formData);

      expect(result.ok).toBe(true);
      expect(vi.mocked(updateIssueComment)).toHaveBeenCalledWith(
        expect.objectContaining({ commentId: validCommentId })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/m/MM/i/1");
    });
  });

  describe("when a non-author (including admin) tries to edit another user's comment", () => {
    // This covers the E2E assertion that admins see Delete but NOT Edit on
    // others' comments: the server action enforces this at the action boundary.
    beforeEach(() => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminId } },
          }),
        },
      } as unknown as SupabaseClient);

      // Comment belongs to a different user
      vi.mocked(db.query.issueComments.findFirst).mockResolvedValue({
        id: validCommentId,
        issueId: validIssueId,
        authorId: mockUserId, // different from mockAdminId
        content: "Another user's comment",
        isSystem: false,
      } as any);
    });

    it("returns UNAUTHORIZED and does not call updateIssueComment", async () => {
      const formData = new FormData();
      formData.append("commentId", validCommentId);
      formData.append("comment", JSON.stringify(validCommentDoc));

      const result = await editCommentAction(initialState, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
      expect(vi.mocked(updateIssueComment)).not.toHaveBeenCalled();
    });
  });
});
