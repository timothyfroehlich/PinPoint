import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadIssueImage } from "./images";
import * as blobClient from "~/lib/blob/client";
import * as rateLimit from "~/lib/rate-limit";
import { db } from "~/server/db";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: "test-user" } } })
      ),
    },
  })),
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

let mockSelectCount = 0;

vi.mock("~/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ val: mockSelectCount }])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "new-image-id" }])),
      })),
    })),
    query: {
      issues: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            reportedBy: "test-user",
            assignedTo: null,
            machine: { ownerId: null },
          })
        ),
      },
      userProfiles: {
        findFirst: vi.fn(() => Promise.resolve({ role: "member" })),
      },
      issueComments: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            issueId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          })
        ),
      },
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

/**
 * Helper to create a File of specific size
 */
function createMockFile(name: string, type: string, sizeInBytes: number) {
  const content = new Array(sizeInBytes).fill("x").join("");
  return new File([content], name, { type });
}

describe("uploadIssueImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectCount = 0;
  });

  it("should fail if rate limit exceeded", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 1000,
    });

    const formData = new FormData();
    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RATE_LIMIT");
    }
  });

  it("should fail if no image provided", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });

    const formData = new FormData();
    formData.append("issueId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("should upload image and return metadata for new issue", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });

    vi.mocked(blobClient.uploadToBlob).mockResolvedValue({
      url: "https://blob.com/test.jpg",
      downloadUrl: "https://blob.com/test.jpg?download=1",
      pathname: "issue-images/pending/test.jpg",
      contentType: "image/jpeg",
      contentDisposition: 'inline; filename="test.jpg"',
      etag: "test-etag",
    });

    const formData = new FormData();
    formData.append("issueId", "new");
    const file = createMockFile("test.jpg", "image/jpeg", 2048);
    formData.append("image", file);

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.blobUrl).toBe("https://blob.com/test.jpg");
    }
    expect(blobClient.uploadToBlob).toHaveBeenCalled();
  });

  it("should handle blob upload failure for new issue", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });

    vi.mocked(blobClient.uploadToBlob).mockRejectedValue(
      new Error("Storage unavailable")
    );

    const formData = new FormData();
    formData.append("issueId", "new");
    const file = createMockFile("test.jpg", "image/jpeg", 2048);
    formData.append("image", file);

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("BLOB");
      expect(result.message).toBe("Storage unavailable");
    }
  });

  it("should cleanup blob if DB insert fails", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });

    vi.mocked(blobClient.uploadToBlob).mockResolvedValue({
      url: "https://blob.com/test.jpg",
      downloadUrl: "https://blob.com/test.jpg?download=1",
      pathname: "issue-images/test-issue/test.jpg",
      contentType: "image/jpeg",
      contentDisposition: 'inline; filename="test.jpg"',
      etag: "test-etag",
    });

    vi.mocked(db.insert).mockImplementation(() => {
      throw new Error("DB Error");
    });

    const formData = new FormData();
    formData.append("issueId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    const file = createMockFile("test.jpg", "image/jpeg", 2048);
    formData.append("image", file);

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DATABASE");
    }
    expect(blobClient.deleteFromBlob).toHaveBeenCalledWith(
      "issue-images/test-issue/test.jpg"
    );
  });

  it("should allow upload even if user has previous images in database (no lifetime cap)", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });

    vi.mocked(blobClient.uploadToBlob).mockResolvedValue({
      url: "https://blob.com/test.jpg",
      downloadUrl: "https://blob.com/test.jpg?download=1",
      pathname: "issue-images/pending/test.jpg",
      contentType: "image/jpeg",
      contentDisposition: 'inline; filename="test.jpg"',
      etag: "test-etag",
    });

    const formData = new FormData();
    formData.append("issueId", "new");
    const file = createMockFile("test.jpg", "image/jpeg", 2048);
    formData.append("image", file);

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.blobUrl).toBe("https://blob.com/test.jpg");
    }
  });

  it("should reject upload if issue total image limit is reached on existing issue", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });

    mockSelectCount = 10;

    const formData = new FormData();
    formData.append("issueId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    const file = createMockFile("test.jpg", "image/jpeg", 2048);
    formData.append("image", file);

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
      expect(result.message).toBe("This issue has reached its image limit.");
    }
    expect(blobClient.uploadToBlob).not.toHaveBeenCalled();
  });
});
