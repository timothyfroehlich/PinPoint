import { describe, it, expect } from "vitest";
import {
  isIssueStatus,
  isIssueSeverity,
  getIssueStatusLabel,
  getIssueSeverityLabel,
  getIssueStatusStyles,
  getIssueSeverityStyles,
} from "~/lib/issues/status";

describe("Issue Status Utilities", () => {
  describe("isIssueStatus", () => {
    it("should return true for valid statuses", () => {
      expect(isIssueStatus("new")).toBe(true);
      expect(isIssueStatus("in_progress")).toBe(true);
      expect(isIssueStatus("resolved")).toBe(true);
    });

    it("should return false for invalid statuses", () => {
      expect(isIssueStatus("archived")).toBe(false);
      expect(isIssueStatus("")).toBe(false);
      expect(isIssueStatus(null)).toBe(false);
      expect(isIssueStatus(undefined)).toBe(false);
      expect(isIssueStatus(123)).toBe(false);
    });
  });

  describe("isIssueSeverity", () => {
    it("should return true for valid severities", () => {
      expect(isIssueSeverity("minor")).toBe(true);
      expect(isIssueSeverity("playable")).toBe(true);
      expect(isIssueSeverity("unplayable")).toBe(true);
    });

    it("should return false for invalid severities", () => {
      expect(isIssueSeverity("critical")).toBe(false);
      expect(isIssueSeverity("")).toBe(false);
      expect(isIssueSeverity(null)).toBe(false);
    });
  });

  describe("getIssueStatusLabel", () => {
    it("should return correct labels", () => {
      expect(getIssueStatusLabel("new")).toBe("New");
      expect(getIssueStatusLabel("in_progress")).toBe("In Progress");
      expect(getIssueStatusLabel("resolved")).toBe("Resolved");
    });
  });

  describe("getIssueSeverityLabel", () => {
    it("should return correct labels", () => {
      expect(getIssueSeverityLabel("minor")).toBe("Minor");
      expect(getIssueSeverityLabel("playable")).toBe("Playable");
      expect(getIssueSeverityLabel("unplayable")).toBe("Unplayable");
    });
  });

  describe("getIssueStatusStyles", () => {
    it("should return styles for all statuses", () => {
      expect(getIssueStatusStyles("new")).toContain("bg-status-new/20");
      expect(getIssueStatusStyles("in_progress")).toContain(
        "bg-status-in-progress/20"
      );
      expect(getIssueStatusStyles("resolved")).toContain(
        "bg-status-resolved/20"
      );
    });
  });

  describe("getIssueSeverityStyles", () => {
    it("should return styles for all severities", () => {
      expect(getIssueSeverityStyles("minor")).toContain("bg-muted/50");
      expect(getIssueSeverityStyles("playable")).toContain("bg-warning/20");
      expect(getIssueSeverityStyles("unplayable")).toContain(
        "bg-status-unplayable/20"
      );
    });
  });
});
