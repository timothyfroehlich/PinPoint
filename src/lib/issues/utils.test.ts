import { describe, it, expect } from "vitest";
import { resolveIssueReporter } from "./utils";

describe("resolveIssueReporter", () => {
  it("resolves reportedByUser", () => {
    const issue = {
      reportedByUser: { id: "user-1", name: "User", email: "user@example.com" },
    };
    expect(resolveIssueReporter(issue)).toEqual({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      initial: "U",
    });
  });

  it("resolves invitedReporter if no reportedByUser", () => {
    const issue = {
      invitedReporter: { id: "invited-1", name: "Invited", email: "invited@example.com" },
    };
    expect(resolveIssueReporter(issue)).toEqual({
      id: "invited-1",
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
      id: null,
      name: "Legacy",
      email: "legacy@example.com",
      initial: "L",
    });
  });

  it("falls back to Anonymous", () => {
    const issue = {};
    expect(resolveIssueReporter(issue)).toEqual({
      id: null,
      name: "Anonymous",
      email: null,
      initial: "A",
    });
  });
});
