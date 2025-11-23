import { describe, it, expect } from "vitest";
import { publicIssueSchema } from "~/app/report/schemas";

describe("publicIssueSchema", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("should validate valid public issue", () => {
    const result = publicIssueSchema.safeParse({
      machineId: validUuid,
      title: "Public Report",
      description: "Something is wrong",
      severity: "minor",
    });
    expect(result.success).toBe(true);
  });

  it("should validate valid public issue without description", () => {
    const result = publicIssueSchema.safeParse({
      machineId: validUuid,
      title: "Public Report",
      severity: "playable",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing machineId", () => {
    const result = publicIssueSchema.safeParse({
      title: "Public Report",
      severity: "playable",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid machineId", () => {
    const result = publicIssueSchema.safeParse({
      machineId: "not-a-uuid",
      title: "Public Report",
      severity: "playable",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty title", () => {
    const result = publicIssueSchema.safeParse({
      machineId: validUuid,
      title: "",
      severity: "playable",
    });
    expect(result.success).toBe(false);
  });

  it("should reject too long title", () => {
    const result = publicIssueSchema.safeParse({
      machineId: validUuid,
      title: "a".repeat(201),
      severity: "playable",
    });
    expect(result.success).toBe(false);
  });

  it("should reject too long description", () => {
    const result = publicIssueSchema.safeParse({
      machineId: validUuid,
      title: "Public Report",
      description: "a".repeat(2001),
      severity: "playable",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid severity", () => {
    const result = publicIssueSchema.safeParse({
      machineId: validUuid,
      title: "Public Report",
      severity: "bad",
    });
    expect(result.success).toBe(false);
  });
});
