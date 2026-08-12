/**
 * Unit test: add_issue_comment idempotency key (PP-u4ab.14)
 *
 * Mirrors create-issue.test.ts. The key is what makes a retried MCP call
 * resolve to the comment already posted instead of double-posting. It has to
 * hold three properties at once: identical calls in one window collide,
 * anything else does not, and the output is a valid `uuid` because that is the
 * column type it lands in.
 */

import { describe, expect, it } from "vitest";

import { createCommentIdempotencyKey } from "./add-issue-comment";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const ISSUE = "33333333-3333-4333-8333-333333333333";
const OTHER_ISSUE = "44444444-4444-4444-8444-444444444444";
const COMMENT = "Checked the coil sleeve.";

/**
 * Deliberately *mid*-bucket, not on a boundary. `1_770_000_000_000` is an exact
 * multiple of the 10-minute window, so a test anchored there always sits at the
 * start of a bucket and the "a retry seconds later collides" assertion holds
 * trivially — it would keep passing even if the near-boundary protection
 * regressed to nothing.
 */
const NOW = 1_770_000_000_000 + 100_000;

const UUID_V8_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createCommentIdempotencyKey", () => {
  it("produces a valid v8 UUID", () => {
    expect(createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW)).toMatch(
      UUID_V8_RE
    );
  });

  it("collides for an identical retry seconds later", () => {
    expect(createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW + 5_000)).toBe(
      createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW)
    );
  });

  it("differs on comment text", () => {
    expect(
      createCommentIdempotencyKey(ISSUE, "Something else.", USER, NOW)
    ).not.toBe(createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW));
  });

  it("differs on issue and on author", () => {
    const base = createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW);
    expect(
      createCommentIdempotencyKey(OTHER_ISSUE, COMMENT, USER, NOW)
    ).not.toBe(base);
    expect(
      createCommentIdempotencyKey(ISSUE, COMMENT, OTHER_USER, NOW)
    ).not.toBe(base);
  });

  it("differs across windows", () => {
    expect(
      createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW + 11 * 60 * 1000)
    ).not.toBe(createCommentIdempotencyKey(ISSUE, COMMENT, USER, NOW));
  });

  it("does not let field content impersonate a field boundary", () => {
    // NUL-joining is what makes this hold: with a plain separator, an issue id
    // ending in the separator plus a comment starting after it would hash the
    // same as the unshifted pair.
    expect(createCommentIdempotencyKey("ab", "c", USER, NOW)).not.toBe(
      createCommentIdempotencyKey("a", "bc", USER, NOW)
    );
  });
});
