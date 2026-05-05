import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/discord/config", () => ({
  getDiscordConfig: vi.fn(),
}));
vi.mock("~/lib/discord/client", () => ({
  sendDm: vi.fn(),
}));
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("~/server/db", () => ({
  db: { query: { userProfiles: { findFirst: vi.fn() } } },
}));

import { testDiscordDmAction } from "./test-discord-dm-action";
import { getDiscordConfig } from "~/lib/discord/config";
import { sendDm } from "~/lib/discord/client";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";

const findFirst = db.query.userProfiles.findFirst as ReturnType<typeof vi.fn>;

function mockUser(id: string | null): void {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: id ? { id } : null },
        error: null,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockReset();
});

describe("testDiscordDmAction", () => {
  it("returns reason='not_authenticated' when no user", async () => {
    mockUser(null);
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_authenticated",
    });
    expect(sendDm).not.toHaveBeenCalled();
  });

  it("returns reason='not_linked' when the user has no discord_user_id", async () => {
    mockUser("u1");
    findFirst.mockResolvedValue({ id: "u1", discordUserId: null });
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_linked",
    });
    expect(sendDm).not.toHaveBeenCalled();
  });

  it("returns reason='not_configured' when integration is disabled", async () => {
    mockUser("u1");
    findFirst.mockResolvedValue({ id: "u1", discordUserId: "d1" });
    vi.mocked(getDiscordConfig).mockResolvedValue(null);
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("returns ok=true on successful DM", async () => {
    mockUser("u1");
    findFirst.mockResolvedValue({ id: "u1", discordUserId: "d1" });
    vi.mocked(getDiscordConfig).mockResolvedValue({
      enabled: true,
      botToken: "t",
      guildId: null,
      inviteLink: null,
      botHealthStatus: "healthy",
      lastBotCheckAt: null,
      updatedAt: new Date(),
    });
    vi.mocked(sendDm).mockResolvedValue({ ok: true });
    expect(await testDiscordDmAction()).toEqual({ ok: true });
    expect(sendDm).toHaveBeenCalledWith({
      botToken: "t",
      discordUserId: "d1",
      content: expect.stringContaining("Test DM"),
    });
  });

  it("propagates blocked from sendDm", async () => {
    mockUser("u1");
    findFirst.mockResolvedValue({ id: "u1", discordUserId: "d1" });
    vi.mocked(getDiscordConfig).mockResolvedValue({
      enabled: true,
      botToken: "t",
      guildId: null,
      inviteLink: null,
      botHealthStatus: "healthy",
      lastBotCheckAt: null,
      updatedAt: new Date(),
    });
    vi.mocked(sendDm).mockResolvedValue({
      ok: false,
      reason: "blocked",
    });
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it.each([["rate_limited"], ["transient"]] as const)(
    "propagates %s from sendDm",
    async (reason) => {
      mockUser("u1");
      findFirst.mockResolvedValue({ id: "u1", discordUserId: "d1" });
      vi.mocked(getDiscordConfig).mockResolvedValue({
        enabled: true,
        botToken: "t",
        guildId: null,
        inviteLink: null,
        botHealthStatus: "healthy",
        lastBotCheckAt: null,
        updatedAt: new Date(),
      });
      vi.mocked(sendDm).mockResolvedValue({ ok: false, reason });
      expect(await testDiscordDmAction()).toEqual({ ok: false, reason });
    }
  );
});
