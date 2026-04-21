import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type * as ProvidersModule from "./providers";

async function loadModule(): Promise<typeof ProvidersModule> {
  vi.resetModules();
  return import("./providers");
}

describe("provider registry", () => {
  beforeEach(() => {
    vi.stubEnv("DISCORD_CLIENT_ID", "");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("isAvailable() is false when both env vars are missing", async () => {
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(false);
  });

  it("isAvailable() is false when only DISCORD_CLIENT_ID is set", async () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "abc");
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(false);
  });

  it("isAvailable() is false when only DISCORD_CLIENT_SECRET is set", async () => {
    vi.stubEnv("DISCORD_CLIENT_SECRET", "def");
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(false);
  });

  it("isAvailable() is true when both env vars are set", async () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "abc");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "def");
    const mod = await loadModule();
    expect(mod.providers.discord.isAvailable()).toBe(true);
  });

  it("getAvailableProviders() omits providers whose isAvailable() is false", async () => {
    const mod = await loadModule();
    expect(mod.getAvailableProviders()).toEqual([]);
  });

  it("getAvailableProviders() includes discord when both env vars are set", async () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "abc");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "def");
    const mod = await loadModule();
    const keys = mod.getAvailableProviders().map((p) => p.key);
    expect(keys).toEqual(["discord"]);
  });
});
