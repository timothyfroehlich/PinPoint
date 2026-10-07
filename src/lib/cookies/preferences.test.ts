import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChangelogSeen } from "./preferences";

// Mock next/headers
const mockGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet })),
}));

describe("server-side cookie preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
