import { describe, it, expect } from "vitest";
import { resolveIssueReporter } from "./utils";

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
