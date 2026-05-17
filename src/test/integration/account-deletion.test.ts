/**
 * Integration Test: Account Deletion Logic
 *
 * Tests the anonymization and reassignment logic during account deletion.
 * uses PGlite to verify database state changes and constraint adherence.
 */

import { describe, it, expect } from "vitest";
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
