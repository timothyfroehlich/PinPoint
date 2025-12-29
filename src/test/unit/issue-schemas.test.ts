import { describe, it, expect } from "vitest";
import {
  createIssueSchema,
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  updateIssuePrioritySchema,
  assignIssueSchema,
} from "~/app/(app)/issues/schemas";

describe("Issue Validation Schemas", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";
  const validInitials = "MM";

  describe("createIssueSchema", () => {
    it("should validate a valid issue", () => {
      const result = createIssueSchema.safeParse({
        title: "Test Issue",
        description: "Test Description",
        machineInitials: validInitials,
        severity: "minor",
        priority: "low",
      });
      expect(result.success).toBe(true);
    });

    it("should validate a valid issue without description", () => {
      const result = createIssueSchema.safeParse({
        title: "Test Issue",
        machineInitials: validInitials,
        severity: "playable",
        priority: "medium",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing title", () => {
      const result = createIssueSchema.safeParse({
        description: "Test Description",
        machineInitials: validInitials,
        severity: "minor",
        priority: "low",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty title", () => {
      const result = createIssueSchema.safeParse({
        title: "",
        machineInitials: validInitials,
        severity: "minor",
        priority: "low",
      });
      expect(result.success).toBe(false);
    });

    it("should reject long title", () => {
      const result = createIssueSchema.safeParse({
        title: "a".repeat(201),
        machineInitials: validInitials,
        severity: "minor",
        priority: "low",
      });
      expect(result.success).toBe(false);
    });

    it("should reject long description", () => {
      const result = createIssueSchema.safeParse({
        title: "Test Issue",
        description: "a".repeat(5001),
        machineInitials: validInitials,
        severity: "minor",
        priority: "low",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid machineInitials", () => {
      const result = createIssueSchema.safeParse({
        title: "Test Issue",
        machineInitials: "A", // too short
        severity: "minor",
        priority: "low",
      });
      expect(result.success).toBe(false);

      const result2 = createIssueSchema.safeParse({
        title: "Test Issue",
        machineInitials: "TOOLONG", // too long
        severity: "minor",
        priority: "low",
      });
      expect(result2.success).toBe(false);

      const result3 = createIssueSchema.safeParse({
        title: "Test Issue",
        machineInitials: "A!", // invalid char
        severity: "minor",
        priority: "low",
      });
      expect(result3.success).toBe(false);
    });

    it("should reject invalid severity", () => {
      const result = createIssueSchema.safeParse({
        title: "Test Issue",
        machineInitials: validInitials,
        severity: "critical", // invalid
        priority: "low",
      });
      expect(result.success).toBe(false);
    });
  });

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
});
