import { describe, it, expect } from "vitest";
import { resolveIssueReporter } from "./utils";

describe("resolveIssueReporter", () => {
  it("resolves reportedByUser", () => {
    const issue = {
      reportedByUser: { name: "User", email: "user@example.com" },
    };
    expect(resolveIssueReporter(issue)).toEqual({
      name: "User",
      email: "user@example.com",
      initial: "U",
    });
  });

  it("resolves invitedReporter if no reportedByUser", () => {
    const issue = {
      invitedReporter: { name: "Invited", email: "invited@example.com" },
    };
    expect(resolveIssueReporter(issue)).toEqual({
      name: "Invited",
      email: "invited@example.com",
      initial: "I",
    });
  });

  it("resolves reporterName/Email if no user/invited", () => {
    const issue = {
      reporterName: "Legacy",
      reporterEmail: "legacy@example.com",
    };
    expect(resolveIssueReporter(issue)).toEqual({
      name: "Legacy",
      email: "legacy@example.com",
      initial: "L",
    });
  });

  it("falls back to Anonymous", () => {
    const issue = {};
    expect(resolveIssueReporter(issue)).toEqual({
      name: "Anonymous",
      email: null,
      initial: "A",
    });
  });
});
