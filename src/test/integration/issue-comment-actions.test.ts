/**
 * Integration Tests: Comment Actions (addCommentAction, editCommentAction, deleteCommentAction)
 *
 * Wave 4 RECLASS (PP-x4li.1.4): migrated from
 * src/test/unit/delete-comment-audit.test.ts. The source file mocked
 * ~/server/db entirely, meaning DB-state assertions (soft-delete, eventData,
 * content=null) were verified against mock call args — not real rows.
 *
 * Here we drive the real actions against PGlite via the canonical
 * `vi.mock("~/server/db", async () => ({ db: await getTestDb() }))` pattern
 * so that every DB write is actually persisted and read back.
 *
 * Per-block disposition (source file had 11 blocks):
 *
 *   RECLASS → this file (9 blocks):
 *     deleteCommentAction:
 *       1. author soft-delete → isSystem=true, content=null, eventData.deletedBy="author"
 *       2. admin soft-delete → eventData.deletedBy="admin"
 *       3. unauthenticated → UNAUTHORIZED + read-only invariant (no row mutated)
 *       4. non-existent comment → NOT_FOUND + read-only invariant
 *       5. system comment → UNAUTHORIZED + read-only invariant
 *       6. non-admin trying to delete another user's comment → UNAUTHORIZED + read-only
 *     addCommentAction:
 *       7. happy path → comment row persisted in real DB
 *     editCommentAction:
 *       8. author edits own comment → content updated in real DB
 *       9. non-author (including admin) → UNAUTHORIZED + read-only invariant
 *
 *   KEEP-unit (2 blocks, stayed in source):
 *     deleteCommentAction:
 *       - "should return VALIDATION error for invalid commentId"   (pure Zod)
 *       - "should return VALIDATION error for missing commentId"   (pure Zod)
 *
 * Permissions: deleteCommentAction uses checkPermission("comments.delete") and
 * checkPermission("comments.delete.any"). We drive those with REAL permission
 * matrix (~/lib/permissions/* is NOT mocked). editCommentAction does a direct
 * authorId === userId check — no matrix call, but we still verify real row state.
 *
 * Read-only invariants on denied paths (lesson from Wave 3 Copilot review):
 * after every UNAUTHORIZED/NOT_FOUND error, we assert the issueComments table
 * row is unchanged — confirming the action bailed out before any DB write.
 *
 * External boundaries mocked (never reach network):
 *   - ~/lib/supabase/server   (Supabase auth)
 *   - next/cache              (revalidatePath)
 *   - next/navigation         (redirect)
 *   - ~/lib/logger            (log.*)
 *   - ~/lib/observability/report-error (serverActionError, reportError)
 *   - ~/lib/notifications     (createNotification, getChannels)
 *
 * NOT mocked:
 *   - ~/server/db             (routed to PGlite)
 *   - ~/lib/permissions/*     (real matrix — CORE-ARCH-008)
 *   - drizzle-orm, ~/server/db/schema
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  authUsers,
  issueComments,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";

// ---------------------------------------------------------------------------
// External-boundary mocks
// ---------------------------------------------------------------------------

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// after() needs a request scope at runtime; in tests run the callback inline. (PP-2053.3)
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn((_err: unknown, code: string, message: string) =>
    Promise.resolve({ ok: false as const, code, message })
  ),
}));

vi.mock("~/lib/notifications", () => ({
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
}));

// Real PGlite — all DB writes flow through the actual PGlite worker instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// ---------------------------------------------------------------------------
// Shared auth helper
// ---------------------------------------------------------------------------

async function mockAuth(userId: string | null) {
  const { createClient } = await import("~/lib/supabase/server");
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

// ---------------------------------------------------------------------------
// Minimal ProseMirror doc with non-empty content (docToPlainText returns "Hello world")
// ---------------------------------------------------------------------------
const validCommentDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hello world" }],
    },
  ],
};

// ---------------------------------------------------------------------------
// deleteCommentAction — integration
// ---------------------------------------------------------------------------

describe("deleteCommentAction — integration (PP-x4li.1.4)", () => {
  setupTestDb();

  // Stable IDs for this describe block
  const MEMBER_ID = "c0000000-0000-0000-0000-000000000001";
  const ADMIN_ID = "c0000000-0000-0000-0000-000000000002";
  const OTHER_MEMBER_ID = "c0000000-0000-0000-0000-000000000003";

  let issueId: string;
  let commentId: string;

  beforeEach(async () => {
    const db = await getTestDb();

    // Seed auth.users entries (required by the FK from userProfiles)
    await db.insert(authUsers).values([
      { id: MEMBER_ID, email: "member-del@test.com" },
      { id: ADMIN_ID, email: "admin-del@test.com" },
      { id: OTHER_MEMBER_ID, email: "other-del@test.com" },
    ]);

    // Seed user profiles
    await db.insert(userProfiles).values([
      createTestUser({
        id: MEMBER_ID,
        role: "member",
        email: "member-del@test.com",
      }),
      createTestUser({
        id: ADMIN_ID,
        role: "admin",
        email: "admin-del@test.com",
      }),
      createTestUser({
        id: OTHER_MEMBER_ID,
        role: "member",
        email: "other-del@test.com",
      }),
    ]);

    // Seed machine
    await db.insert(machines).values(
      createTestMachine({
        id: "d0000000-0000-0000-0000-000000000001",
        initials: "DEL",
        name: "Delete Comment Test Machine",
        ownerId: MEMBER_ID,
      })
    );

    // Seed issue
    const [issue] = await db
      .insert(issues)
      .values({
        machineInitials: "DEL",
        issueNumber: 1,
        title: "Test issue for comment deletion",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        status: "new",
        reportedBy: MEMBER_ID,
      })
      .returning();
    issueId = issue.id;

    // Seed a regular comment authored by MEMBER_ID
    const [comment] = await db
      .insert(issueComments)
      .values({
        issueId,
        authorId: MEMBER_ID,
        content: validCommentDoc,
        isSystem: false,
      })
      .returning();
    commentId = comment.id;
  });

  // Block 1: author soft-delete → isSystem=true, content=null, eventData.deletedBy="author"
  it("converts comment to audit trail when author deletes their own comment", async () => {
    await mockAuth(MEMBER_ID);
    const { deleteCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("commentId", commentId);

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(true);

    // Verify real DB state — the row is still present but converted
    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, commentId));

    expect(row).toBeDefined();
    expect(row.isSystem).toBe(true);
    expect(row.authorId).toBeNull();
    expect(row.content).toBeNull();
    expect(row.eventData).toMatchObject({
      type: "comment_deleted",
      deletedBy: "author",
    });
  });

  // Block 2: admin soft-delete → eventData.deletedBy="admin"
  it("converts comment to audit trail with deletedBy='admin' when admin deletes another user's comment", async () => {
    await mockAuth(ADMIN_ID);
    const { deleteCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("commentId", commentId);

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(true);

    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, commentId));

    expect(row.isSystem).toBe(true);
    expect(row.authorId).toBeNull();
    expect(row.content).toBeNull();
    expect(row.eventData).toMatchObject({
      type: "comment_deleted",
      deletedBy: "admin",
    });
  });

  // Block 3: unauthenticated → UNAUTHORIZED + read-only invariant
  it("returns UNAUTHORIZED for unauthenticated user and does not mutate the comment row", async () => {
    await mockAuth(null);
    const { deleteCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("commentId", commentId);

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }

    // Read-only invariant: comment row unchanged
    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, commentId));
    expect(row.isSystem).toBe(false);
    expect(row.authorId).toBe(MEMBER_ID);
    expect(row.content).not.toBeNull();
  });

  // Block 4: non-existent comment → NOT_FOUND + read-only invariant
  it("returns NOT_FOUND when comment does not exist", async () => {
    await mockAuth(MEMBER_ID);
    const { deleteCommentAction } = await import("~/app/(app)/issues/actions");

    const nonExistentId = "00000000-dead-beef-0000-000000000000";
    const formData = new FormData();
    formData.append("commentId", nonExistentId);

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }

    // Read-only invariant: existing comment row still pristine
    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, commentId));
    expect(row.isSystem).toBe(false);
  });

  // Block 5: system comment → UNAUTHORIZED + read-only invariant
  it("returns UNAUTHORIZED for system comments and does not mutate them", async () => {
    // Create a system comment (audit event row)
    const db = await getTestDb();
    const [systemComment] = await db
      .insert(issueComments)
      .values({
        issueId,
        authorId: null,
        content: null,
        isSystem: true,
        eventData: { type: "status_changed", from: "new", to: "in_progress" },
      })
      .returning();

    await mockAuth(MEMBER_ID);
    const { deleteCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("commentId", systemComment.id);

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toBe("System comments cannot be deleted");
    }

    // Read-only invariant: system comment row still has isSystem=true and original eventData
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, systemComment.id));
    expect(row.isSystem).toBe(true);
    expect(row.eventData).toMatchObject({ type: "status_changed" });
  });

  // Block 6: non-admin member tries to delete another user's comment → UNAUTHORIZED + read-only
  it("returns UNAUTHORIZED when non-admin tries to delete another user's comment", async () => {
    // OTHER_MEMBER_ID is a member who did NOT author the comment (MEMBER_ID did)
    await mockAuth(OTHER_MEMBER_ID);
    const { deleteCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("commentId", commentId);

    const result = await deleteCommentAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }

    // Read-only invariant: comment row unchanged
    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, commentId));
    expect(row.isSystem).toBe(false);
    expect(row.authorId).toBe(MEMBER_ID);
  });
});

// ---------------------------------------------------------------------------
// addCommentAction — integration
// ---------------------------------------------------------------------------

describe("addCommentAction — integration (PP-x4li.1.4)", () => {
  setupTestDb();

  const MEMBER_ID = "e0000000-0000-0000-0000-000000000001";
  let issueId: string;

  beforeEach(async () => {
    const db = await getTestDb();

    await db
      .insert(authUsers)
      .values({ id: MEMBER_ID, email: "member-add@test.com" });

    await db.insert(userProfiles).values(
      createTestUser({
        id: MEMBER_ID,
        role: "member",
        email: "member-add@test.com",
      })
    );

    await db.insert(machines).values(
      createTestMachine({
        id: "f0000000-0000-0000-0000-000000000001",
        initials: "ADD",
        name: "Add Comment Test Machine",
        ownerId: MEMBER_ID,
      })
    );

    const [issue] = await db
      .insert(issues)
      .values({
        machineInitials: "ADD",
        issueNumber: 1,
        title: "Test issue for add comment",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        status: "new",
        reportedBy: MEMBER_ID,
      })
      .returning();
    issueId = issue.id;
  });

  // Block 7: happy path → comment row persisted in real DB
  it("persists the comment row in the database on happy path", async () => {
    await mockAuth(MEMBER_ID);
    const { addCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("comment", JSON.stringify(validCommentDoc));

    const result = await addCommentAction(undefined, formData);

    expect(result.ok).toBe(true);

    // Verify real DB state — a comment row exists with the correct content and author
    const db = await getTestDb();
    const rows = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.issueId, issueId));

    expect(rows).toHaveLength(1);
    expect(rows[0].authorId).toBe(MEMBER_ID);
    expect(rows[0].isSystem).toBe(false);
    expect(rows[0].content).toMatchObject(validCommentDoc);
  });
});

// ---------------------------------------------------------------------------
// editCommentAction — integration
// ---------------------------------------------------------------------------

describe("editCommentAction — integration (PP-x4li.1.4)", () => {
  setupTestDb();

  const AUTHOR_ID = "a1000000-0000-0000-0000-000000000001";
  const NON_AUTHOR_ID = "a1000000-0000-0000-0000-000000000002";

  let issueId: string;
  let commentId: string;

  const originalDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Original content" }],
      },
    ],
  };

  const updatedDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Updated content" }],
      },
    ],
  };

  beforeEach(async () => {
    const db = await getTestDb();

    await db.insert(authUsers).values([
      { id: AUTHOR_ID, email: "author-edit@test.com" },
      { id: NON_AUTHOR_ID, email: "non-author-edit@test.com" },
    ]);

    await db.insert(userProfiles).values([
      createTestUser({
        id: AUTHOR_ID,
        role: "member",
        email: "author-edit@test.com",
      }),
      createTestUser({
        id: NON_AUTHOR_ID,
        role: "admin",
        email: "non-author-edit@test.com",
      }),
    ]);

    await db.insert(machines).values(
      createTestMachine({
        id: "b1000000-0000-0000-0000-000000000001",
        initials: "EDT",
        name: "Edit Comment Test Machine",
        ownerId: AUTHOR_ID,
      })
    );

    const [issue] = await db
      .insert(issues)
      .values({
        machineInitials: "EDT",
        issueNumber: 1,
        title: "Test issue for edit comment",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        status: "new",
        reportedBy: AUTHOR_ID,
      })
      .returning();
    issueId = issue.id;

    const [comment] = await db
      .insert(issueComments)
      .values({
        issueId,
        authorId: AUTHOR_ID,
        content: originalDoc,
        isSystem: false,
      })
      .returning();
    commentId = comment.id;
  });

  // Block 8: author edits own comment → content updated in real DB
  it("updates the comment content in the database when the author edits their own comment", async () => {
    await mockAuth(AUTHOR_ID);
    const { editCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("commentId", commentId);
    formData.append("comment", JSON.stringify(updatedDoc));

    const result = await editCommentAction(undefined, formData);

    expect(result.ok).toBe(true);

    // Verify real DB state — content is updated
    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, commentId));

    expect(row.content).toMatchObject(updatedDoc);
    expect(row.authorId).toBe(AUTHOR_ID);
  });

  // Block 9: non-author (including admin) → UNAUTHORIZED + read-only invariant
  it("returns UNAUTHORIZED and does not mutate the comment when a non-author tries to edit", async () => {
    // NON_AUTHOR_ID is an admin, but editCommentAction enforces author-only at
    // the action boundary (admins can delete but cannot edit others' comments).
    await mockAuth(NON_AUTHOR_ID);
    const { editCommentAction } = await import("~/app/(app)/issues/actions");

    const formData = new FormData();
    formData.append("commentId", commentId);
    formData.append("comment", JSON.stringify(updatedDoc));

    const result = await editCommentAction(undefined, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }

    // Read-only invariant: comment row content unchanged
    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.id, commentId));

    expect(row.content).toMatchObject(originalDoc);
  });
});
