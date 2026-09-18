import { describe, expect, it } from "vitest";

import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("returns the message of an Error instance", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns the message of an Error subclass instance", () => {
    class CustomError extends Error {}
    expect(errorMessage(new CustomError("nope"))).toBe("nope");
  });

  it("prefers the Error message over any provided fallback", () => {
    expect(errorMessage(new Error("real"), "fallback")).toBe("real");
  });

  it("returns the fallback for a non-Error value when one is given", () => {
    expect(errorMessage("a string", "Unknown")).toBe("Unknown");
    expect(errorMessage(undefined, "Cleanup failed")).toBe("Cleanup failed");
    expect(errorMessage({ code: 500 }, "Upload failed")).toBe("Upload failed");
  });

  it("stringifies a non-Error value when no fallback is given", () => {
    expect(errorMessage("plain string")).toBe("plain string");
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
  });

  it("uses the fallback even when it is an empty string", () => {
    // `fallback ?? String(error)` only falls through on null/undefined, so an
    // explicit empty-string fallback is honored rather than replaced.
    expect(errorMessage("a non-error value", "")).toBe("");
  });
});
