import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";

import type * as OAuthActionsModule from "./oauth-actions";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

async function loadActions(): Promise<typeof OAuthActionsModule> {
  vi.resetModules();
  return import("./oauth-actions");
}

function identity(provider: string): UserIdentity {
  return {
    identity_id: `id-${provider}`,
    id: `row-${provider}`,
    user_id: "u1",
    identity_data: {},
    provider,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as UserIdentity;
}

describe("signInWithProviderAction", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
  });

  it("refuses when provider is not available", async () => {
    delete process.env.DISCORD_CLIENT_ID;
    const { signInWithProviderAction } = await loadActions();
    const result = await signInWithProviderAction("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("calls supabase.auth.signInWithOAuth and redirects to provider URL", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://discord.com/oauth2/authorize?..." },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { signInWithOAuth },
    });

    const { signInWithProviderAction } = await loadActions();
    await expect(signInWithProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:https:\/\/discord\.com/
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "discord",
      options: expect.objectContaining({ scopes: "identify email" }),
    });
  });
});

describe("unlinkProviderAction", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
  });

  it("refuses when unlink would leave user with zero identities", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const getUserIdentities = vi.fn().mockResolvedValue({
      data: { identities: [identity("discord")] },
      error: null,
    });
    const unlinkIdentity = vi.fn();
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, getUserIdentities, unlinkIdentity },
    });

    const { unlinkProviderAction } = await loadActions();
    const result = await unlinkProviderAction("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ONLY_IDENTITY");
    expect(unlinkIdentity).not.toHaveBeenCalled();
  });

  it("unlinks when user has >=2 identities", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const discordIdentity = identity("discord");
    const getUserIdentities = vi.fn().mockResolvedValue({
      data: { identities: [identity("email"), discordIdentity] },
      error: null,
    });
    const unlinkIdentity = vi.fn().mockResolvedValue({ error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, getUserIdentities, unlinkIdentity },
    });

    const { unlinkProviderAction } = await loadActions();
    const result = await unlinkProviderAction("discord");
    expect(result.ok).toBe(true);
    expect(unlinkIdentity).toHaveBeenCalledWith(discordIdentity);
  });

  it("refuses when user is not logged in", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser },
    });

    const { unlinkProviderAction } = await loadActions();
    const result = await unlinkProviderAction("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_AUTHENTICATED");
  });
});

describe("linkProviderAction", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
  });

  it("calls linkIdentity and redirects to provider URL", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const linkIdentity = vi.fn().mockResolvedValue({
      data: { url: "https://discord.com/oauth2/authorize?link=1" },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, linkIdentity },
    });

    const { linkProviderAction } = await loadActions();
    await expect(linkProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:https:\/\/discord\.com/
    );
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: "discord",
      options: expect.objectContaining({ scopes: "identify email" }),
    });
  });
});
