import { describe, it, expect } from "vitest";
import { parsePublicIssueForm } from "./validation";

describe("Public Issue Form Validation", () => {
  it("should fail validation when machineId is missing", () => {
    const formData = new FormData();
    formData.set("title", "Test Issue");
    formData.set("severity", "minor");
    formData.set("consistency", "intermittent");

    const result = parsePublicIssueForm(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("machineId");
      // Zod's default error for undefined/missing field when it expects a uuid string
      expect(result.error).toContain(
        "Invalid input: expected string, received undefined"
      );
    }
  });

  it("should fail validation when severity is missing", () => {
    const formData = new FormData();
    formData.set("machineId", "00000000-0000-0000-0000-000000000000");
    formData.set("title", "Test Issue");
    formData.set("consistency", "intermittent");

    const result = parsePublicIssueForm(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("severity");
      expect(result.error).toContain("Select a severity");
    }
  });

  it("should fail validation when title is empty", () => {
    const formData = new FormData();
    formData.set("machineId", "00000000-0000-0000-0000-000000000000");
    formData.set("title", "");
    formData.set("severity", "minor");
    formData.set("consistency", "intermittent");

    const result = parsePublicIssueForm(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("title");
      expect(result.error).toContain("Title is required");
    }
  });

  it("should pass validation when all required fields are present", () => {
    const formData = new FormData();
    formData.set("machineId", "00000000-0000-0000-0000-000000000000");
    formData.set("title", "Valid Title");
    formData.set("severity", "minor");
    formData.set("consistency", "intermittent");

    const result = parsePublicIssueForm(formData);

    expect(result.success).toBe(true);
  });
});
