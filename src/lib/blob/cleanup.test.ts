import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @vercel/blob
const mockList = vi.fn();
const mockDel = vi.fn();
vi.mock("@vercel/blob", () => ({
  list: (...args: unknown[]) => mockList(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

// Mock database
const mockSelect = vi.fn();
vi.mock("~/server/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock blob config
vi.mock("~/lib/blob/config", () => ({
  BLOB_CONFIG: {
    SOFT_DELETE_RETENTION_HOURS: 24,
  },
}));

// Mock schema — provide minimal table references so mock routing works
vi.mock("~/server/db/schema", () => ({
  userProfiles: { avatarUrl: "avatar_url" },
  issueImages: {
    fullImageUrl: "full_image_url",
    croppedImageUrl: "cropped_image_url",
  },
}));

import { cleanupOrphanedBlobs, getReferencedBlobUrls } from "./cleanup";

/** Helper to build a chainable select → from → where mock */
function chainableSelect(rows: Record<string, unknown>[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  // Also allow resolution without where (for issueImages query)
  from.mockImplementation(() => {
    // Return an object that is both thenable and has .where()
    const result = Promise.resolve(rows);
    (result as Record<string, unknown>).where = where;
    return result;
  });
  return { from, where };
}

describe("cleanupOrphanedBlobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero counts when storage is empty", async () => {
    // No blobs in storage
    mockList.mockResolvedValue({ blobs: [], hasMore: false, cursor: "" });

    // No referenced URLs in DB
    const avatarChain = chainableSelect([]);
    const imageChain = chainableSelect([]);
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: avatarChain.from };
      return { from: imageChain.from };
    });

    const result = await cleanupOrphanedBlobs();

    expect(result.totalBlobs).toBe(0);
    expect(result.referencedBlobs).toBe(0);
    expect(result.deletedBlobs).toBe(0);
    expect(result.skippedGracePeriod).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("does not delete referenced blobs", async () => {
    const referencedUrl = "https://store.blob.vercel-storage.com/avatar.jpg";
    const oldDate = new Date("2025-06-10T00:00:00Z");

    mockList.mockResolvedValue({
      blobs: [{ url: referencedUrl, uploadedAt: oldDate }],
      hasMore: false,
      cursor: "",
    });

    const avatarChain = chainableSelect([{ url: referencedUrl }]);
    const imageChain = chainableSelect([]);
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: avatarChain.from };
      return { from: imageChain.from };
    });

    const result = await cleanupOrphanedBlobs();

    expect(result.totalBlobs).toBe(1);
    expect(result.referencedBlobs).toBe(1);
    expect(result.deletedBlobs).toBe(0);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("skips orphaned blobs within the 24-hour grace period", async () => {
    const recentUrl = "https://store.blob.vercel-storage.com/recent.jpg";
    // Uploaded 1 hour ago — within grace period
    const recentDate = new Date("2025-06-15T11:00:00Z");

    mockList.mockResolvedValue({
      blobs: [{ url: recentUrl, uploadedAt: recentDate }],
      hasMore: false,
      cursor: "",
    });

    const avatarChain = chainableSelect([]);
    const imageChain = chainableSelect([]);
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: avatarChain.from };
      return { from: imageChain.from };
    });

    const result = await cleanupOrphanedBlobs();

    expect(result.totalBlobs).toBe(1);
    expect(result.skippedGracePeriod).toBe(1);
    expect(result.deletedBlobs).toBe(0);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("deletes orphaned blobs older than the grace period", async () => {
    const orphanUrl = "https://store.blob.vercel-storage.com/orphan.jpg";
    // Uploaded 2 days ago — outside grace period
    const oldDate = new Date("2025-06-13T00:00:00Z");

    mockList.mockResolvedValue({
      blobs: [{ url: orphanUrl, uploadedAt: oldDate }],
      hasMore: false,
      cursor: "",
    });

    mockDel.mockResolvedValue(undefined);

    const avatarChain = chainableSelect([]);
    const imageChain = chainableSelect([]);
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: avatarChain.from };
      return { from: imageChain.from };
    });

    const result = await cleanupOrphanedBlobs();

    expect(result.totalBlobs).toBe(1);
    expect(result.deletedBlobs).toBe(1);
    expect(mockDel).toHaveBeenCalledWith([orphanUrl]);
  });

  it("handles deletion errors gracefully", async () => {
    const orphanUrl = "https://store.blob.vercel-storage.com/orphan.jpg";
    const oldDate = new Date("2025-06-13T00:00:00Z");

    mockList.mockResolvedValue({
      blobs: [{ url: orphanUrl, uploadedAt: oldDate }],
      hasMore: false,
      cursor: "",
    });

    mockDel.mockRejectedValue(new Error("Network error"));

    const avatarChain = chainableSelect([]);
    const imageChain = chainableSelect([]);
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: avatarChain.from };
      return { from: imageChain.from };
    });

    const result = await cleanupOrphanedBlobs();

    expect(result.deletedBlobs).toBe(0);
    expect(result.errors).toEqual([orphanUrl]);
  });

  it("paginates through blob listing", async () => {
    const blob1 = {
      url: "https://store.blob.vercel-storage.com/old1.jpg",
      uploadedAt: new Date("2025-06-10T00:00:00Z"),
    };
    const blob2 = {
      url: "https://store.blob.vercel-storage.com/old2.jpg",
      uploadedAt: new Date("2025-06-10T00:00:00Z"),
    };

    // First page returns 1 blob with cursor, second page returns 1 blob
    mockList
      .mockResolvedValueOnce({
        blobs: [blob1],
        hasMore: true,
        cursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        blobs: [blob2],
        hasMore: false,
        cursor: "",
      });

    mockDel.mockResolvedValue(undefined);

    const avatarChain = chainableSelect([]);
    const imageChain = chainableSelect([]);
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: avatarChain.from };
      return { from: imageChain.from };
    });

    const result = await cleanupOrphanedBlobs();

    expect(result.totalBlobs).toBe(2);
    expect(result.deletedBlobs).toBe(2);
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "cursor-1" })
    );
  });
});

describe("getReferencedBlobUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects avatar URLs and image URLs", async () => {
    const avatarUrl = "https://store.blob.vercel-storage.com/avatar.jpg";
    const fullUrl = "https://store.blob.vercel-storage.com/full.jpg";
    const croppedUrl = "https://store.blob.vercel-storage.com/cropped.jpg";

    const avatarChain = chainableSelect([{ url: avatarUrl }]);
    const imageChain = chainableSelect([{ fullUrl, croppedUrl }]);

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return { from: avatarChain.from };
      return { from: imageChain.from };
    });

    const urls = await getReferencedBlobUrls();

    expect(urls.has(avatarUrl)).toBe(true);
    expect(urls.has(fullUrl)).toBe(true);
    expect(urls.has(croppedUrl)).toBe(true);
    expect(urls.size).toBe(3);
  });
});
