/**
 * Unit test: the shared issue-title rule (PP-61u5).
 *
 * Every issue write path parses its title through `issueTitleSchema`, so this
 * is where "a title is one line, at most ISSUE_TITLE_MAX characters" is pinned.
 * The write-path tests (public report action, MCP tools) only prove the wiring.
 */

import { describe, expect, it } from "vitest";

import {
  ISSUE_TITLE_MAX,
  ISSUE_TITLE_MAX_MESSAGE,
  issueTitleSchema,
} from "./title";

const schema = issueTitleSchema({
  required: "Title is required",
  tooLong: ISSUE_TITLE_MAX_MESSAGE,
});

function firstMessage(input: string): string | undefined {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("issueTitleSchema", () => {
  it.each([
    ["LF", "Left flipper\nweak", "Left flipper weak"],
    ["CRLF", "Left flipper\r\nweak", "Left flipper weak"],
    ["lone CR", "Left flipper\rweak", "Left flipper weak"],
    ["tab", "Left\tflipper weak", "Left flipper weak"],
    ["blank lines", "Left flipper\n\n\nweak", "Left flipper weak"],
    [
      "NUL and other C0 controls",
      "Left\u0000flipper\u0007weak",
      "Left flipper weak",
    ],
    ["DEL and C1 controls", "Left\u007fflipper\u0085weak", "Left flipper weak"],
    ["mixed run", "Left \t\r\n flipper weak", "Left flipper weak"],
    ["repeated spaces", "Left    flipper  weak", "Left flipper weak"],
    [
      "leading and trailing",
      "\n\t  Left flipper weak  \r\n",
      "Left flipper weak",
    ],
  ])("collapses %s to single spaces", (_label, input, expected) => {
    expect(schema.parse(input)).toBe(expected);
  });

  it("leaves an ordinary title untouched", () => {
    expect(schema.parse("Ball stuck in the VUK")).toBe("Ball stuck in the VUK");
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["only line breaks and controls", "\r\n\t\u0000\n"],
  ])(
    "rejects a title that is %s with the required message",
    (_label, input) => {
      expect(firstMessage(input)).toBe("Title is required");
    }
  );

  it("applies the length limit to the collapsed title", () => {
    // 59 visible characters split by a CRLF and a run of spaces: 64 raw, 60
    // once collapsed, so it fits.
    const raw = `${"a".repeat(30)}\r\n   ${"b".repeat(29)}`;
    expect(raw.length).toBeGreaterThan(ISSUE_TITLE_MAX);
    expect(schema.parse(raw)).toHaveLength(ISSUE_TITLE_MAX);
  });

  it("rejects a title still over the limit after collapsing", () => {
    // An over-limit legacy title is not shortened for the caller; it saves only
    // once edited down (spec issue-detail §4.4).
    expect(firstMessage(`${"a".repeat(30)}\n${"b".repeat(30)}`)).toBe(
      ISSUE_TITLE_MAX_MESSAGE
    );
  });

  it("falls back to Zod's own messages when a surface supplies none", () => {
    const bare = issueTitleSchema();
    expect(bare.parse(" a\nb ")).toBe("a b");
    expect(bare.safeParse("\n").success).toBe(false);
    expect(bare.safeParse("x".repeat(ISSUE_TITLE_MAX + 1)).success).toBe(false);
  });
});
