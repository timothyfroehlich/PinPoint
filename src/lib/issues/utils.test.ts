import { describe, it, expect } from "vitest";
import { parseIssueNumber, resolveIssueReporter } from "./utils";

describe("parseIssueNumber", () => {
  it("parses a plain positive integer", () => {
    expect(parseIssueNumber("1")).toBe(1);
    expect(parseIssueNumber("42")).toBe(42);
  });

  it("accepts leading zeros, matching the prior parseInt behavior", () => {
    expect(parseIssueNumber("01")).toBe(1);
  });

  it("rejects trailing garbage instead of silently parsing a prefix", () => {
    // parseInt("1abc", 10) === 1 — the bug PP-xlod fixes.
    expect(parseIssueNumber("1abc")).toBeNull();
  });

  it("rejects decimals", () => {
    // parseInt("1.5", 10) === 1.
    expect(parseIssueNumber("1.5")).toBeNull();
  });

  it("rejects zero and negatives", () => {
    expect(parseIssueNumber("0")).toBeNull();
    expect(parseIssueNumber("-1")).toBeNull();
  });

  it("rejects empty, whitespace, and non-numeric segments", () => {
    expect(parseIssueNumber("")).toBeNull();
    expect(parseIssueNumber(" 1")).toBeNull();
    expect(parseIssueNumber("1 ")).toBeNull();
    expect(parseIssueNumber("abc")).toBeNull();
  });

  it("rejects numbers beyond the safe-integer range", () => {
    expect(parseIssueNumber("99999999999999999999")).toBeNull();
  });
});

describe("resolveIssueReporter", () => {
  it("resolves reportedByUser", () => {
    const issue = {
      reportedByUser: { id: "user-1", name: "User" },
    };
    expect(resolveIssueReporter(issue)).toEqual({
      id: "user-1",
      name: "User",
      initial: "U",
    });
  });

  it("resolves invitedReporter if no reportedByUser", () => {
    const issue = {
      invitedReporter: {
        id: "invited-1",
        name: "Invited",
      },
    };
    expect(resolveIssueReporter(issue)).toEqual({
      id: "invited-1",
      name: "Invited",
      initial: "I",
    });
  });

  it("resolves reporterName if no user/invited", () => {
    const issue = {
      reporterName: "Legacy",
    };
    expect(resolveIssueReporter(issue)).toEqual({
      id: null,
      name: "Legacy",
      initial: "L",
    });
  });

  it("falls back to Anonymous", () => {
    const issue = {};
    expect(resolveIssueReporter(issue)).toEqual({
      id: null,
      name: "Anonymous",
      initial: "A",
    });
  });
});
