/**
 * Integration Test: Account Deletion Logic
 *
 * Tests the anonymization and reassignment logic during account deletion.
 * uses PGlite to verify database state changes and constraint adherence.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  userProfiles,
  machines,
  issues,
  issueComments,
  issueImages,
} from "~/server/db/schema";
import {
  createTestUser,
  createTestMachine,
  createTestIssue,
} from "~/test/helpers/factories";
import {
  anonymizeUserReferences,
  getReassignmentTargets,
} from "~/app/(app)/settings/account-deletion";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Module mocks required by deleteAccountAction integration describe block.
// vi.mock() calls are hoisted to module scope by Vitest — they apply to the
// entire file, but only the deleteAccountAction block actually invokes them.
// ---------------------------------------------------------------------------

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
    })
  ),
}));

const mockDeleteUser = vi.fn();
const mockAdminSignOut = vi.fn();
vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
        signOut: mockAdminSignOut,
      },
    },
  })),
}));

vi.mock("~/lib/blob/client", () => ({
  deleteFromBlob: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn(
    (_error: unknown, code: string, message: string) => ({
      ok: false as const,
      code,
      message,
    })
  ),
}));

class RedirectError extends Error {
  constructor() {
    super("NEXT_REDIRECT");
    this.name = "RedirectError";
  }
}
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new RedirectError();
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Account Deletion Anonymization (PGlite)", () => {
  setupTestDb();

  it("should anonymize issues, comments, and images when user is deleted", async () => {
    const db = await getTestDb();

    // 1. Setup Users
    const userToDeleteId = randomUUID();
    const otherUserId = randomUUID();

    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: userToDeleteId, email: "delete@example.com" }),
        createTestUser({ id: otherUserId, email: "other@example.com" }),
      ]);

    // 2. Setup Machine and Content owned by userToDelete
    const machine = createTestMachine({ ownerId: userToDeleteId });
    await db.insert(machines).values(machine);

    // Issue reported by user
    const issueReported = createTestIssue(machine.initials, {
      reportedBy: userToDeleteId,
      issueNumber: 1,
    });
    // Issue assigned to user
    const issueAssigned = createTestIssue(machine.initials, {
      assignedTo: userToDeleteId,
      issueNumber: 2,
    });

    await db.insert(issues).values([issueReported, issueAssigned]);

    const [comment] = await db
      .insert(issueComments)
      .values({
        issueId: issueReported.id,
        authorId: userToDeleteId,
        content: "I am leaving",
      })
      .returning();

    await db.insert(issueImages).values({
      issueId: issueReported.id,
      uploadedBy: userToDeleteId,
      fullImageUrl: "http://example.com/img.jpg",
      fullBlobPathname: "path/to/blob",
      fileSizeBytes: 100,
      mimeType: "image/jpeg",
    });

    // 3. Run Anonymization (without reassignment)
    await anonymizeUserReferences(userToDeleteId, null, db);

    // 4. Verify Anonymization
    const anonymizedIssues = await db.query.issues.findMany({
      where: eq(issues.machineInitials, machine.initials),
    });

    const reported = anonymizedIssues.find((i) => i.issueNumber === 1);
    const assigned = anonymizedIssues.find((i) => i.issueNumber === 2);

    expect(reported?.reportedBy).toBeNull();
    expect(assigned?.assignedTo).toBeNull();

    const anonymizedComment = await db.query.issueComments.findFirst({
      where: eq(issueComments.id, comment.id),
    });
    expect(anonymizedComment?.authorId).toBeNull();
    // Content should remain
    expect(anonymizedComment?.content).toBe("I am leaving");

    const anonymizedImage = await db.query.issueImages.findFirst({
      where: eq(issueImages.issueId, issueReported.id),
    });
    expect(anonymizedImage?.uploadedBy).toBeNull();

    // Machine should be unassigned
    const updatedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(updatedMachine?.ownerId).toBeNull();
  });

  it("should reassign machines to another user if requested", async () => {
    const db = await getTestDb();

    // 1. Setup Users
    const userToDeleteId = randomUUID();
    const newOwnerId = randomUUID();

    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: userToDeleteId, email: "leaver@example.com" }),
        createTestUser({ id: newOwnerId, email: "keeper@example.com" }),
      ]);

    // 2. Setup Machine owned by userToDelete
    const machine = createTestMachine({ ownerId: userToDeleteId });
    await db.insert(machines).values(machine);

    // 3. Run Anonymization with Reassignment
    await anonymizeUserReferences(userToDeleteId, newOwnerId, db);

    // 4. Verify Reassignment
    const updatedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(updatedMachine?.ownerId).toBe(newOwnerId);
  });

  it("should throw SoleAdminError if the last admin tries to delete account", async () => {
    const db = await getTestDb();

    // 1. Setup Sole Admin
    const adminId = randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: adminId, role: "admin" }));

    // 2. Attempt Anonymization
    await expect(anonymizeUserReferences(adminId, null, db)).rejects.toThrow(
      "Sole admin cannot delete their account"
    );
  });

  it("should allow admin deletion if another admin exists", async () => {
    const db = await getTestDb();

    // 1. Setup Two Admins
    const adminToDeleteId = randomUUID();
    const otherAdminId = randomUUID();

    await db.insert(userProfiles).values([
      createTestUser({
        id: adminToDeleteId,
        role: "admin",
        email: "a1@example.com",
      }),
      createTestUser({
        id: otherAdminId,
        role: "admin",
        email: "a2@example.com",
      }),
    ]);

    // 2. Attempt Anonymization
    await expect(
      anonymizeUserReferences(adminToDeleteId, null, db)
    ).resolves.not.toThrow();
  });
});

describe("Account Deletion Reassign Picker — guest filter (PP-hci / PP-aby)", () => {
  /**
   * Class-I integration test — exercises the production
   * `getReassignmentTargets` helper used by settings/page.tsx to populate
   * the reassignment picker. Calling the real helper (not a copy of the
   * query) guarantees that any future drift in the role filter is caught
   * by this regression test.
   *
   * Replaces e2e/full/account-deletion-reassign-picker.spec.ts which
   * was downgraded per the 2026-05 audit (row #16, DOWNGRADE-integration).
   */
  setupTestDb();

  it("reassign picker query excludes guests and includes member/technician/admin", async () => {
    const db = await getTestDb();

    const deletingUserId = randomUUID();
    const memberId = randomUUID();
    const technicianId = randomUUID();
    const adminId = randomUUID();
    const guestId = randomUUID();

    await db.insert(userProfiles).values([
      createTestUser({
        id: deletingUserId,
        email: "deleting@example.com",
        role: "admin",
      }),
      createTestUser({
        id: memberId,
        email: "member@example.com",
        role: "member",
      }),
      createTestUser({
        id: technicianId,
        email: "technician@example.com",
        role: "technician",
      }),
      createTestUser({
        id: adminId,
        email: "admin@example.com",
        role: "admin",
      }),
      createTestUser({
        id: guestId,
        email: "guest@example.com",
        role: "guest",
      }),
    ]);

    // Call the production helper directly — drift in the role filter will
    // fail this assertion.
    const membersResult = await getReassignmentTargets(deletingUserId, db);
    const resultIds = membersResult.map((r) => r.id);

    // Guest must NOT appear
    expect(resultIds).not.toContain(guestId);

    // Member, technician, and another admin MUST appear
    expect(resultIds).toContain(memberId);
    expect(resultIds).toContain(technicianId);
    expect(resultIds).toContain(adminId);

    // The deleting user themselves must not appear (ne filter)
    expect(resultIds).not.toContain(deletingUserId);
  });
});

// ---------------------------------------------------------------------------
// Wave-3 RECLASS: deleteAccountAction — action-level DB integration
//
// Block 4 of delete-account-action.test.ts ("deletes account and redirects
// on success") was RECLASS'd here because its interesting assertion is about
// DB state: after calling deleteAccountAction with real PGlite wired in via
// vi.mock("~/server/db"), we can assert that anonymizeUserReferences actually
// committed its anonymization transaction (issues/comments SET NULL'd,
// machine unassigned).  The unit layer cannot make that assertion — it only
// verified that the mock transaction callback was invoked.
//
// External-boundary checks (signOut/deleteUser call order) remain in the
// unit file where they belong.
// ---------------------------------------------------------------------------

describe("deleteAccountAction — DB integration (PGlite)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockAdminSignOut.mockResolvedValue({ error: null });
  });

  it("anonymizes DB references and redirects on successful account deletion", async () => {
    const { deleteAccountAction } =
      await import("~/app/(app)/settings/actions");
    const { redirect } = await import("next/navigation");
    const db = await getTestDb();

    // Use proper UUIDs — PGlite enforces uuid column types
    const userId = randomUUID();
    const otherUserId = randomUUID();

    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });

    await db.insert(userProfiles).values([
      createTestUser({
        id: userId,
        email: "deleter@example.com",
        role: "member",
      }),
      createTestUser({ id: otherUserId, email: "other@example.com" }),
    ]);

    const machine = createTestMachine({ ownerId: userId, initials: "DM" });
    await db.insert(machines).values(machine);

    const issue = createTestIssue("DM", {
      reportedBy: userId,
      assignedTo: userId,
      issueNumber: 1,
    });
    await db.insert(issues).values(issue);

    const [comment] = await db
      .insert(issueComments)
      .values({ issueId: issue.id, authorId: userId, content: "goodbye" })
      .returning();

    // Call the real action — DB hits PGlite, external SDKs are mocked
    const fd = new FormData();
    fd.set("confirmation", "DELETE");
    fd.set("reassignTo", "");

    await expect(deleteAccountAction(undefined, fd)).rejects.toThrow(
      "NEXT_REDIRECT"
    );
    expect(redirect).toHaveBeenCalledWith("/");

    // New integration assertion — the unit layer could NOT verify these:
    // anonymizeUserReferences committed its transaction, nulling out all references.
    const updatedIssue = await db.query.issues.findFirst({
      where: eq(issues.id, issue.id),
    });
    expect(updatedIssue?.reportedBy).toBeNull();
    expect(updatedIssue?.assignedTo).toBeNull();

    const updatedComment = await db.query.issueComments.findFirst({
      where: eq(issueComments.id, comment.id),
    });
    expect(updatedComment?.authorId).toBeNull();
    expect(updatedComment?.content).toBe("goodbye"); // content preserved

    const updatedMachine = await db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
    });
    expect(updatedMachine?.ownerId).toBeNull(); // machine unassigned
  });

  it("returns SOLE_ADMIN from action when user is last admin in real DB", async () => {
    const { deleteAccountAction } =
      await import("~/app/(app)/settings/actions");
    const db = await getTestDb();

    // Use proper UUID — PGlite enforces uuid column types
    const userId = randomUUID();
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });

    await db
      .insert(userProfiles)
      .values(
        createTestUser({ id: userId, email: "sole@example.com", role: "admin" })
      );

    const fd = new FormData();
    fd.set("confirmation", "DELETE");
    fd.set("reassignTo", "");

    const result = await deleteAccountAction(undefined, fd);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SOLE_ADMIN");
    }
  });
});
