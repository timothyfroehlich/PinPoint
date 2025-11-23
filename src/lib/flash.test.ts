import { describe, it, expect, vi, beforeEach } from "vitest";
import { setFlash, readFlash, type Flash } from "./flash";
import { cookies } from "next/headers";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("Flash Messages", () => {
  let cookieStore: Map<string, { value: string; options?: unknown }>;

  beforeEach(() => {
    cookieStore = new Map();
    (
      cookies as unknown as { mockReturnValue: (val: unknown) => void }
    ).mockReturnValue({
      set: vi.fn((key: string, value: string, options?: unknown) => {
        cookieStore.set(key, { value, options });
      }),
      get: vi.fn((key: string) => {
        return cookieStore.get(key);
      }),
    });
  });

  it("should encode special characters in flash messages", async () => {
    const flash: Flash = {
      type: "error",
      message: "Password must contain !@#$%^&*()",
    };

    await setFlash(flash);

    const stored = cookieStore.get("flash");
    expect(stored).toBeDefined();
    // Verify it's encoded (no raw % or special chars that break URI)
    expect(stored?.value).not.toContain("%^&");
    expect(stored?.value).toContain(encodeURIComponent(flash.message));
  });

  it("should decode flash messages correctly", async () => {
    const originalFlash: Flash = {
      type: "error",
      message: "Complex message with % and & and spaces",
    };

    // Manually set encoded value
    cookieStore.set("flash", {
      value: encodeURIComponent(JSON.stringify(originalFlash)),
    });

    const result = await readFlash();
    expect(result).toEqual(originalFlash);
  });

  it("should handle malformed URI components gracefully", async () => {
    // Set a value that would cause URIError if not handled
    // e.g. a raw "%" at the end
    cookieStore.set("flash", {
      value: "invalid%sequence",
    });

    const result = await readFlash();
    expect(result).toBeNull();
  });

  it("should handle invalid JSON gracefully", async () => {
    cookieStore.set("flash", {
      value: encodeURIComponent("not json"),
    });

    const result = await readFlash();
    expect(result).toBeNull();
  });
});
