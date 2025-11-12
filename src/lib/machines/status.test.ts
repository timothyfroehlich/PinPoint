import { describe, it, expect } from "vitest";
import {
  deriveMachineStatus,
  getMachineStatusLabel,
  getMachineStatusStyles,
  type IssueForStatus,
} from "./status";

describe("deriveMachineStatus", () => {
  it("should return 'operational' when there are no issues", () => {
    const issues: IssueForStatus[] = [];
    expect(deriveMachineStatus(issues)).toBe("operational");
  });

  it("should return 'operational' when all issues are resolved", () => {
    const issues: IssueForStatus[] = [
      { status: "resolved", severity: "unplayable" },
      { status: "resolved", severity: "playable" },
      { status: "resolved", severity: "minor" },
    ];
    expect(deriveMachineStatus(issues)).toBe("operational");
  });

  it("should return 'unplayable' when there is at least one unplayable open issue", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "unplayable" },
      { status: "new", severity: "minor" },
    ];
    expect(deriveMachineStatus(issues)).toBe("unplayable");
  });

  it("should return 'unplayable' when there is an in_progress unplayable issue", () => {
    const issues: IssueForStatus[] = [
      { status: "in_progress", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("unplayable");
  });

  it("should return 'needs_service' when there are only playable issues", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "playable" },
      { status: "in_progress", severity: "playable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("needs_service");
  });

  it("should return 'needs_service' when there are only minor issues", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "minor" },
      { status: "in_progress", severity: "minor" },
    ];
    expect(deriveMachineStatus(issues)).toBe("needs_service");
  });

  it("should return 'needs_service' when there are mixed playable and minor issues", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "playable" },
      { status: "new", severity: "minor" },
    ];
    expect(deriveMachineStatus(issues)).toBe("needs_service");
  });

  it("should ignore resolved issues when determining status", () => {
    const issues: IssueForStatus[] = [
      { status: "resolved", severity: "unplayable" },
      { status: "new", severity: "minor" },
    ];
    expect(deriveMachineStatus(issues)).toBe("needs_service");
  });

  it("should prioritize unplayable over other severities", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "minor" },
      { status: "new", severity: "playable" },
      { status: "new", severity: "unplayable" },
      { status: "resolved", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("unplayable");
  });
});

describe("getMachineStatusLabel", () => {
  it("should return correct label for operational status", () => {
    expect(getMachineStatusLabel("operational")).toBe("Operational");
  });

  it("should return correct label for needs_service status", () => {
    expect(getMachineStatusLabel("needs_service")).toBe("Needs Service");
  });

  it("should return correct label for unplayable status", () => {
    expect(getMachineStatusLabel("unplayable")).toBe("Unplayable");
  });
});

describe("getMachineStatusStyles", () => {
  it("should return correct styles for operational status", () => {
    const styles = getMachineStatusStyles("operational");
    expect(styles).toContain("bg-success-container");
    expect(styles).toContain("text-on-success-container");
    expect(styles).toContain("border-success");
  });

  it("should return correct styles for needs_service status", () => {
    const styles = getMachineStatusStyles("needs_service");
    expect(styles).toContain("bg-warning-container");
    expect(styles).toContain("text-on-warning-container");
    expect(styles).toContain("border-warning");
  });

  it("should return correct styles for unplayable status", () => {
    const styles = getMachineStatusStyles("unplayable");
    expect(styles).toContain("bg-error-container");
    expect(styles).toContain("text-on-error-container");
    expect(styles).toContain("border-error");
  });
});
