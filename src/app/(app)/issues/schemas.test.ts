import { describe, it, expect } from "vitest";
import {
  createIssueSchema,
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  assignIssueSchema,
} from "./schemas";

describe("Issue Validation Schemas", () => {
  describe("createIssueSchema", () => {
    it("should accept valid issue data", () => {
      const validData = {
        title: "Test Issue",
        description: "This is a test issue",
        machineId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "playable" as const,
      };

      const result = createIssueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept issue without description", () => {
      const validData = {
        title: "Test Issue",
        machineId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "minor" as const,
      };

      const result = createIssueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should trim title whitespace", () => {
      const data = {
        title: "  Test Issue  ",
        machineId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "playable" as const,
      };

      const result = createIssueSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Test Issue");
      }
    });

    it("should reject empty title", () => {
      const invalidData = {
        title: "",
        machineId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "playable" as const,
      };

      const result = createIssueSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("required");
      }
    });

    it("should reject title longer than 200 characters", () => {
      const invalidData = {
        title: "a".repeat(201),
        machineId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "playable" as const,
      };

      const result = createIssueSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("less than 200");
      }
    });

    it("should reject invalid machine ID format", () => {
      const invalidData = {
        title: "Test Issue",
        machineId: "not-a-uuid",
        severity: "playable" as const,
      };

      const result = createIssueSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Invalid machine ID");
      }
    });

    it("should reject invalid severity", () => {
      const invalidData = {
        title: "Test Issue",
        machineId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "critical",
      };

      const result = createIssueSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Invalid option");
      }
    });

    it("should accept all valid severity values", () => {
      const severities = ["minor", "playable", "unplayable"] as const;

      severities.forEach((severity) => {
        const data = {
          title: "Test Issue",
          machineId: "550e8400-e29b-41d4-a716-446655440000",
          severity,
        };

        const result = createIssueSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("updateIssueStatusSchema", () => {
    it("should accept valid status update", () => {
      const validData = {
        issueId: "550e8400-e29b-41d4-a716-446655440000",
        status: "in_progress" as const,
      };

      const result = updateIssueStatusSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept all valid status values", () => {
      const statuses = ["new", "in_progress", "resolved"] as const;

      statuses.forEach((status) => {
        const data = {
          issueId: "550e8400-e29b-41d4-a716-446655440000",
          status,
        };

        const result = updateIssueStatusSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      const invalidData = {
        issueId: "550e8400-e29b-41d4-a716-446655440000",
        status: "pending",
      };

      const result = updateIssueStatusSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Invalid option");
      }
    });

    it("should reject invalid issue ID", () => {
      const invalidData = {
        issueId: "not-a-uuid",
        status: "new" as const,
      };

      const result = updateIssueStatusSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Invalid issue ID");
      }
    });
  });

  describe("updateIssueSeveritySchema", () => {
    it("should accept valid severity update", () => {
      const validData = {
        issueId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "unplayable" as const,
      };

      const result = updateIssueSeveritySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid severity", () => {
      const invalidData = {
        issueId: "550e8400-e29b-41d4-a716-446655440000",
        severity: "critical",
      };

      const result = updateIssueSeveritySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Invalid option");
      }
    });
  });

  describe("assignIssueSchema", () => {
    it("should accept valid assignment", () => {
      const validData = {
        issueId: "550e8400-e29b-41d4-a716-446655440000",
        assigneeId: "660e8400-e29b-41d4-a716-446655440001",
      };

      const result = assignIssueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept null assigneeId for unassignment", () => {
      const validData = {
        issueId: "550e8400-e29b-41d4-a716-446655440000",
        assigneeId: null,
      };

      const result = assignIssueSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid assignee ID", () => {
      const invalidData = {
        issueId: "550e8400-e29b-41d4-a716-446655440000",
        assigneeId: "not-a-uuid",
      };

      const result = assignIssueSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Invalid user ID");
      }
    });
  });
});
