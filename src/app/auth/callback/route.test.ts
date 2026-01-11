import { describe, it, expect } from "vitest";
import { resolveRedirectPath } from "./route";
import { isInternalUrl } from "~/lib/url";

describe("isInternalUrl", () => {
  it("should return true for root path", () => {
    expect(isInternalUrl("/")).toBe(true);
  });

  it("should return true for internal paths", () => {
    expect(isInternalUrl("/dashboard")).toBe(true);
    expect(isInternalUrl("/reset-password")).toBe(true);
    expect(isInternalUrl("/machines/123")).toBe(true);
  });

  it("should return false for external URLs", () => {
    expect(isInternalUrl("http://example.com")).toBe(false);
    expect(isInternalUrl("https://evil.com/phishing")).toBe(false);
  });

  it("should return false for protocol-relative URLs", () => {
    expect(isInternalUrl("//evil.com/phishing")).toBe(false);
    expect(isInternalUrl("//localhost/phishing")).toBe(false);
  });
});

describe("resolveRedirectPath", () => {
  it("should accept valid internal path", () => {
    const result = resolveRedirectPath({
      nextParam: "/dashboard",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/dashboard");
  });

  it("should reject external URL (open redirect prevention)", () => {
    const result = resolveRedirectPath({
      nextParam: "https://evil.com/steal-session",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/");
  });

  it("should reject protocol-relative URL", () => {
    const result = resolveRedirectPath({
      nextParam: "//evil.com/phishing",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/");
  });

  it("should handle paths with query params and hash", () => {
    const result = resolveRedirectPath({
      nextParam: "/dashboard?tab=issues#top",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/dashboard?tab=issues#top");
  });

  it("should return fallback when nextParam is null", () => {
    const result = resolveRedirectPath({
      nextParam: null,
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/");
  });

  it("should accept absolute URL matching origin host", () => {
    const result = resolveRedirectPath({
      nextParam: "http://localhost:3000/dashboard",
      origin: "http://localhost:3000",
      forwardedHost: null,
    });
    expect(result).toBe("/dashboard");
  });

  it("should accept absolute URL matching forwarded host", () => {
    const result = resolveRedirectPath({
      nextParam: "https://app.example.com/dashboard",
      origin: "http://localhost:3000",
      forwardedHost: "app.example.com",
    });
    expect(result).toBe("/dashboard");
  });

  it("should reject absolute URL not matching origin or forwarded host", () => {
    const result = resolveRedirectPath({
      nextParam: "https://evil.com/dashboard",
      origin: "http://test.local",
      forwardedHost: "app.example.com",
    });
    expect(result).toBe("/");
  });
});
