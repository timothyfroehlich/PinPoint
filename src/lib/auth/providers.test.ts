import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type * as ProvidersModule from "./providers";

// Import lazily in each test so env mutations take effect
async function loadModule(): Promise<typeof ProvidersModule> {
  vi.resetModules();
  return import("./providers");
}

describe("provider registry", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("exposes a discord provider with the expected shape", async () => {
    const mod = await loadModule();
    const discord = mod.providers.discord;

    expect(discord.key).toBe("discord");
    expect(discord.displayName).toBe("Discord");
    expect(discord.scopes).toBe("identify email");
    expect(typeof discord.iconComponent).toBe("function");
    expect(typeof discord.isAvailable).toBe("function");
  });

  it("discord.isAvailable() is false without DISCORD_CLIENT_ID", async () => {
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(false);
  });

  it("discord.isAvailable() is true when DISCORD_CLIENT_ID is set", async () => {
    process.env.DISCORD_CLIENT_ID = "abc";
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(true);
  });

  it("getAvailableProviders() omits providers whose isAvailable() is false", async () => {
    const mod = await loadModule();
    expect(mod.getAvailableProviders()).toEqual([]);
  });

  it("getAvailableProviders() includes discord when DISCORD_CLIENT_ID is set", async () => {
    process.env.DISCORD_CLIENT_ID = "abc";
    const mod = await loadModule();
    const keys = mod.getAvailableProviders().map((p) => p.key);
    expect(keys).toEqual(["discord"]);
  });
});
