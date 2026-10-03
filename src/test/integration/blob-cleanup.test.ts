/** Real database references and Vercel Blob boundary, through the production cleanup caller. */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  userProfiles,
  issues,
  issueImages,
  machines,
} from "~/server/db/schema";
import {
  createTestUser,
  createTestMachine,
  createTestIssue,
} from "~/test/helpers/factories";

const { mockList, mockDel } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockDel: vi.fn(),
}));
vi.mock("@vercel/blob", () => ({ list: mockList, del: mockDel }));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
import { cleanupOrphanedBlobs } from "~/lib/blob/cleanup";

const NOW = Date.parse("2025-06-15T12:00:00Z");
const OLD = new Date("2025-06-13T00:00:00Z");
const URL_PREFIX = "https://store.blob.vercel-storage.com/";

// Build real rows. No canned Drizzle result or schema imitation can hide a wrong column/query.
async function seedReferences(
  avatarUrl: string | null,
  fullUrl: string,
  croppedUrl: string | null
): Promise<void> {
  const db = await getTestDb();
  const userId = randomUUID();
  await db
    .insert(userProfiles)
    .values(createTestUser({ id: userId, avatarUrl }));
  await db
    .insert(machines)
    .values(createTestMachine({ initials: "BLB", name: "Blob reference" }));
  const [issue] = await db
    .insert(issues)
    .values(createTestIssue("BLB", { reportedBy: userId }))
    .returning();
  if (!issue) throw new Error("Issue fixture insert failed");
  await db.insert(issueImages).values({
    id: randomUUID(),
    issueId: issue.id,
    uploadedBy: userId,
    fullImageUrl: fullUrl,
    croppedImageUrl: croppedUrl,
    fullBlobPathname: "issues/full.jpg",
    ...(croppedUrl ? { croppedBlobPathname: "issues/cropped.jpg" } : {}),
    fileSizeBytes: 12345,
    mimeType: "image/jpeg",
  });
}

function listBlobs(urls: string[]): void {
  mockList.mockResolvedValue({
    blobs: urls.map((url) => ({ url, uploadedAt: OLD })),
    hasMore: false,
  });
}

describe("cleanupOrphanedBlobs", () => {
  setupTestDb();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    mockDel.mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("protects avatar, full and cropped image references and deletes only the orphan", async () => {
    const avatar = `${URL_PREFIX}avatar.jpg`;
    const full = `${URL_PREFIX}full.jpg`;
    const crop = `${URL_PREFIX}crop.jpg`;
    const orphan = `${URL_PREFIX}orphan.jpg`;
    await seedReferences(avatar, full, crop);
    listBlobs([avatar, full, crop, orphan]);
    expect(await cleanupOrphanedBlobs()).toEqual({
      totalBlobs: 4,
      referencedBlobs: 3,
      deletedBlobs: 1,
      skippedGracePeriod: 0,
      errors: [],
    });
    expect(mockDel).toHaveBeenCalledExactlyOnceWith([orphan]);
  });

  it("protects the full image when avatar and crop are null without manufacturing reference strings", async () => {
    const full = `${URL_PREFIX}only-full.jpg`;
    await seedReferences(null, full, null);
    listBlobs([full, "null", "undefined"]);
    expect(await cleanupOrphanedBlobs()).toMatchObject({
      referencedBlobs: 1,
      deletedBlobs: 2,
    });
    expect(mockDel).toHaveBeenCalledExactlyOnceWith(["null", "undefined"]);
  });

  it("does not delete a blob referenced by a real user profile", async () => {
    const referenced = `${URL_PREFIX}avatar-ref.jpg`;
    const db = await getTestDb();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: randomUUID(), avatarUrl: referenced }));
    listBlobs([referenced]);
    expect(await cleanupOrphanedBlobs()).toMatchObject({
      totalBlobs: 1,
      referencedBlobs: 1,
      deletedBlobs: 0,
    });
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("does not delete a blob referenced by a real issue image", async () => {
    const referenced = `${URL_PREFIX}issue-full-ref.jpg`;
    await seedReferences(null, referenced, null);
    listBlobs([referenced]);
    expect(await cleanupOrphanedBlobs()).toMatchObject({
      totalBlobs: 1,
      referencedBlobs: 1,
      deletedBlobs: 0,
    });
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("returns zero counts when storage is empty", async () => {
    listBlobs([]);
    expect(await cleanupOrphanedBlobs()).toEqual({
      totalBlobs: 0,
      referencedBlobs: 0,
      deletedBlobs: 0,
      skippedGracePeriod: 0,
      errors: [],
    });
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("skips orphaned blobs within the 24-hour grace period", async () => {
    mockList.mockResolvedValue({
      blobs: [
        {
          url: `${URL_PREFIX}recent.jpg`,
          uploadedAt: new Date("2025-06-15T11:00:00Z"),
        },
      ],
      hasMore: false,
    });
    expect(await cleanupOrphanedBlobs()).toMatchObject({
      totalBlobs: 1,
      skippedGracePeriod: 1,
      deletedBlobs: 0,
    });
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("deletes orphaned blobs older than the grace period", async () => {
    const orphan = `${URL_PREFIX}orphan.jpg`;
    listBlobs([orphan]);
    expect(await cleanupOrphanedBlobs()).toMatchObject({
      totalBlobs: 1,
      deletedBlobs: 1,
    });
    expect(mockDel).toHaveBeenCalledExactlyOnceWith([orphan]);
  });

  it("handles deletion errors gracefully", async () => {
    const orphan = `${URL_PREFIX}orphan.jpg`;
    listBlobs([orphan]);
    mockDel.mockRejectedValue(new Error("Network error"));
    expect(await cleanupOrphanedBlobs()).toMatchObject({
      deletedBlobs: 0,
      errors: [orphan],
    });
  });

  it("paginates through blob listing", async () => {
    const first = `${URL_PREFIX}old1.jpg`;
    const second = `${URL_PREFIX}old2.jpg`;
    mockList
      .mockResolvedValueOnce({
        blobs: [{ url: first, uploadedAt: OLD }],
        hasMore: true,
        cursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        blobs: [{ url: second, uploadedAt: OLD }],
        hasMore: false,
      });
    expect(await cleanupOrphanedBlobs()).toMatchObject({
      totalBlobs: 2,
      deletedBlobs: 2,
    });
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: "cursor-1" })
    );
    expect(mockDel).toHaveBeenCalledExactlyOnceWith([first, second]);
  });
});
