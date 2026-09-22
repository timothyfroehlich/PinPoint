import { describe, it, expect } from "vitest";
import {
  formatDiscordImprovementNotice,
  formatDiscordMessage,
  formatDiscordWelcomeMessage,
} from "./messages";

describe("formatDiscordMessage", () => {
  it("renders the compact issue-first assignment DM", () => {
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "Pop bumper not working",
      formattedIssueId: "AFM-07",
      resourceType: "issue",
      machineName: "Attack From Mars",
      actorName: "Paul",
      recipientReason: "assignee",
      severity: "unplayable",
    });

    expect(out).toContain("AFM-07");
    expect(out).toContain("Pop bumper not working");
    expect(out).toContain("assigned");
    expect(out).toContain("https://app.example.com/m/AFM/i/7");
    expect(out).toBe(
      "**[AFM-07](https://app.example.com/m/AFM/i/7) assigned to you**\nPop bumper not working · Attack From Mars · Unplayable\nAssigned by Paul"
    );
  });

  it("renders a machine_ownership_changed DM scoped to the machine", () => {
    const out = formatDiscordMessage({
      type: "machine_ownership_changed",
      siteUrl: "https://app.example.com",
      resourceType: "machine",
      machineName: "Medieval Madness",
      machineInitials: "MM",
      ownershipChange: "added",
    });

    expect(out).toContain("Medieval Madness");
    expect(out).toContain("https://app.example.com/m/MM");
  });

  it("falls back to the machine list when initials are missing", () => {
    const out = formatDiscordMessage({
      type: "machine_ownership_changed",
      siteUrl: "https://app.example.com",
      resourceType: "machine",
      machineName: "Medieval Madness",
      machineInitials: undefined,
      ownershipChange: "removed",
    });

    expect(out).toContain("[Medieval Madness](https://app.example.com/m)");
  });

  it("preserves the machine link when a long ownership label is truncated", () => {
    const out = formatDiscordMessage({
      type: "machine_ownership_changed",
      siteUrl: "https://app.example.com",
      resourceType: "machine",
      machineName: "x".repeat(5000),
      machineInitials: "MM",
      ownershipChange: "removed",
    });

    expect(out).toHaveLength(2000);
    expect(out).toContain("…](https://app.example.com/m/MM)**");
    expect(out).toContain("You won’t receive owner notifications");
  });

  it("falls back to the issue list when the formatted id is unparseable", () => {
    const out = formatDiscordMessage({
      type: "new_comment",
      siteUrl: "https://app.example.com",
      issueTitle: "Broken flipper",
      // Single-character initials violate the 2-6 char DB constraint.
      formattedIssueId: "X-1",
      resourceType: "issue",
      machineName: undefined,
      actorName: "Paul",
      recipientReason: "issue_watcher",
      commentContent: undefined,
      commentId: "comment-1",
      attachmentCount: 0,
    });

    expect(out).toContain("https://app.example.com/issues#comment-comment-1");
  });

  it("includes new status when issue_status_changed", () => {
    const out = formatDiscordMessage({
      type: "issue_status_changed",
      siteUrl: "https://app.example.com",
      issueTitle: "Flippers weak",
      formattedIssueId: "TWD-03",
      resourceType: "issue",
      machineName: "Walking Dead",
      actorName: "Paul",
      recipientReason: "issue_watcher",
      oldStatus: "confirmed",
      newStatus: "in_progress",
    });

    expect(out).toBe(
      "**[TWD-03](https://app.example.com/m/TWD/i/3) moved to In Progress**\nFlippers weak · Walking Dead · previously Confirmed\nChanged by Paul · You’re watching this issue"
    );
  });

  it("uses Anonymous when an actor name is unavailable", () => {
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "Flippers weak",
      formattedIssueId: "TWD-03",
      resourceType: "issue",
      machineName: "Walking Dead",
      actorName: undefined,
      recipientReason: "assignee",
      severity: "minor",
    });

    expect(out).toContain("Assigned by Anonymous");
  });

  it("breaks @everyone / @here so they don't ping", () => {
    const out = formatDiscordMessage({
      type: "issue_assigned",
      siteUrl: "https://app.example.com",
      issueTitle: "@everyone please look at this @here",
      formattedIssueId: "X-1",
      resourceType: "issue",
      machineName: undefined,
      actorName: "Paul",
      recipientReason: "assignee",
      severity: undefined,
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
      machineName: undefined,
      actorName: "Paul",
      recipientReason: "assignee",
      severity: undefined,
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
      machineName: undefined,
      actorName: "Paul",
      recipientReason: "assignee",
      severity: undefined,
    });

    // None of the raw Markdown markers should appear unescaped in the body.
    for (const marker of ["_italic_", "`code`", "~strike~", "|spoiler|"]) {
      expect(out).not.toContain(marker);
    }
    // Backslash-escaped versions should be present.
    expect(out).toContain("\\*\\*bold\\*\\*");
    expect(out).toContain("\\_italic\\_");
  });

  it("uses the issue id as the only routine link", () => {
    const out = formatDiscordMessage({
      type: "new_issue",
      siteUrl: "https://app.example.com",
      issueTitle: "ok",
      formattedIssueId: "WW-01",
      resourceType: "issue",
      machineName: "Whitewater",
      actorName: "Paul",
      recipientReason: "machine_owner",
      severity: "minor",
      frequency: "intermittent",
    });

    expect(out).toContain("https://app.example.com/m/WW/i/1");
    expect(out).not.toContain("settings/notifications");
    expect(out).toBe(
      "**[WW-01](https://app.example.com/m/WW/i/1) — ok**\nWhitewater · Minor · Intermittent\nReported by Paul · You own this machine"
    );
  });

  it("truncates the body to keep total length ≤ 2000 chars", () => {
    const out = formatDiscordMessage({
      type: "new_comment",
      siteUrl: "https://app.example.com",
      issueTitle: "Long investigation",
      formattedIssueId: "XX-12",
      resourceType: "issue",
      machineName: undefined,
      actorName: "Paul",
      recipientReason: "issue_watcher",
      commentContent: "x".repeat(5000),
      commentId: "comment-12",
      attachmentCount: 0,
    });

    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out).toContain(
      "https://app.example.com/m/XX/i/12#comment-comment-12"
    );
    expect(out).toContain("…");
  });

  it("clamps non-comment messages to Discord's 2000-character limit", () => {
    const out = formatDiscordMessage({
      type: "new_issue",
      siteUrl: "https://app.example.com",
      issueTitle: "x".repeat(5000),
      formattedIssueId: "XX-13",
      resourceType: "issue",
      machineName: "A very long machine name",
      actorName: "Paul",
      recipientReason: "machine_owner",
      severity: "minor",
      frequency: "intermittent",
    });

    expect(out).toHaveLength(2000);
    expect(out).toContain("https://app.example.com/m/XX/i/13");
    expect(out.endsWith("…")).toBe(true);
  });

  it("includes comment text and targets the specific comment", () => {
    const out = formatDiscordMessage({
      type: "new_comment",
      siteUrl: "https://app.example.com",
      issueTitle: "Ball stuck in trough",
      formattedIssueId: "AFM-07",
      resourceType: "issue",
      machineName: "Attack From Mars",
      actorName: "Paul",
      recipientReason: "issue_watcher",
      commentContent: "Reseated the connector.\nPlease test again.",
      commentId: "123",
      attachmentCount: 0,
    });

    expect(out).toContain(
      "**[AFM-07](https://app.example.com/m/AFM/i/7#comment-123) — Paul commented**"
    );
    expect(out).toContain(
      "Ball stuck in trough · Attack From Mars\nYou’re watching this issue"
    );
    expect(out).toContain("> Reseated the connector.\n> Please test again.");
  });

  it("describes an attachment-only mention", () => {
    const out = formatDiscordMessage({
      type: "mentioned",
      siteUrl: "https://app.example.com",
      issueTitle: "Ball stuck in trough",
      formattedIssueId: "AFM-07",
      resourceType: "issue",
      machineName: "Attack From Mars",
      actorName: "Paul",
      recipientReason: "mentioned",
      commentContent: "",
      commentId: "124",
      attachmentCount: 2,
    });

    expect(out).toContain(
      "**[AFM-07](https://app.example.com/m/AFM/i/7#comment-124) — Paul mentioned you**"
    );
    expect(out).toContain("Added 2 photos — open the issue to view.");
  });

  it("formats onboarding and rollout settings links", () => {
    expect(formatDiscordWelcomeMessage("https://app.example.com")).toContain(
      "[Review notification settings](https://app.example.com/settings/notifications)"
    );
    expect(formatDiscordImprovementNotice("https://app.example.com")).toContain(
      "[Review or disable Discord notifications](https://app.example.com/settings/notifications)"
    );
  });
});
