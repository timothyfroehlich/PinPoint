import { describe, it, expect } from "vitest";
import {
  isInternalAccount,
  usernameToInternalEmail,
} from "./internal-accounts";

describe("isInternalAccount", () => {
  it("returns true for @pinpoint.internal emails", () => {
    expect(isInternalAccount("jdoe@pinpoint.internal")).toBe(true);
  });

  it("returns false for regular emails", () => {
    expect(isInternalAccount("user@example.com")).toBe(false);
  });

  it("returns false for partial domain match", () => {
    expect(isInternalAccount("user@notpinpoint.internal")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isInternalAccount("")).toBe(false);
  });
});

describe("usernameToInternalEmail", () => {
  it("converts username to internal email", () => {
    expect(usernameToInternalEmail("jdoe")).toBe("jdoe@pinpoint.internal");
  });
});
