import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

// Mock server-only (no-op in test environment)
vi.mock("server-only", () => ({}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("verifyTurnstileToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it("returns true when TURNSTILE_SECRET_KEY is not set in development (graceful skip)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = "test";
    const result = await verifyTurnstileToken("some-token");
    expect(result).toBe(true);
  });

  it("returns false when TURNSTILE_SECRET_KEY is not set in production", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = "production";
    const result = await verifyTurnstileToken("some-token");
    expect(result).toBe(false);
  });

  it("returns false when token is empty", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const result = await verifyTurnstileToken("");
    expect(result).toBe(false);
  });

  it("returns true for a valid token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await verifyTurnstileToken("valid-token", "1.2.3.4");
    expect(result).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );

    // Verify the body contains the right params
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = callArgs[1].body as string;
    expect(body).toContain("secret=test-secret");
    expect(body).toContain("response=valid-token");
    expect(body).toContain("remoteip=1.2.3.4");
  });

  it("returns false when Cloudflare says verification failed", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: false,
          "error-codes": ["invalid-input-response"],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await verifyTurnstileToken("invalid-token");
    expect(result).toBe(false);
  });

  it("returns false when HTTP request fails", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await verifyTurnstileToken("some-token");
    expect(result).toBe(false);
  });

  it("returns false when fetch throws an error", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";

    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await verifyTurnstileToken("some-token");
    expect(result).toBe(false);
  });

  it("does not send remoteip when ip is not provided", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await verifyTurnstileToken("valid-token");

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = callArgs[1].body as string;
    expect(body).not.toContain("remoteip");
  });
});
