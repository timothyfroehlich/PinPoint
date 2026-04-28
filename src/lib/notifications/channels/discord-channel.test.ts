import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/discord/client", () => ({
  sendDm: vi.fn(),
}));
vi.mock("~/lib/url", () => ({ getSiteUrl: () => "https://app.example.com" }));
vi.mock("~/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import { createDiscordChannel } from "./discord-channel";
import type { DiscordConfig } from "~/lib/discord/config";
import type { NotificationPreferencesRow, ChannelContext } from "./types";
import { sendDm } from "~/lib/discord/client";

const MOCK_CONFIG: DiscordConfig = {
  enabled: true,
  botToken: "tok",
  guildId: "g",
  inviteLink: null,
  botHealthStatus: "healthy",
  lastBotCheckAt: null,
  updatedAt: new Date(),
};
const channel = createDiscordChannel(MOCK_CONFIG);

function prefs(
  overrides: Partial<NotificationPreferencesRow> = {}
): NotificationPreferencesRow {
  return {
    userId: "u1",
    emailEnabled: true,
    inAppEnabled: true,
    suppressOwnActions: false,
    emailNotifyOnAssigned: true,
    inAppNotifyOnAssigned: true,
    emailNotifyOnStatusChange: false,
    inAppNotifyOnStatusChange: false,
    emailNotifyOnNewComment: false,
    inAppNotifyOnNewComment: false,
    emailNotifyOnMentioned: true,
    inAppNotifyOnMentioned: true,
    emailNotifyOnNewIssue: true,
    inAppNotifyOnNewIssue: false,
    emailWatchNewIssuesGlobal: false,
    inAppWatchNewIssuesGlobal: false,
    discordEnabled: true,
    discordNotifyOnAssigned: true,
    discordNotifyOnStatusChange: false,
    discordNotifyOnNewComment: false,
    discordNotifyOnMentioned: true,
    discordNotifyOnNewIssue: false,
    discordWatchNewIssuesGlobal: false,
    discordDmBlockedAt: null,
    ...overrides,
  };
}

function ctx(overrides: Partial<ChannelContext> = {}): ChannelContext {
  return {
    userId: "u1",
    type: "issue_assigned",
    resourceId: "issue-1",
    resourceType: "issue",
    email: "u@example.com",
    discordUserId: "discord-1",
    issueTitle: "Bumper broken",
    machineName: "AFM",
    formattedIssueId: "AFM-01",
    commentContent: undefined,
    newStatus: undefined,
    issueDescription: undefined,
    tx: undefined as unknown as ChannelContext["tx"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("discordChannel.shouldDeliver", () => {
  it("returns false when main switch off", () => {
    expect(
      channel.shouldDeliver(prefs({ discordEnabled: false }), "issue_assigned")
    ).toBe(false);
  });

  it("respects per-event toggle", () => {
    expect(
      channel.shouldDeliver(
        prefs({ discordNotifyOnAssigned: false }),
        "issue_assigned"
      )
    ).toBe(false);
  });

  it("always delivers machine_ownership_changed (critical event, no per-event opt-out)", () => {
    // The per-event opt-out column was dropped in migration 0033; channels
    // hardcode this event as always-on (only the main discordEnabled switch
    // can opt out). The default-prefs fixture already has every other
    // toggle off — this test asserts the hardcode wins.
    expect(
      channel.shouldDeliver(
        prefs({ discordEnabled: true }),
        "machine_ownership_changed"
      )
    ).toBe(true);
  });

  it("returns false when discordDmBlockedAt is set", () => {
    expect(
      channel.shouldDeliver(
        prefs({ discordDmBlockedAt: new Date() }),
        "issue_assigned"
      )
    ).toBe(false);
  });

  it("falls back to global watch flag for new_issue", () => {
    expect(
      channel.shouldDeliver(
        prefs({
          discordNotifyOnNewIssue: false,
          discordWatchNewIssuesGlobal: true,
        }),
        "new_issue"
      )
    ).toBe(true);
  });
});

describe("discordChannel.deliver", () => {
  it("returns skipped when user has no discord_user_id", async () => {
    const result = await channel.deliver(ctx({ discordUserId: null }));
    expect(result).toEqual({ ok: false, reason: "skipped" });
    expect(sendDm).not.toHaveBeenCalled();
  });

  it("calls sendDm with formatted body and returns ok on success", async () => {
    vi.mocked(sendDm).mockResolvedValueOnce({ ok: true });
    const result = await channel.deliver(ctx());
    expect(result).toEqual({ ok: true });
    expect(sendDm).toHaveBeenCalledWith({
      botToken: "tok",
      discordUserId: "discord-1",
      content: expect.stringContaining("AFM-01") as unknown as string,
    });
  });

  it("maps blocked → permanent failure", async () => {
    vi.mocked(sendDm).mockResolvedValueOnce({
      ok: false,
      reason: "blocked",
    });
    const result = await channel.deliver(ctx());
    expect(result).toEqual({ ok: false, reason: "permanent" });
  });

  it("maps transient → transient", async () => {
    vi.mocked(sendDm).mockResolvedValueOnce({
      ok: false,
      reason: "transient",
    });
    const result = await channel.deliver(ctx());
    expect(result).toEqual({ ok: false, reason: "transient" });
  });

  it("maps not_configured (race) → skipped", async () => {
    vi.mocked(sendDm).mockResolvedValueOnce({
      ok: false,
      reason: "not_configured",
    });
    const result = await channel.deliver(ctx());
    expect(result).toEqual({ ok: false, reason: "skipped" });
  });
});
