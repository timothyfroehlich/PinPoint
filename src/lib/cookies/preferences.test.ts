import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getLastIssuesPath,
  setLastIssuesPathCookie,
  getChangelogSeen,
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

  describe("getChangelogSeen", () => {
    it("returns stored count when cookie has valid number", async () => {
      mockGet.mockReturnValue({ value: "42" });

      const result = await getChangelogSeen();

      expect(mockGet).toHaveBeenCalledWith("changelogSeen");
      expect(result).toBe(42);
    });

    it("returns 0 when cookie is missing", async () => {
      mockGet.mockReturnValue(undefined);

      const result = await getChangelogSeen();

      expect(result).toBe(0);
    });

    it("returns 0 when cookie value is not a number", async () => {
      mockGet.mockReturnValue({ value: "abc" });

      const result = await getChangelogSeen();

      expect(result).toBe(0);
    });

    it("returns 0 when cookie value is negative", async () => {
      mockGet.mockReturnValue({ value: "-5" });

      const result = await getChangelogSeen();

      expect(result).toBe(0);
    });
  });
});
