/**
 * Unit test: create_issue idempotency key (PP-u4ab.4)
 *
 * The key is what makes a retried MCP call resolve to the issue already filed
 * instead of a duplicate. It has to hold three properties at once: identical
 * calls in one window collide, anything else does not, and the output is a
 * valid `uuid` because that is the column type it lands in.
 */

import { describe, expect, it } from "vitest";

import { createIssueIdempotencyKey } from "./create-issue";

const USER = "11111111-1111-4111-8111-111111111111";
const MACHINE = "22222222-2222-4222-8222-222222222222";
/**
 * Deliberately *mid*-bucket, not on a boundary. `1_770_000_000_000` is an exact
 * multiple of the 10-minute window, so a test anchored there always sits at the
 * start of a bucket and the "a retry seconds later collides" assertion holds
 * trivially — it would keep passing even if the near-boundary protection
 * regressed to nothing.
 */
const NOW = 1_770_000_000_000 + 100_000;

const base = {
  machine: "AFM",
  title: "left flipper weak",
  description: "Barely reaches the ramp.",
  severity: "major",
} as const;

function key(
  overrides: Partial<Parameters<typeof createIssueIdempotencyKey>[0]> = {},
  now = NOW
): string {
  return createIssueIdempotencyKey(
    { ...base, ...overrides },
    USER,
    MACHINE,
    now
  );
}

describe("createIssueIdempotencyKey", () => {
  it("is a well-formed v8 UUID", () => {
    // Not cosmetic: issues.idempotency_key is a Postgres `uuid` column, so a
    // raw hex digest is rejected outright at query time.
    expect(key()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("is stable for an identical call in the same window", () => {
    expect(key()).toBe(key());
  });

  it("differs when any field of the report differs", () => {
    const original = key();
    expect(key({ title: "right flipper weak" })).not.toBe(original);
    expect(key({ description: "Something else." })).not.toBe(original);
    expect(key({ severity: "minor" })).not.toBe(original);
    expect(key({ priority: "high" })).not.toBe(original);
    expect(key({ frequency: "constant" })).not.toBe(original);
  });

  it("differs per user and per machine", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    expect(
      createIssueIdempotencyKey({ ...base }, other, MACHINE, NOW)
    ).not.toBe(key());
    expect(createIssueIdempotencyKey({ ...base }, USER, other, NOW)).not.toBe(
      key()
    );
  });

  it("holds across a retry seconds later but not weeks later", () => {
    // The window is the whole point: a retry moments later is the same report,
    // while the same fault re-reported later must file a new issue rather than
    // silently resolving to the closed one.
    expect(key({}, NOW + 5_000)).toBe(key());
    expect(key({}, NOW + 30 * 24 * 60 * 60 * 1000)).not.toBe(key());
  });

  it("does not protect a retry that straddles a window boundary", () => {
    // Pins a known limitation rather than a guarantee. The window is tumbling,
    // not sliding, so a call late in one bucket and its retry moments later in
    // the next produce different keys and file a duplicate. That is the safe
    // direction to fail — a visible duplicate, honestly reported as created —
    // and the tool description is worded to match ("usually"), but it must not
    // silently become the common case.
    const boundary = 1_770_000_000_000 + 600_000;
    expect(key({}, boundary - 1_000)).not.toBe(key({}, boundary + 1_000));
  });

  it("does not collide when content shifts across the field boundary", () => {
    // NUL-joining is what stops "ab"+"c" hashing the same as "a"+"bc".
    expect(key({ title: "ab", description: "c" })).not.toBe(
      key({ title: "a", description: "bc" })
    );
  });
});
