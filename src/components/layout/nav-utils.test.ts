import { describe, it, expect } from "vitest";
import { isNavItemActive } from "./nav-utils";

describe("isNavItemActive", () => {
  describe("Dashboard tab", () => {
    it("returns true when pathname is /dashboard", () => {
      expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    });

    it("returns false when pathname is /issues", () => {
      expect(isNavItemActive("/dashboard", "/issues")).toBe(false);
    });

    it("returns false when pathname is /m", () => {
      expect(isNavItemActive("/dashboard", "/m")).toBe(false);
    });
  });

  describe("Issues tab", () => {
    it("returns true when pathname is /issues", () => {
      expect(isNavItemActive("/issues", "/issues")).toBe(true);
    });

    it("returns true when the link carries a remembered list query", () => {
      expect(
        isNavItemActive("/issues?status=new&assignee=123", "/issues")
      ).toBe(true);
    });

    it("returns true for issue detail page /m/GDZ/i/2 (NOT Machines)", () => {
      expect(isNavItemActive("/issues", "/m/GDZ/i/2")).toBe(true);
    });

    it("returns true for machine issues list /m/BB/i", () => {
      expect(isNavItemActive("/issues", "/m/BB/i")).toBe(true);
    });

    it("returns true for machine issues list /m/BB/i/", () => {
      expect(isNavItemActive("/issues", "/m/BB/i/")).toBe(true);
    });
  });

  describe("Machines tab", () => {
    it("returns true when pathname is /m", () => {
      expect(isNavItemActive("/m", "/m")).toBe(true);
    });

    it("returns true when pathname is /m/GDZ (machine detail)", () => {
      expect(isNavItemActive("/m", "/m/GDZ")).toBe(true);
    });

    it("returns false for issue detail /m/GDZ/i/2 (belongs to Issues)", () => {
      expect(isNavItemActive("/m", "/m/GDZ/i/2")).toBe(false);
    });

    it("returns false for machine issues list /m/BB/i (belongs to Issues)", () => {
      expect(isNavItemActive("/m", "/m/BB/i")).toBe(false);
    });
  });

  describe("Non-matching paths", () => {
    it("returns false for /report on Dashboard tab", () => {
      expect(isNavItemActive("/dashboard", "/report")).toBe(false);
    });

    it("returns false for /report on Issues tab", () => {
      expect(isNavItemActive("/issues", "/report")).toBe(false);
    });

    it("returns false for /report on Machines tab", () => {
      expect(isNavItemActive("/m", "/report")).toBe(false);
    });

    it("returns false for /settings on all tabs", () => {
      expect(isNavItemActive("/dashboard", "/settings")).toBe(false);
      expect(isNavItemActive("/issues", "/settings")).toBe(false);
      expect(isNavItemActive("/m", "/settings")).toBe(false);
    });
  });

  describe("Remembered list query", () => {
    it("activates Issues tab for issue detail whatever query its link carries", () => {
      expect(
        isNavItemActive("/issues?status=new&assignee=123", "/m/AFM/i/5")
      ).toBe(true);
    });
  });
});
