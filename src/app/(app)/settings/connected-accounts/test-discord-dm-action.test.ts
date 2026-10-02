import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles } from "~/server/db/schema";
import { createTestUser } from "~/test/helpers/factories";

vi.mock("~/lib/discord/config", () => ({
  getDiscordConfig: vi.fn(),
}));
vi.mock("~/lib/discord/client", () => ({
  sendDm: vi.fn(),
}));
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return {
    db: await getTestDb(),
  };
});

import { testDiscordDmAction } from "./test-discord-dm-action";
import { getDiscordConfig } from "~/lib/discord/config";
import { sendDm } from "~/lib/discord/client";
import { createClient } from "~/lib/supabase/server";

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

describe("testDiscordDmAction", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reason='not_authenticated' when no user", async () => {
    mockUser(null);
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_authenticated",
    });
    expect(sendDm).not.toHaveBeenCalled();
  });

  it("returns reason='not_linked' when the user has no discord_user_id", async () => {
    const db = await getTestDb();
    const userId = crypto.randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: userId, discordUserId: null }));

    mockUser(userId);
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_linked",
    });
    expect(sendDm).not.toHaveBeenCalled();
  });

  it("returns reason='not_configured' when integration is disabled", async () => {
    const db = await getTestDb();
    const userId = crypto.randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: userId, discordUserId: "d1" }));

    mockUser(userId);
    vi.mocked(getDiscordConfig).mockResolvedValue(null);
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("returns ok=true on successful DM", async () => {
    const db = await getTestDb();
    const userId = crypto.randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: userId, discordUserId: "d1" }));

    mockUser(userId);
    vi.mocked(getDiscordConfig).mockResolvedValue({
      botToken: "t",
      guildId: "g",
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
    const db = await getTestDb();
    const userId = crypto.randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: userId, discordUserId: "d1" }));

    mockUser(userId);
    vi.mocked(getDiscordConfig).mockResolvedValue({
      botToken: "t",
      guildId: "g",
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

  it("propagates no_shared_server and includes inviteUrl from sendDm", async () => {
    const db = await getTestDb();
    const userId = crypto.randomUUID();
    await db
      .insert(userProfiles)
      .values(createTestUser({ id: userId, discordUserId: "d1" }));

    mockUser(userId);
    vi.mocked(getDiscordConfig).mockResolvedValue({
      botToken: "t",
      guildId: "g",
      inviteLink: "https://discord.gg/invite",
      botHealthStatus: "healthy",
      lastBotCheckAt: null,
      updatedAt: new Date(),
    });
    vi.mocked(sendDm).mockResolvedValue({
      ok: false,
      reason: "no_shared_server",
    });
    expect(await testDiscordDmAction()).toEqual({
      ok: false,
      reason: "no_shared_server",
      inviteUrl: "https://discord.gg/invite",
    });
  });

  it.each([["rate_limited"], ["transient"]] as const)(
    "propagates %s from sendDm",
    async (reason) => {
      const db = await getTestDb();
      const userId = crypto.randomUUID();
      await db
        .insert(userProfiles)
        .values(createTestUser({ id: userId, discordUserId: "d1" }));

      mockUser(userId);
      vi.mocked(getDiscordConfig).mockResolvedValue({
        botToken: "t",
        guildId: "g",
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
