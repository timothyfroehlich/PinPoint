/**
 * Integration Tests for Issue Images
 *
 * Tests image database operations, limits, and cascade behavior with PGlite.
 * Also contains action-level integration tests for uploadIssueImage that verify
 * real DB persistence and permission-enforcement via real DB ownership rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq, count } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser } from "~/test/helpers/factories";
import { plainTextToDoc } from "~/lib/tiptap/types";
import {
  issues,
  machines,
  userProfiles,
  issueComments,
  issueImages,
} from "~/server/db/schema";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { createClient } from "~/lib/supabase/server";
import { checkImageUploadLimit } from "~/lib/rate-limit";
import { uploadToBlob } from "~/lib/blob/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Route the production `db` import to the PGlite worker instance so that
// uploadIssueImage reads/writes real rows instead of a hand-rolled mock.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/lib/blob/client", () => ({
  uploadToBlob: vi.fn(),
  deleteFromBlob: vi.fn(),
}));

vi.mock("~/lib/rate-limit", () => ({
  checkImageUploadLimit: vi.fn(),
  getClientIp: vi.fn(() => Promise.resolve("127.0.0.1")),
  formatResetTime: vi.fn(() => "15 minutes"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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
        severity: "major",
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
          content: plainTextToDoc("Test Comment"),
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

// ---------------------------------------------------------------------------
// Action-level integration tests for uploadIssueImage
// ---------------------------------------------------------------------------
// These tests call the real server action against PGlite and only mock the
// three external boundaries: blob storage, rate limiting, and Supabase auth.
// ---------------------------------------------------------------------------

describe("uploadIssueImage — action integration (PGlite)", () => {
  setupTestDb();

  // Helpers ----------------------------------------------------------------

  function createMockFile(
    name: string,
    type: string,
    sizeInBytes: number
  ): File {
    const content = new Array(sizeInBytes).fill("x").join("");
    return new File([content], name, { type });
  }

  // The action only calls `supabase.auth.getUser()`, so we provide a faithful
  // full `getUser` response (`{ data, error: null }`) typed against the SDK's
  // own return type. A single narrow cast to `SupabaseClient` is used at the SDK
  // boundary because the mock implements only the `auth` slice the action
  // consumes — no `unknown as` double-cast (CORE-TS-007).
  type GetUserResult = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>;

  function mockAuth(userId: string | null) {
    const user = userId ? ({ id: userId } as User) : null;
    const getUserResult: GetUserResult = user
      ? { data: { user }, error: null }
      : {
          data: { user: null },
          error: {
            name: "AuthSessionMissingError",
            message: "Auth session missing!",
          } as NonNullable<GetUserResult["error"]>,
        };

    const auth: Pick<SupabaseClient["auth"], "getUser"> = {
      getUser: vi.fn().mockResolvedValue(getUserResult),
    };

    vi.mocked(createClient).mockResolvedValue({
      auth,
    } as SupabaseClient);
  }

  function mockRateLimitPass() {
    vi.mocked(checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });
  }

  // Echo the pathname the action actually constructs back through the blob
  // result, so the action's `blobPathname` output reflects the real key it built
  // (per-issue prefix + timestamp) rather than a hardcoded test string.
  function mockBlobUpload() {
    vi.mocked(uploadToBlob).mockImplementation((_file, pathname) =>
      Promise.resolve({
        url: `https://blob.com/${pathname}`,
        downloadUrl: `https://blob.com/${pathname}?download=1`,
        pathname,
        contentType: "image/jpeg",
        contentDisposition: `inline; filename="${pathname}"`,
        etag: "mock-etag",
      })
    );
  }

  async function seedIssueWithOwner(
    reporterRole: "member" | "guest" | "technician" | "admin" = "member"
  ) {
    const db = await getTestDb();
    const reporterId = randomUUID();
    const ownerId = randomUUID();

    await db
      .insert(userProfiles)
      .values(createTestUser({ id: reporterId, role: reporterRole }));
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: ownerId, role: "member" }));

    const [machine] = await db
      .insert(machines)
      .values({ name: "Action Test Machine", initials: "ATM", ownerId })
      .returning();

    const [issue] = await db
      .insert(issues)
      .values({
        title: "Action Test Issue",
        machineInitials: machine.initials,
        issueNumber: 1,
        severity: "major",
        reportedBy: reporterId,
      })
      .returning();

    return { reporterId, ownerId, issueId: issue.id };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Block: "should insert record and revalidate for existing issue"
  // RECLASS-integration: the real assertion is that an issueImages row persists
  // in the DB. The unit test only checked that db.insert was called on a mock.
  it("inserts an issueImages row for an existing issue", async () => {
    const { reporterId, issueId } = await seedIssueWithOwner("member");
    mockAuth(reporterId);
    mockRateLimitPass();
    mockBlobUpload();

    const { uploadIssueImage } = await import("~/server/actions/images");

    const formData = new FormData();
    formData.append("issueId", issueId);
    formData.append("image", createMockFile("test.jpg", "image/jpeg", 2048));

    const result = await uploadIssueImage(formData);

    // The action must construct the blob key with a per-issue prefix derived
    // from the real issueId — assert the actual argument it passed to the blob
    // client, not just the echoed mock value. This catches pathname-construction
    // regressions (e.g. wrong prefix, leaked "pending"/"new" path).
    const expectedPrefix = `issue-images/${issueId}/`;
    expect(uploadToBlob).toHaveBeenCalledTimes(1);
    // mock.calls[0] is the [file, pathname] tuple; assert on the pathname arg
    // the action constructed.
    const constructedPathname = vi.mocked(uploadToBlob).mock.calls[0][1];
    expect(constructedPathname.startsWith(expectedPrefix)).toBe(true);
    // The key suffix is `<timestamp>-<sanitized-filename>`; assert the filename
    // survives and a numeric timestamp prefixes it.
    expect(constructedPathname).toMatch(/\/\d+-test\.jpg$/);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.imageId).toBeDefined();
      // The action returns the key it built; it must carry the per-issue prefix.
      expect(result.value.blobPathname).toBe(constructedPathname);
      expect(result.value.blobPathname.startsWith(expectedPrefix)).toBe(true);
    }

    // Assert the row actually persists in the real PGlite DB
    const db = await getTestDb();
    const rows = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.issueId, issueId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.uploadedBy).toBe(reporterId);
    expect(rows[0]?.fullBlobPathname).toBe(constructedPathname);
    expect(rows[0]?.fullBlobPathname.startsWith(expectedPrefix)).toBe(true);
  });

  // NEW coverage: permission-denied path for a non-reporter/non-owner member
  // The unit test could not test this honestly — it required mocking DB ownership
  // rows and the permission helpers simultaneously. Here we use real DB rows.
  //
  // Scenario: a `guest` user who is NOT the reporter of the issue and NOT the
  // machine owner attempts to upload. `issues.update.reporting` grants guest
  // access only on own issues (access: "own"), so this should be AUTH-denied.
  it("denies upload to a guest who is not the issue reporter or machine owner", async () => {
    const db = await getTestDb();

    // Seed reporter (member) and a separate guest outsider
    const reporterId = randomUUID();
    const outsiderId = randomUUID();
    const ownerId = randomUUID();

    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: reporterId, role: "member" }),
        createTestUser({ id: outsiderId, role: "guest" }),
        createTestUser({ id: ownerId, role: "member" }),
      ]);

    const [machine] = await db
      .insert(machines)
      .values({ name: "Perm Test Machine", initials: "PTM", ownerId })
      .returning();

    const [issue] = await db
      .insert(issues)
      .values({
        title: "Perm Test Issue",
        machineInitials: machine.initials,
        issueNumber: 2,
        severity: "major",
        reportedBy: reporterId,
      })
      .returning();

    // Auth: the outsider guest makes the request
    mockAuth(outsiderId);
    mockRateLimitPass();

    vi.mocked(uploadToBlob).mockResolvedValue({
      url: "https://blob.com/should-not-upload.jpg",
      downloadUrl: "https://blob.com/should-not-upload.jpg?download=1",
      pathname: "issue-images/should-not-upload.jpg",
      contentType: "image/jpeg",
      contentDisposition: 'inline; filename="should-not-upload.jpg"',
      etag: "mock-etag",
    });

    const { uploadIssueImage } = await import("~/server/actions/images");

    const formData = new FormData();
    formData.append("issueId", issue.id);
    formData.append("image", createMockFile("test.jpg", "image/jpeg", 2048));

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH");
      expect(result.message).toContain("permission");
    }

    // No blob should have been uploaded or DB row inserted
    expect(uploadToBlob).not.toHaveBeenCalled();
    const rows = await db
      .select()
      .from(issueImages)
      .where(eq(issueImages.issueId, issue.id));
    expect(rows).toHaveLength(0);
  });
});
