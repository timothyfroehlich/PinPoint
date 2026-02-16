import { describe, it, expect } from "vitest";
import { isInternalAccount } from "./internal-accounts";

/**
 * Tests that isInternalAccount correctly identifies internal emails,
 * validating the guard used in notifications.ts to skip email delivery.
 */
describe("isInternalAccount — notification email skip", () => {
  it("identifies @pinpoint.internal as internal (should skip email)", () => {
    expect(isInternalAccount("testuser@pinpoint.internal")).toBe(true);
    expect(isInternalAccount("jdoe@pinpoint.internal")).toBe(true);
  });

  it("does not flag regular emails as internal (should send email)", () => {
    expect(isInternalAccount("user@example.com")).toBe(false);
    expect(isInternalAccount("admin@test.com")).toBe(false);
  });

  it("does not flag similar-looking domains as internal", () => {
    expect(isInternalAccount("user@fake-pinpoint.internal")).toBe(false);
    expect(isInternalAccount("user@pinpoint.internal.com")).toBe(false);
  });
});
