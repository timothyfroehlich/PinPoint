import { describe, it, expect } from "vitest";
import { isNavItemActive } from "./nav-utils";

describe("isNavItemActive", () => {
  describe("Dashboard tab", () => {
    it("returns true when pathname is /dashboard", () => {
      expect(isNavItemActive("/dashboard", "/dashboard", "/issues")).toBe(true);
    });

    it("returns false when pathname is /issues", () => {
      expect(isNavItemActive("/dashboard", "/issues", "/issues")).toBe(false);
    });

    it("returns false when pathname is /m", () => {
      expect(isNavItemActive("/dashboard", "/m", "/issues")).toBe(false);
    });
  });

  describe("Issues tab", () => {
    it("returns true when pathname is /issues", () => {
      expect(isNavItemActive("/issues", "/issues", "/issues")).toBe(true);
    });

    it("returns true when pathname is /issues with query params", () => {
      expect(isNavItemActive("/issues", "/issues", "/issues?status=open")).toBe(
        true
      );
    });

    it("returns true when resolvedIssuesPath has query params and pathname matches base", () => {
      expect(
        isNavItemActive(
          "/issues",
          "/issues",
          "/issues?status=open&assignee=123"
        )
      ).toBe(true);
    });

    it("returns true for issue detail page /m/GDZ/i/2 (NOT Machines)", () => {
      expect(isNavItemActive("/issues", "/m/GDZ/i/2", "/issues")).toBe(true);
    });

    it("returns true for machine issues list /m/BB/i", () => {
      expect(isNavItemActive("/issues", "/m/BB/i", "/issues")).toBe(true);
    });

    it("returns true for machine issues list /m/BB/i/", () => {
      expect(isNavItemActive("/issues", "/m/BB/i/", "/issues")).toBe(true);
    });
  });

  describe("Machines tab", () => {
    it("returns true when pathname is /m", () => {
      expect(isNavItemActive("/m", "/m", "/issues")).toBe(true);
    });

    it("returns true when pathname is /m/GDZ (machine detail)", () => {
      expect(isNavItemActive("/m", "/m/GDZ", "/issues")).toBe(true);
    });

    it("returns false for issue detail /m/GDZ/i/2 (belongs to Issues)", () => {
      expect(isNavItemActive("/m", "/m/GDZ/i/2", "/issues")).toBe(false);
    });

    it("returns false for machine issues list /m/BB/i (belongs to Issues)", () => {
      expect(isNavItemActive("/m", "/m/BB/i", "/issues")).toBe(false);
    });
  });

  describe("Non-matching paths", () => {
    it("returns false for /report on Dashboard tab", () => {
      expect(isNavItemActive("/dashboard", "/report", "/issues")).toBe(false);
    });

    it("returns false for /report on Issues tab", () => {
      expect(isNavItemActive("/issues", "/report", "/issues")).toBe(false);
    });

    it("returns false for /report on Machines tab", () => {
      expect(isNavItemActive("/m", "/report", "/issues")).toBe(false);
    });

    it("returns false for /settings on all tabs", () => {
      expect(isNavItemActive("/dashboard", "/settings", "/issues")).toBe(false);
      expect(isNavItemActive("/issues", "/settings", "/issues")).toBe(false);
      expect(isNavItemActive("/m", "/settings", "/issues")).toBe(false);
    });
  });

  describe("Custom issuesPath", () => {
    it("activates Issues tab when issuesPath is /issues?status=open&assignee=123", () => {
      expect(
        isNavItemActive(
          "/issues",
          "/issues",
          "/issues?status=open&assignee=123"
        )
      ).toBe(true);
    });

    it("activates Issues tab for issue detail even with custom issuesPath", () => {
      expect(
        isNavItemActive(
          "/issues",
          "/m/AFM/i/5",
          "/issues?status=open&assignee=123"
        )
      ).toBe(true);
    });
  });
});
