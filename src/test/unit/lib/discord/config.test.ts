import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createAdminClient so we don't hit a real Supabase instance.
// vi.mock() is hoisted above all imports, so a file-scope `const rpcMock`
// would be undefined when the factory runs. vi.hoisted() places the mock
// fn initializer in the same hoist bucket as vi.mock(), guaranteeing
// rpcMock exists when the factory closure captures it.
const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock("~/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

import { getDiscordConfig } from "~/lib/discord/config";

describe("getDiscordConfig", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns null when RPC yields no rows", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await expect(getDiscordConfig()).resolves.toBeNull();
  });

  it("returns null when enabled is false", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          enabled: false,
          guild_id: null,
          invite_link: null,
          bot_token: null,
          bot_health_status: "unknown",
          last_bot_check_at: null,
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      error: null,
    });
    await expect(getDiscordConfig()).resolves.toBeNull();
  });

  it("returns null when enabled but bot_token is missing", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          enabled: true,
          guild_id: "123",
          invite_link: null,
          bot_token: null,
          bot_health_status: "unknown",
          last_bot_check_at: null,
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      error: null,
    });
    await expect(getDiscordConfig()).resolves.toBeNull();
  });

  it("returns a typed DiscordConfig when enabled and token set", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          enabled: true,
          guild_id: "123",
          invite_link: "https://discord.gg/abc",
          bot_token: "secret-token",
          bot_health_status: "healthy",
          last_bot_check_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      ],
      error: null,
    });
    const config = await getDiscordConfig();
    expect(config).not.toBeNull();
    expect(config?.enabled).toBe(true);
    expect(config?.guildId).toBe("123");
    expect(config?.botToken).toBe("secret-token");
  });

  it("throws when the RPC returns an error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc failed" },
    });
    await expect(getDiscordConfig()).rejects.toThrow(/rpc failed/);
  });
});
