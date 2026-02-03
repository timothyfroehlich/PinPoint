import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getLastIssuesPath,
  setLastIssuesPathCookie,
  getSidebarCollapsed,
  setSidebarCollapsedCookie,
} from "./preferences";

// Mock next/headers
const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: mockGet,
      set: mockSet,
    })
  ),
}));

describe("server-side cookie preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLastIssuesPath", () => {
    it("returns stored path when cookie exists", async () => {
      mockGet.mockReturnValue({ value: "/issues?q=test&severity=major" });

      const result = await getLastIssuesPath();

      expect(mockGet).toHaveBeenCalledWith("lastIssuesPath");
      expect(result).toBe("/issues?q=test&severity=major");
    });

    it("returns default /issues when cookie is missing", async () => {
      mockGet.mockReturnValue(undefined);

      const result = await getLastIssuesPath();

      expect(result).toBe("/issues");
    });

    it("returns default /issues when cookie value is null", async () => {
      mockGet.mockReturnValue({ value: null });

      const result = await getLastIssuesPath();

      expect(result).toBe("/issues");
    });
  });

  describe("setLastIssuesPathCookie", () => {
    it("sets cookie with correct options", async () => {
      await setLastIssuesPathCookie("/issues?q=test");

      expect(mockSet).toHaveBeenCalledWith(
        "lastIssuesPath",
        "/issues?q=test",
        expect.objectContaining({
          httpOnly: false,
          sameSite: "lax",
          path: "/",
          maxAge: 31536000, // 1 year
        })
      );
    });
  });

  describe("getSidebarCollapsed", () => {
    it("returns true when cookie value is 'true'", async () => {
      mockGet.mockReturnValue({ value: "true" });

      const result = await getSidebarCollapsed();

      expect(mockGet).toHaveBeenCalledWith("sidebarCollapsed");
      expect(result).toBe(true);
    });

    it("returns false when cookie value is 'false'", async () => {
      mockGet.mockReturnValue({ value: "false" });

      const result = await getSidebarCollapsed();

      expect(result).toBe(false);
    });

    it("returns false when cookie is missing", async () => {
      mockGet.mockReturnValue(undefined);

      const result = await getSidebarCollapsed();

      expect(result).toBe(false);
    });

    it("returns false for any non-'true' value", async () => {
      mockGet.mockReturnValue({ value: "yes" });

      const result = await getSidebarCollapsed();

      expect(result).toBe(false);
    });
  });

  describe("setSidebarCollapsedCookie", () => {
    it("sets cookie with true value", async () => {
      await setSidebarCollapsedCookie(true);

      expect(mockSet).toHaveBeenCalledWith(
        "sidebarCollapsed",
        "true",
        expect.objectContaining({
          httpOnly: false,
          sameSite: "lax",
          path: "/",
        })
      );
    });

    it("sets cookie with false value", async () => {
      await setSidebarCollapsedCookie(false);

      expect(mockSet).toHaveBeenCalledWith(
        "sidebarCollapsed",
        "false",
        expect.any(Object)
      );
    });
  });
});
