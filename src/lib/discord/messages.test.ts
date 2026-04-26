import { describe, it, expect } from "vitest";
import { formatDiscordMessage } from "./messages";

describe("formatDiscordMessage", () => {
  it("renders an issue_assigned DM with title, formatted id, and footer link", () => {
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "Pop bumper not working",
      formattedIssueId: "AFM-07",
      resourceType: "issue",
      resourceId: "issue-uuid-1",
      machineName: "Attack From Mars",
      newStatus: undefined,
      commentContent: undefined,
    });

    expect(out).toContain("AFM-07");
    expect(out).toContain("Pop bumper not working");
    expect(out).toContain("assigned");
    expect(out).toContain("https://app.example.com/issues/issue-uuid-1");
    expect(out).toMatch(/Manage notifications.*\/settings\/notifications/i);
  });

  it("renders a machine_ownership_changed DM scoped to the machine", () => {
    const out = formatDiscordMessage({
      type: "machine_ownership_changed",
      siteUrl: "https://app.example.com",
      issueTitle: undefined,
      formattedIssueId: undefined,
      resourceType: "machine",
      resourceId: "machine-uuid-1",
      machineName: "Medieval Madness",
      newStatus: undefined,
      commentContent: undefined,
    });

    expect(out).toContain("Medieval Madness");
    expect(out).toContain("https://app.example.com/machines/machine-uuid-1");
  });

  it("includes new status when issue_status_changed", () => {
    const out = formatDiscordMessage({
      type: "issue_status_changed",
      siteUrl: "https://app.example.com",
      issueTitle: "Flippers weak",
      formattedIssueId: "TWD-03",
      resourceType: "issue",
      resourceId: "issue-2",
      machineName: "Walking Dead",
      newStatus: "Resolved",
      commentContent: undefined,
    });

    expect(out).toContain("TWD-03");
    expect(out).toContain("Resolved");
  });
});
