import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveRedirectPath } from "./route";

describe("resolveRedirectPath", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should accept valid internal path", () => {
    const result = resolveRedirectPath("/dashboard");
    expect(result).toBe("/dashboard");
  });

  it("should reject external URL (open redirect prevention)", () => {
    const result = resolveRedirectPath("https://evil.com/steal-session");
    expect(result).toBe("/");
  });

  it("should reject protocol-relative URL", () => {
    const result = resolveRedirectPath("//evil.com/phishing");
    expect(result).toBe("/");
  });

  it("should handle paths with query params and hash", () => {
    const result = resolveRedirectPath("/dashboard?tab=issues#top");
    expect(result).toBe("/dashboard?tab=issues#top");
  });

  it("should return fallback when nextParam is null", () => {
    const result = resolveRedirectPath(null);
    expect(result).toBe("/");
  });

  it("should accept absolute URL matching site url", () => {
    const result = resolveRedirectPath("http://localhost:3000/dashboard");
    expect(result).toBe("/dashboard");
  });

  it("should reject absolute URL matching a different host (even if it was forwarded host previously)", () => {
    // We simulate a scenario where attacker provided a different host.
    // Since resolveRedirectPath now relies on NEXT_PUBLIC_SITE_URL, it should reject this.
    const result = resolveRedirectPath("https://app.example.com/dashboard");
    expect(result).toBe("/");
  });

  it("should accept absolute URL matching configured production site url", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.com");
    const result = resolveRedirectPath("https://pinpoint.com/dashboard");
    expect(result).toBe("/dashboard");
  });

  it("should reject mismatching site url when production url is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pinpoint.com");
    const result = resolveRedirectPath("http://localhost:3000/dashboard");
    expect(result).toBe("/");
  });
});
