import { describe, it, expect, vi, afterEach } from "vitest";
import { BLOB_CONFIG } from "~/lib/blob/config";
import {
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  updateIssuePrioritySchema,
  assignIssueSchema,
  imageMetadataSchema,
} from "~/app/(app)/issues/schemas";

describe("Issue Validation Schemas", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  describe("updateIssueStatusSchema", () => {
    it("should validate valid status update", () => {
      const result = updateIssueStatusSchema.safeParse({
        issueId: validUuid,
        status: "in_progress",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = updateIssueStatusSchema.safeParse({
        issueId: validUuid,
        status: "archived", // invalid
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid issueId", () => {
      const result = updateIssueStatusSchema.safeParse({
        issueId: "invalid",
        status: "new",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateIssueSeveritySchema", () => {
    it("should validate valid severity update", () => {
      const result = updateIssueSeveritySchema.safeParse({
        issueId: validUuid,
        severity: "unplayable",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid severity", () => {
      const result = updateIssueSeveritySchema.safeParse({
        issueId: validUuid,
        severity: "low", // invalid
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid issueId", () => {
      const result = updateIssueSeveritySchema.safeParse({
        issueId: "invalid",
        severity: "minor",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateIssuePrioritySchema", () => {
    it("should validate valid priority update", () => {
      const result = updateIssuePrioritySchema.safeParse({
        issueId: validUuid,
        priority: "high",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid priority", () => {
      const result = updateIssuePrioritySchema.safeParse({
        issueId: validUuid,
        priority: "critical", // invalid
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid issueId", () => {
      const result = updateIssuePrioritySchema.safeParse({
        issueId: "invalid",
        priority: "low",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("assignIssueSchema", () => {
    it("should validate assignment to user", () => {
      const result = assignIssueSchema.safeParse({
        issueId: validUuid,
        assignedTo: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it("should validate unassignment (null)", () => {
      const result = assignIssueSchema.safeParse({
        issueId: validUuid,
        assignedTo: null,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid assignedTo", () => {
      const result = assignIssueSchema.safeParse({
        issueId: validUuid,
        assignedTo: "invalid-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid issueId", () => {
      const result = assignIssueSchema.safeParse({
        issueId: "invalid",
        assignedTo: validUuid,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("imageMetadataSchema fileSizeBytes (PP-ysk3)", () => {
    const base = {
      blobUrl: "https://teststore.public.blob.vercel-storage.com/img.jpg",
      blobPathname: "issue-images/pending/img.jpg",
      originalFilename: "img.jpg",
      mimeType: "image/jpeg",
    };

    it.each([
      ["a whole size within the limit", 12345, true],
      ["exactly the limit", BLOB_CONFIG.MAX_FILE_SIZE_BYTES, true],
      ["a fractional size", 1234.5, false],
      ["a size above the limit", BLOB_CONFIG.MAX_FILE_SIZE_BYTES + 1, false],
      ["a size above Postgres int4", 2 ** 31, false],
      ["zero", 0, false],
    ])("%s → success=%s", (_label, fileSizeBytes, expected) => {
      const result = imageMetadataSchema.safeParse({ ...base, fileSizeBytes });
      expect(result.success).toBe(expected);
    });
  });

  // The stored pathname comes from the host-verified blobUrl, never from the
  // client's blobPathname, so a row cannot name a blob it does not display.
  // (PP-9my0)
  describe("imageMetadataSchema blobPathname (PP-9my0)", () => {
    const base = {
      originalFilename: "img.jpg",
      fileSizeBytes: 12345,
      mimeType: "image/jpeg",
    };

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("replaces a client pathname that names a different blob", () => {
      const result = imageMetadataSchema.parse({
        ...base,
        blobUrl:
          "https://teststore.public.blob.vercel-storage.com/issue-images/pending/1-img-abc.jpg",
        blobPathname: "avatars/someone-else.png",
      });
      expect(result.blobPathname).toBe("issue-images/pending/1-img-abc.jpg");
    });

    it("decodes percent-escapes in the URL path", () => {
      const result = imageMetadataSchema.parse({
        ...base,
        blobUrl:
          "https://teststore.public.blob.vercel-storage.com/issue-images/pending/my%20img.jpg",
        blobPathname: "issue-images/pending/my img.jpg",
      });
      expect(result.blobPathname).toBe("issue-images/pending/my img.jpg");
    });

    it("strips the mock store's /uploads/ prefix", () => {
      vi.stubEnv("MOCK_BLOB_STORAGE", "true");
      const result = imageMetadataSchema.parse({
        ...base,
        blobUrl: "http://localhost:3000/uploads/issue-images/pending/1-img.jpg",
        blobPathname: "avatars/someone-else.png",
      });
      expect(result.blobPathname).toBe("issue-images/pending/1-img.jpg");
    });

    it.each([
      [
        "a Vercel Blob URL with no path",
        "https://teststore.public.blob.vercel-storage.com/",
      ],
      [
        "a mock URL outside /uploads/",
        "http://localhost:3000/avatars/someone-else.png",
      ],
      [
        "a malformed percent-escape",
        "https://teststore.public.blob.vercel-storage.com/bad%E0%A4%A.jpg",
      ],
    ])("rejects %s", (_label, blobUrl) => {
      vi.stubEnv("MOCK_BLOB_STORAGE", "true");
      const result = imageMetadataSchema.safeParse({
        ...base,
        blobUrl,
        blobPathname: "issue-images/pending/img.jpg",
      });
      expect(result.success).toBe(false);
    });
  });
});
