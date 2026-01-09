import { describe, it, expect } from "vitest";
import {
  getIssueStatusLabel,
  getIssueStatusIcon,
  STATUS_STYLES,
  SEVERITY_STYLES,
  ALL_STATUS_OPTIONS,
  ISSUE_STATUSES,
} from "~/lib/issues/status";
import { Circle, CircleDot, Disc } from "lucide-react";

describe("Issue Status Utilities", () => {
  describe("getIssueStatusIcon", () => {
    it("should return Circle for new statuses", () => {
      expect(getIssueStatusIcon("new")).toBe(Circle);
      expect(getIssueStatusIcon("confirmed")).toBe(Circle);
    });

    it("should return CircleDot for in-progress statuses", () => {
      expect(getIssueStatusIcon(ISSUE_STATUSES.IN_PROGRESS)).toBe(CircleDot);
      expect(getIssueStatusIcon(ISSUE_STATUSES.WAIT_OWNER)).toBe(CircleDot);
    });

    it("should return Disc for closed statuses", () => {
      expect(getIssueStatusIcon("fixed")).toBe(Disc);
      expect(getIssueStatusIcon("duplicate")).toBe(Disc);
    });
  });

  describe("getIssueStatusLabel", () => {
    it("should return correct labels", () => {
      expect(getIssueStatusLabel("new")).toBe("New");
      expect(getIssueStatusLabel("confirmed")).toBe("Confirmed");
      expect(getIssueStatusLabel("in_progress")).toBe("In Progress");
      expect(getIssueStatusLabel("fixed")).toBe("Fixed");
      expect(getIssueStatusLabel("wai")).toBe("As Intended");
    });
  });

  describe("Constants", () => {
    it("ALL_STATUS_OPTIONS should contain all statuses", () => {
      expect(ALL_STATUS_OPTIONS).toContain("new");
      expect(ALL_STATUS_OPTIONS).toContain("fixed");
      expect(ALL_STATUS_OPTIONS.length).toBe(11);
    });

    it("STATUS_STYLES should have styles for all statuses", () => {
      ALL_STATUS_OPTIONS.forEach((status) => {
        expect(STATUS_STYLES[status]).toBeDefined();
        expect(typeof STATUS_STYLES[status]).toBe("string");
      });
    });

    it("SEVERITY_STYLES should have styles for all severities", () => {
      const severities = ["cosmetic", "minor", "major", "unplayable"] as const;
      severities.forEach((sev) => {
        expect(SEVERITY_STYLES[sev]).toBeDefined();
      });
    });
  });
});
