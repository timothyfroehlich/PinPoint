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
import { anonymizeUserReferences } from "~/app/(app)/settings/account-deletion";
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
