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

  it("breaks @everyone / @here so they don't ping", () => {
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "@everyone please look at this @here",
      formattedIssueId: "X-1",
      resourceType: "issue",
      resourceId: "i1",
      machineName: undefined,
      newStatus: undefined,
      commentContent: undefined,
    });

    expect(out).not.toMatch(/(^|\s)@everyone(\s|$)/);
    expect(out).not.toMatch(/(^|\s)@here(\s|$)/);
    // Each `@` is followed by a U+200B zero-width space.
    expect(out).toMatch(/@\u200Beveryone/);
    expect(out).toMatch(/@\u200Bhere/);
  });

  it("breaks angle-bracket mention forms (<@USER_ID>, <#CHANNEL_ID>, <@&ROLE_ID>)", () => {
    // allowed_mentions: { parse: [] } in client.ts blocks the actual ping,
    // but Discord still RENDERS the mention as "@username" / "#channel" in
    // the recipient's DM, which would let a malicious title impersonate
    // a system mention. Sanitize must break the syntax visually too.
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "Hi <@123456> see <#7890> via <@&5555> role",
      formattedIssueId: "X-1",
      resourceType: "issue",
      resourceId: "i1",
      machineName: undefined,
      newStatus: undefined,
      commentContent: undefined,
    });

    // None of the raw mention forms render — every `<` gets a ZWSP after it.
    expect(out).not.toMatch(/<@\d/);
    expect(out).not.toMatch(/<#\d/);
    expect(out).not.toMatch(/<@&\d/);
    expect(out).toMatch(/<\u200B@\u200B123456/);
    expect(out).toMatch(/<\u200B#7890/);
    expect(out).toMatch(/<\u200B@\u200B&5555/);
  });

  it("escapes Markdown control characters in user-supplied content", () => {
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "**bold** _italic_ `code` ~strike~ |spoiler| > quote \\back",
      formattedIssueId: "X-1",
      resourceType: "issue",
      resourceId: "i1",
      machineName: undefined,
      newStatus: undefined,
      commentContent: undefined,
    });

    // None of the raw Markdown markers should appear unescaped in the body.
    for (const marker of [
      "**",
      "_italic_",
      "`code`",
      "~strike~",
      "|spoiler|",
    ]) {
      expect(out).not.toContain(marker);
    }
    // Backslash-escaped versions should be present.
    expect(out).toContain("\\*\\*bold\\*\\*");
    expect(out).toContain("\\_italic\\_");
  });

  it("does not escape characters in the link or footer", () => {
    const out = formatDiscordMessage({
      type: "new_issue",
      siteUrl: "https://app.example.com",
      issueTitle: "ok",
      formattedIssueId: "X-1",
      resourceType: "issue",
      resourceId: "i1",
      machineName: "Whitewater",
      newStatus: undefined,
      commentContent: undefined,
    });

    expect(out).toContain("https://app.example.com/issues/i1");
    expect(out).toContain(
      "Manage notifications: https://app.example.com/settings/notifications"
    );
  });

  it("truncates the body to keep total length ≤ 2000 chars", () => {
    const out = formatDiscordMessage({
      type: "new_comment",
      siteUrl: "https://app.example.com",
      issueTitle: "x".repeat(5000),
      formattedIssueId: "X-1",
      resourceType: "issue",
      resourceId: "i1",
      machineName: undefined,
      newStatus: undefined,
      commentContent: undefined,
    });

    expect(out.length).toBeLessThanOrEqual(2000);
    // Link and footer both preserved.
    expect(out).toContain("https://app.example.com/issues/i1");
    expect(out).toContain("/settings/notifications");
    // Body was truncated — should end the body section with an ellipsis
    // before the link starts.
    expect(out).toMatch(/…\nhttps:\/\/app\.example\.com\/issues\/i1/);
  });
});
