/**
 * Integration Tests for Issue Images
 *
 * Tests image database operations, limits, and cascade behavior with PGlite.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { eq, count } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import {
  issues,
  machines,
  userProfiles,
  issueComments,
  issueImages,
} from "~/server/db/schema";
import { BLOB_CONFIG } from "~/lib/blob/config";

describe("Issue Images Database Operations (PGlite)", () => {
  setupTestDb();

  let testMachine: { id: string; name: string; initials: string };
  let testUser: { id: string; name: string };
  let testIssue: { id: string };

  beforeEach(async () => {
    const db = await getTestDb();

    // Create test machine
    const [machine] = await db
      .insert(machines)
      .values({ name: "Test Machine", initials: "TM" })
      .returning();
    testMachine = machine;

    // Create test user
    const [user] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000001",
          role: "member",
        })
      )
      .returning();
    testUser = user;

    // Create test issue
    const [issue] = await db
      .insert(issues)
      .values({
        title: "Test Issue",
        machineInitials: testMachine.initials,
        issueNumber: 1,
        severity: "playable",
        reportedBy: testUser.id,
      })
      .returning();
    testIssue = issue;
  });

  describe("Constraints", () => {
    it("should allow creating an image with null uploadedBy (Anonymous)", async () => {
      const db = await getTestDb();

      const [image] = await db
        .insert(issueImages)
        .values({
          issueId: testIssue.id,
          uploadedBy: null,
          fullImageUrl: "https://blob.com/test.jpg",
          fullBlobPathname: "test.jpg",
          fileSizeBytes: 1024,
          mimeType: "image/jpeg",
        })
        .returning();

      expect(image).toBeDefined();
      expect(image.uploadedBy).toBeNull();
    });

    it("should allow multiple images per issue", async () => {
      const db = await getTestDb();

      await db.insert(issueImages).values([
        {
          issueId: testIssue.id,
          uploadedBy: testUser.id,
          fullImageUrl: "https://blob.com/1.jpg",
          fullBlobPathname: "1.jpg",
          fileSizeBytes: 1024,
          mimeType: "image/jpeg",
        },
        {
          issueId: testIssue.id,
          uploadedBy: testUser.id,
          fullImageUrl: "https://blob.com/2.jpg",
          fullBlobPathname: "2.jpg",
          fileSizeBytes: 1024,
          mimeType: "image/jpeg",
        },
      ]);

      const results = await db
        .select({ val: count() })
        .from(issueImages)
        .where(eq(issueImages.issueId, testIssue.id));

      expect(results[0].val).toBe(2);
    });
  });

  describe("Cascade Behavior", () => {
    it("should delete images when issue is deleted", async () => {
      const db = await getTestDb();

      await db.insert(issueImages).values({
        issueId: testIssue.id,
        uploadedBy: testUser.id,
        fullImageUrl: "https://blob.com/test.jpg",
        fullBlobPathname: "test.jpg",
        fileSizeBytes: 1024,
        mimeType: "image/jpeg",
      });

      await db.delete(issues).where(eq(issues.id, testIssue.id));

      const remaining = await db
        .select({ val: count() })
        .from(issueImages)
        .where(eq(issueImages.issueId, testIssue.id));

      expect(remaining[0].val).toBe(0);
    });

    it("should delete images when comment is deleted", async () => {
      const db = await getTestDb();

      const [comment] = await db
        .insert(issueComments)
        .values({
          issueId: testIssue.id,
          content: "Test Comment",
          authorId: testUser.id,
        })
        .returning();

      await db.insert(issueImages).values({
        issueId: testIssue.id,
        commentId: comment.id,
        uploadedBy: testUser.id,
        fullImageUrl: "https://blob.com/test.jpg",
        fullBlobPathname: "test.jpg",
        fileSizeBytes: 1024,
        mimeType: "image/jpeg",
      });

      await db.delete(issueComments).where(eq(issueComments.id, comment.id));

      const remaining = await db
        .select({ val: count() })
        .from(issueImages)
        .where(eq(issueImages.commentId, comment.id));

      expect(remaining[0].val).toBe(0);
    });
  });

  describe("Limit Logic (Integration Simulation)", () => {
    it("should accurately count images for a specific issue", async () => {
      const db = await getTestDb();

      // Clear any existing images for this issue to be sure
      await db.delete(issueImages).where(eq(issueImages.issueId, testIssue.id));

      const mockImages = Array.from({ length: 5 }).map((_, i) => ({
        issueId: testIssue.id,
        uploadedBy: testUser.id,
        fullImageUrl: `https://blob.com/${i}.jpg`,
        fullBlobPathname: `${i}.jpg`,
        fileSizeBytes: 1024,
        mimeType: "image/jpeg",
      }));

      await db.insert(issueImages).values(mockImages);

      const issueImagesCount = await db
        .select({ val: count() })
        .from(issueImages)
        .where(eq(issueImages.issueId, testIssue.id));

      expect(issueImagesCount[0].val).toBe(5);
      expect(issueImagesCount[0].val).toBeLessThanOrEqual(
        BLOB_CONFIG.LIMITS.ISSUE_TOTAL_MAX
      );
    });

    it("should accurately count images for a specific user", async () => {
      const db = await getTestDb();

      const mockImages = Array.from({ length: 3 }).map((_, i) => ({
        issueId: testIssue.id,
        uploadedBy: testUser.id,
        fullImageUrl: `https://blob.com/${i}.jpg`,
        fullBlobPathname: `${i}.jpg`,
        fileSizeBytes: 1024,
        mimeType: "image/jpeg",
      }));

      await db.insert(issueImages).values(mockImages);

      const userImagesCount = await db
        .select({ val: count() })
        .from(issueImages)
        .where(eq(issueImages.uploadedBy, testUser.id));

      expect(userImagesCount[0].val).toBe(3);
    });
  });

  describe("Soft Delete", () => {
    it("should allow soft-deleting an image", async () => {
      const db = await getTestDb();

      const [image] = await db
        .insert(issueImages)
        .values({
          issueId: testIssue.id,
          uploadedBy: testUser.id,
          fullImageUrl: "https://blob.com/delete-me.jpg",
          fullBlobPathname: "delete-me.jpg",
          fileSizeBytes: 1024,
          mimeType: "image/jpeg",
        })
        .returning();

      await db
        .update(issueImages)
        .set({
          deletedAt: new Date(),
          deletedBy: testUser.id,
        })
        .where(eq(issueImages.id, image.id));

      const updated = await db.query.issueImages.findFirst({
        where: eq(issueImages.id, image.id),
      });

      expect(updated?.deletedAt).toBeDefined();
      expect(updated?.deletedBy).toBe(testUser.id);
    });

    it("should exclude soft-deleted images from active counts", async () => {
      const db = await getTestDb();
      const { isNull, and } = await import("drizzle-orm");

      await db.insert(issueImages).values([
        {
          issueId: testIssue.id,
          uploadedBy: testUser.id,
          fullImageUrl: "https://blob.com/active.jpg",
          fullBlobPathname: "active.jpg",
          fileSizeBytes: 1024,
          mimeType: "image/jpeg",
        },
        {
          issueId: testIssue.id,
          uploadedBy: testUser.id,
          fullImageUrl: "https://blob.com/deleted.jpg",
          fullBlobPathname: "deleted.jpg",
          fileSizeBytes: 1024,
          mimeType: "image/jpeg",
          deletedAt: new Date(),
        },
      ]);

      const activeCount = await db
        .select({ val: count() })
        .from(issueImages)
        .where(
          and(
            eq(issueImages.issueId, testIssue.id),
            isNull(issueImages.deletedAt)
          )
        );

      expect(activeCount[0].val).toBe(1);
    });
  });
});
