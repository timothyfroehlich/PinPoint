import { describe, it, expect } from "vitest";
import {
  deriveMachineStatus,
  getMachineStatusLabel,
  getMachineStatusStyles,
} from "~/lib/machines/status";
import type { IssueForStatus } from "~/lib/machines/status";

describe("deriveMachineStatus", () => {
  it("returns operational when there are no open issues", () => {
    const issues: IssueForStatus[] = [
      { status: "fixed", severity: "major" },
      { status: "wont_fix", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("operational");
  });

  it("returns operational when open issues are only minor or cosmetic", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "minor" },
      { status: "in_progress", severity: "cosmetic" },
    ];
    expect(deriveMachineStatus(issues)).toBe("operational");
  });

  it("returns needs_service when there is at least one major issue", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "minor" },
      { status: "in_progress", severity: "major" },
    ];
    expect(deriveMachineStatus(issues)).toBe("needs_service");
  });

  it("returns unplayable when there is at least one unplayable issue", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "minor" },
      { status: "in_progress", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("unplayable");
  });

  it("prioritizes unplayable over major", () => {
    const issues: IssueForStatus[] = [
      { status: "new", severity: "major" },
      { status: "in_progress", severity: "unplayable" },
    ];
    expect(deriveMachineStatus(issues)).toBe("unplayable");
  });

  it("returns operational for an empty list of issues", () => {
    const issues: IssueForStatus[] = [];
    expect(deriveMachineStatus(issues)).toBe("operational");
  });
});

describe("getMachineStatusLabel", () => {
  it("returns the correct label for each status", () => {
    expect(getMachineStatusLabel("operational")).toBe("Operational");
    expect(getMachineStatusLabel("needs_service")).toBe("Needs Service");
    expect(getMachineStatusLabel("unplayable")).toBe("Unplayable");
  });
});

describe("getMachineStatusStyles", () => {
  it("returns the correct styles for each status", () => {
    const operationalStyles = getMachineStatusStyles("operational");
    expect(operationalStyles).toContain("bg-success-container");
    expect(operationalStyles).toContain("text-on-success-container");

    const needsServiceStyles = getMachineStatusStyles("needs_service");
    expect(needsServiceStyles).toContain("bg-warning-container");
    expect(needsServiceStyles).toContain("text-on-warning-container");

    const unplayableStyles = getMachineStatusStyles("unplayable");
    expect(unplayableStyles).toContain("bg-error-container");
    expect(unplayableStyles).toContain("text-on-error-container");
  });
});
