import { describe, it, expect } from "vitest";
import { addCommentSchema } from "~/app/(app)/issues/schemas";

/**
 * Unit tests for comment validation schema
 *
 * Tests the Zod schema used in addCommentAction.
 * These tests validate input without hitting the database.
 */

describe("addCommentSchema", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("should validate correct issueId and comment", () => {
    const result = addCommentSchema.safeParse({
      issueId: validUuid,
      comment: "This is a valid comment",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.issueId).toBe(validUuid);
      expect(result.data.comment).toBe("This is a valid comment");
    }
  });

  it("should reject empty comment", () => {
    const result = addCommentSchema.safeParse({
      issueId: validUuid,
      comment: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Comment cannot be empty"
      );
    }
  });

  it("should reject invalid issueId format", () => {
    const result = addCommentSchema.safeParse({
      issueId: "not-a-uuid",
      comment: "Valid comment",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Invalid ID format");
    }
  });

  it("should reject missing issueId", () => {
    const result = addCommentSchema.safeParse({
      comment: "Valid comment",
    });

    expect(result.success).toBe(false);
  });

  it("should reject missing comment", () => {
    const result = addCommentSchema.safeParse({
      issueId: validUuid,
    });

    expect(result.success).toBe(false);
  });

  it("should trim whitespace and reject whitespace-only comment", () => {
    const result = addCommentSchema.safeParse({
      issueId: validUuid,
      comment: "   ",
    });

    // The schema uses min(1) which checks trimmed length
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Comment cannot be empty"
      );
    }
  });

  it("should accept single character comment", () => {
    const result = addCommentSchema.safeParse({
      issueId: validUuid,
      comment: "x",
    });

    expect(result.success).toBe(true);
  });

  it("should accept comments within limit", () => {
    const longComment = "a".repeat(5000);
    const result = addCommentSchema.safeParse({
      issueId: validUuid,
      comment: longComment,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBe(longComment);
    }
  });

  it("should reject too long comments", () => {
    const longComment = "a".repeat(5001);
    const result = addCommentSchema.safeParse({
      issueId: validUuid,
      comment: longComment,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Comment is too long");
    }
  });
});
