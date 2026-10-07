import { describe, expect, it } from "vitest";
import { parseDay, parsePlausibleDay, UUID_PATTERN } from "./url-state";

describe("UUID_PATTERN", () => {
  it("matches only UUID-shaped person ids, never the sentinels", () => {
    expect(UUID_PATTERN.test("11111111-1111-4111-8111-111111111111")).toBe(
      true
    );
    expect(UUID_PATTERN.test("ABCDEF01-2345-4789-8abc-def012345678")).toBe(
      true
    );
    for (const value of ["me", "unassigned", "", "1111-2222", "x".repeat(36)]) {
      expect(UUID_PATTERN.test(value)).toBe(false);
    }
  });
});

describe("parseDay and parsePlausibleDay", () => {
  it("reads only real calendar days", () => {
    expect(parseDay("2026-02-28")).toBe("2026-02-28");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("soon")).toBeNull();
  });

  it("treats a year still being typed as unfinished", () => {
    for (const partial of ["0002-09-30", "0020-09-30", "0202-09-30"]) {
      expect(parseDay(partial)).toBe(partial);
      expect(parsePlausibleDay(partial)).toBeNull();
    }
    expect(parsePlausibleDay("1900-01-01")).toBe("1900-01-01");
    expect(parsePlausibleDay("2026-09-30")).toBe("2026-09-30");
    expect(parsePlausibleDay("2026-02-30")).toBeNull();
  });
});
