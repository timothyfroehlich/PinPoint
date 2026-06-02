/**
 * Unit Tests: Comment Actions — Input Validation (Zod)
 *
 * Wave 4 RECLASS (PP-x4li.1.4): The DB-state blocks (soft-delete, permission
 * wiring, auth checks) have been migrated to
 * src/test/integration/issue-comment-actions.test.ts.
 *
 * Remaining blocks here are pure Zod input-validation paths for
 * deleteCommentAction that do not depend on DB state:
 *   - invalid commentId (not a UUID)
 *   - missing commentId
 *
 * These stay as unit tests because they test input-parsing boundaries that
 * require no real DB or auth infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteCommentAction } from "~/app/(app)/issues/actions";
import { db } from "~/server/db";

// Mock Next.js modules
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
      }),
    },
  })),
}));

// Mock DB — these Zod tests bail out before any DB call, but the module must
// be importable.
vi.mock("~/server/db", () => ({
  db: {
    update: vi.fn(),
    query: {
      issues: { findFirst: vi.fn() },
      issueComments: { findFirst: vi.fn() },
      userProfiles: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("~/server/db/schema", () => ({
  issues: { id: "issues.id" },
  issueComments: { id: "issueComments.id" },
  issueImages: { commentId: "issueImages.commentId" },
  userProfiles: { id: "userProfiles.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value })),
}));

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/services/issues", () => ({
  updateIssueStatus: vi.fn(),
  updateIssueSeverity: vi.fn(),
  updateIssuePriority: vi.fn(),
  updateIssueFrequency: vi.fn(),
  addIssueComment: vi.fn(),
  updateIssueComment: vi.fn(),
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn((_err: unknown, code: string, message: string) =>
    Promise.resolve({ ok: false as const, code, message })
  ),
}));

describe("deleteCommentAction — input validation (KEEP-unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Asserts the action short-circuits on a Zod validation failure BEFORE any
  // DB access. Catches regressions where a DB read/write accidentally moves
  // ahead of input validation.
  function expectNoDbAccess() {
    expect(db.query.issueComments.findFirst).not.toHaveBeenCalled();
    expect(db.query.issues.findFirst).not.toHaveBeenCalled();
    expect(db.query.userProfiles.findFirst).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  }

  it("should return VALIDATION error for invalid commentId", async () => {
    const formData = new FormData();
    formData.append("commentId", "not-a-uuid");

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    expectNoDbAccess();
  });

  it("should return VALIDATION error for missing commentId", async () => {
    const formData = new FormData();
    // Not appending commentId

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    expectNoDbAccess();
  });
});
