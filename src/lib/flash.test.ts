import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFlash, setFlash } from "./flash";

/**
 * Flash Message Tests
 *
 * Regression test for bug discovered in Vercel preview deployment:
 * "Cookies can only be modified in a Server Action or Route Handler"
 * (Digest: 3754571324)
 *
 * The bug occurred because readAndClearFlash() tried to modify cookies
 * in Server Components, which Next.js forbids. This test verifies:
 * 1. readFlash() only reads cookies (doesn't modify them)
 * 2. setFlash() can set cookies with proper expiry
 * 3. Flash messages auto-expire via maxAge
 */

// Mock Next.js cookies API
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("Flash Messages", () => {
  let mockCookieStore: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Reset mock before each test
    mockCookieStore = {
      get: vi.fn(),
      set: vi.fn(),
    };

    // Mock cookies() to return our mock store
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);
  });

  describe("readFlash", () => {
    it("should return null when no flash cookie exists", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const result = await readFlash();

      expect(result).toBeNull();
      expect(mockCookieStore.get).toHaveBeenCalledWith("flash");
      // CRITICAL: Should NOT call set() - this was the bug
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("should read flash message without modifying cookies", async () => {
      const flashData = {
        type: "error" as const,
        message: "Login failed",
      };

      mockCookieStore.get.mockReturnValue({
        value: JSON.stringify(flashData),
      });

      const result = await readFlash();

      expect(result).toEqual(flashData);
      // CRITICAL: Should NOT call set() - Server Components can't modify cookies
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("should return null for invalid JSON without modifying cookies", async () => {
      mockCookieStore.get.mockReturnValue({
        value: "invalid json{",
      });

      const result = await readFlash();

      expect(result).toBeNull();
      // CRITICAL: Should NOT call set() even on parse error
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });
  });

  describe("setFlash", () => {
    it("should set flash cookie with auto-expiry", async () => {
      const flash = {
        type: "success" as const,
        message: "Account created successfully",
      };

      await setFlash(flash);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "flash",
        JSON.stringify(flash),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60, // Auto-expire after 60 seconds
        })
      );
    });

    it("should set flash cookie with field data", async () => {
      const flash = {
        type: "error" as const,
        message: "Validation failed",
        fields: { email: "user@example.com", name: "John" },
      };

      await setFlash(flash);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "flash",
        JSON.stringify(flash),
        expect.any(Object)
      );
    });
  });
});
