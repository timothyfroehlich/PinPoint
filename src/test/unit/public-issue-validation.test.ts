import { describe, it, expect } from "vitest";
import { parsePublicIssueForm } from "~/app/report/validation";

const buildFormData = (
  entries: Record<string, string | undefined>
): FormData => {
  const formData = new FormData();
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, value);
    }
  });
  return formData;
};

describe("parsePublicIssueForm", () => {
  it("returns data for valid input", () => {
    const formData = buildFormData({
      machineId: "123e4567-e89b-12d3-a456-426614174000",
      title: "Flipper stuck",
      description: "Left flipper sometimes sticks halfway.",
      severity: "minor",
      consistency: "intermittent",
    });

    const result = parsePublicIssueForm(formData);

    expect(result).toHaveProperty("success", true);
    if (result.success) {
      expect(result.data.title).toBe("Flipper stuck");
      expect(result.data.severity).toBe("minor");
      expect(result.data.consistency).toBe("intermittent");
    }
  });

  it("returns error when required fields are missing", () => {
    const formData = buildFormData({
      title: "Missing machine",
      severity: "playable",
    });

    const result = parsePublicIssueForm(formData);

    if (result.success) {
      throw new Error("Expected validation to fail");
    }
    expect(result.error).toMatch(/machine|machineId/i);
  });

  it("returns error when severity is invalid", () => {
    const formData = buildFormData({
      machineId: "123e4567-e89b-12d3-a456-426614174000",
      title: "Bad severity",
      severity: "critical",
    });

    const result = parsePublicIssueForm(formData);

    if (result.success) {
      throw new Error("Expected validation to fail");
    }
    expect(result.error).toMatch(/severity/i);
  });
});
