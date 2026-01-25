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

vi.mock("~/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ val: 0 }])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "new-image-id" }])),
      })),
    })),
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
      pathname: "issue-images/pending/test.jpg",
      size: 1024,
      uploadedAt: new Date(),
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

  it("should insert record and revalidate for existing issue", async () => {
    vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    });

    vi.mocked(blobClient.uploadToBlob).mockResolvedValue({
      url: "https://blob.com/test.jpg",
      pathname: "issue-images/test-issue/test.jpg",
      size: 1024,
      uploadedAt: new Date(),
    });

    const formData = new FormData();
    formData.append("issueId", "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    const file = createMockFile("test.jpg", "image/jpeg", 2048);
    formData.append("image", file);

    const result = await uploadIssueImage(formData);

    expect(result.ok).toBe(true);
    expect(db.insert).toHaveBeenCalled();
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
      pathname: "issue-images/test-issue/test.jpg",
      size: 1024,
      uploadedAt: new Date(),
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
});
