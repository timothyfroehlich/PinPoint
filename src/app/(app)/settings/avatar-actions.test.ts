import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadAvatarAction, deleteAvatarAction } from "./avatar-actions";
import * as blobClient from "~/lib/blob/client";
import * as rateLimit from "~/lib/rate-limit";
import { BLOB_CONFIG } from "~/lib/blob/config";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
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

const mockFindFirst = vi.fn();
const mockDbReturning = vi.fn(() => Promise.resolve([{ id: "test-user" }]));
const mockDbUpdateWhere = vi.fn(() => ({ returning: mockDbReturning }));
const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      userProfiles: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock("~/server/db/schema", () => ({
  userProfiles: { id: "id", avatarUrl: "avatar_url" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockFile(name: string, type: string, sizeInBytes: number): File {
  // For small files, create real content. For large files, use Object.defineProperty
  // to avoid allocating huge buffers in tests.
  const file = new File(["x"], name, { type });
  if (sizeInBytes > 10_000) {
    Object.defineProperty(file, "size", { value: sizeInBytes });
  }
  return sizeInBytes <= 10_000
    ? new File([new Uint8Array(sizeInBytes)], name, { type })
    : file;
}

function authenticateUser(userId = "test-user"): void {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
}

function denyAuth(): void {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

function passRateLimit(): void {
  vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
    success: true,
    limit: 10,
    remaining: 9,
    reset: 0,
  });
}

function failRateLimit(): void {
  vi.mocked(rateLimit.checkImageUploadLimit).mockResolvedValue({
    success: false,
    limit: 10,
    remaining: 0,
    reset: Date.now() + 60_000,
  });
}

function mockBlobUpload(
  url = "https://abc.blob.vercel-storage.com/avatars/test-user/123-test.jpg",
  pathname = "avatars/test-user/123-test.jpg"
): void {
  vi.mocked(blobClient.uploadToBlob).mockResolvedValue({
    url,
    downloadUrl: url,
    pathname,
    contentType: "image/jpeg",
    contentDisposition: 'inline; filename="test.jpg"',
  });
}

function mockProfileLookup(avatarUrl: string | null = null): void {
  mockFindFirst.mockResolvedValue(
    avatarUrl !== null ? { avatarUrl } : undefined
  );
}

function makeAvatarFormData(file?: File): FormData {
  const formData = new FormData();
  if (file) {
    formData.append("avatar", file);
  }
  return formData;
}

function validFile(): File {
  return createMockFile("test.jpg", "image/jpeg", 2048);
}

// ── uploadAvatarAction ─────────────────────────────────────────────────────

describe("uploadAvatarAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail with AUTH if user is not logged in", async () => {
    denyAuth();

    const result = await uploadAvatarAction(makeAvatarFormData());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH");
    }
  });

  it("should fail with RATE_LIMIT when rate limit exceeded", async () => {
    authenticateUser();
    failRateLimit();

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RATE_LIMIT");
    }
  });

  it("should fail with VALIDATION for invalid file type", async () => {
    authenticateUser();
    passRateLimit();

    const file = createMockFile("test.txt", "text/plain", 2048);
    const result = await uploadAvatarAction(makeAvatarFormData(file));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("should fail with VALIDATION when file exceeds avatar size limit", async () => {
    authenticateUser();
    passRateLimit();

    const oversizedFile = createMockFile(
      "huge.jpg",
      "image/jpeg",
      BLOB_CONFIG.AVATAR.MAX_FILE_SIZE_BYTES + 1
    );
    const result = await uploadAvatarAction(makeAvatarFormData(oversizedFile));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
  });

  it("should upload successfully and return the new URL", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup(null);

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.url).toContain("blob.vercel-storage.com");
    }
    expect(blobClient.uploadToBlob).toHaveBeenCalled();
  });

  it("should delete old blob when replacing an existing avatar", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup(
      "https://abc.blob.vercel-storage.com/avatars/test-user/old-avatar.jpg"
    );

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(true);
    // The pathname extracted from the old URL should be passed to deleteFromBlob
    expect(blobClient.deleteFromBlob).toHaveBeenCalledWith(
      "avatars/test-user/old-avatar.jpg"
    );
  });

  it("should delete old local mock upload path when replacing existing avatar", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup(
      "http://localhost:3100/uploads/avatars/test-user/old-avatar.jpg"
    );

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(true);
    expect(blobClient.deleteFromBlob).toHaveBeenCalledWith(
      "avatars/test-user/old-avatar.jpg"
    );
  });

  it("should not delete old blob for OAuth avatar URLs", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup("https://lh3.googleusercontent.com/a/some-google-avatar");

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(true);
    expect(blobClient.deleteFromBlob).not.toHaveBeenCalled();
  });

  it("should not delete blob belonging to a different user", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup(
      "https://abc.blob.vercel-storage.com/avatars/other-user/stolen-avatar.jpg"
    );

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(true);
    expect(blobClient.deleteFromBlob).not.toHaveBeenCalled();
  });

  it("should not delete old blob for external URLs that only contain /uploads/", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup("https://evil.example.com/uploads/fake-avatar.jpg");

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(true);
    expect(blobClient.deleteFromBlob).not.toHaveBeenCalled();
  });

  it("should clean up uploaded blob if profile lookup fails", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockFindFirst.mockRejectedValueOnce(new Error("Profile lookup failed"));

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DATABASE");
    }
    expect(blobClient.deleteFromBlob).toHaveBeenCalledWith(
      "avatars/test-user/123-test.jpg"
    );
  });

  it("should clean up blob and return DATABASE if profile row is missing", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup(null);
    mockDbReturning.mockResolvedValueOnce([]);

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DATABASE");
      expect(result.message).toContain("not found");
    }
    expect(blobClient.deleteFromBlob).toHaveBeenCalledWith(
      "avatars/test-user/123-test.jpg"
    );
  });

  it("should clean up uploaded blob if DB update fails", async () => {
    authenticateUser();
    passRateLimit();
    mockBlobUpload();
    mockProfileLookup(null);
    mockDbUpdateSet.mockImplementationOnce(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockRejectedValue(new Error("DB Error")),
      })),
    }));

    const result = await uploadAvatarAction(makeAvatarFormData(validFile()));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DATABASE");
    }
    // Should clean up the newly uploaded blob
    expect(blobClient.deleteFromBlob).toHaveBeenCalledWith(
      "avatars/test-user/123-test.jpg"
    );
  });
});

// ── deleteAvatarAction ─────────────────────────────────────────────────────

describe("deleteAvatarAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail with AUTH if user is not logged in", async () => {
    denyAuth();

    const result = await deleteAvatarAction();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH");
    }
  });

  it("should delete avatar and clean up blob", async () => {
    authenticateUser();
    mockProfileLookup(
      "https://abc.blob.vercel-storage.com/avatars/test-user/my-avatar.jpg"
    );

    const result = await deleteAvatarAction();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.success).toBe(true);
    }
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(blobClient.deleteFromBlob).toHaveBeenCalledWith(
      "avatars/test-user/my-avatar.jpg"
    );
  });

  it("should not attempt blob deletion for OAuth avatar URLs", async () => {
    authenticateUser();
    mockProfileLookup("https://avatars.githubusercontent.com/u/12345?v=4");

    const result = await deleteAvatarAction();

    expect(result.ok).toBe(true);
    expect(blobClient.deleteFromBlob).not.toHaveBeenCalled();
  });

  it("should succeed even when no avatar exists", async () => {
    authenticateUser();
    mockProfileLookup(null);

    const result = await deleteAvatarAction();

    expect(result.ok).toBe(true);
    expect(blobClient.deleteFromBlob).not.toHaveBeenCalled();
  });

  it("should return DATABASE when profile lookup fails", async () => {
    authenticateUser();
    mockFindFirst.mockRejectedValueOnce(new Error("Profile read failed"));

    const result = await deleteAvatarAction();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DATABASE");
    }
  });
});
