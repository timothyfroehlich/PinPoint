import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";

import type * as OAuthCoreModule from "./oauth-actions-core";
import type * as OAuthActionsModule from "./oauth-actions";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("~/server/db", () => {
  // Drizzle's `db.update(table).set(...).where(...)` chains thenably.
  // We don't care about the SQL, only that the call resolves.
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { db: { update } };
});

async function loadCore(): Promise<typeof OAuthCoreModule> {
  vi.resetModules();
  return import("./oauth-actions-core");
}

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

describe("runSignInWithProvider (core)", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
    process.env.DISCORD_CLIENT_SECRET = "def";
  });

  it("refuses when provider is not available", async () => {
    delete process.env.DISCORD_CLIENT_ID;
    const { runSignInWithProvider } = await loadCore();
    const result = await runSignInWithProvider("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("returns redirect URL from supabase.auth.signInWithOAuth", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi
      .fn()
      .mockResolvedValue({ data: { user: null }, error: null });
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://discord.com/oauth2/authorize?..." },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, signInWithOAuth },
    });

    const { runSignInWithProvider } = await loadCore();
    const result = await runSignInWithProvider("discord");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.redirectUrl).toMatch(/discord\.com/);
    }
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "discord",
      options: expect.objectContaining({ scopes: "identify email" }),
    });
  });
});

describe("runUnlinkProvider (core)", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
    process.env.DISCORD_CLIENT_SECRET = "def";
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

    const { runUnlinkProvider } = await loadCore();
    const result = await runUnlinkProvider("discord");
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

    const { runUnlinkProvider } = await loadCore();
    const result = await runUnlinkProvider("discord");
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

    const { runUnlinkProvider } = await loadCore();
    const result = await runUnlinkProvider("discord");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_AUTHENTICATED");
  });
});

describe("runLinkProvider (core)", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
    process.env.DISCORD_CLIENT_SECRET = "def";
  });

  it("returns redirect URL from supabase.auth.linkIdentity", async () => {
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

    const { runLinkProvider } = await loadCore();
    const result = await runLinkProvider("discord");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.redirectUrl).toMatch(/discord\.com/);
    }
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: "discord",
      options: expect.objectContaining({ scopes: "identify email" }),
    });
  });
});

describe("signInWithProviderAction (wrapper)", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
    process.env.DISCORD_CLIENT_SECRET = "def";
  });

  it("redirects to the provider URL on success", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi
      .fn()
      .mockResolvedValue({ data: { user: null }, error: null });
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://discord.com/oauth2/authorize?..." },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, signInWithOAuth },
    });

    const { signInWithProviderAction } = await loadActions();
    await expect(signInWithProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:https:\/\/discord\.com/
    );
  });

  it("redirects to /login?oauth_error=PROVIDER_UNAVAILABLE on failure", async () => {
    delete process.env.DISCORD_CLIENT_ID;
    const { signInWithProviderAction } = await loadActions();
    await expect(signInWithProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:\/login\?oauth_error=PROVIDER_UNAVAILABLE/
    );
  });
});

describe("unlinkProviderAction (wrapper)", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
    process.env.DISCORD_CLIENT_SECRET = "def";
  });

  it("redirects to /settings?oauth_status=unlinked on success", async () => {
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

    const { db } = await import("~/server/db");
    const updateMock = db.update as ReturnType<typeof vi.fn>;
    const callsBefore = updateMock.mock.calls.length;

    const { unlinkProviderAction } = await loadActions();
    await expect(unlinkProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:\/settings\?oauth_status=unlinked/
    );

    // Discord-specific: discord_user_id mirror must be cleared on unlink.
    expect(updateMock.mock.calls.length).toBe(callsBefore + 1);
  });

  it("redirects to /settings?oauth_error=ONLY_IDENTITY when refused", async () => {
    const { createClient } = await import("~/lib/supabase/server");
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const getUserIdentities = vi.fn().mockResolvedValue({
      data: { identities: [identity("discord")] },
      error: null,
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser, getUserIdentities },
    });

    const { unlinkProviderAction } = await loadActions();
    await expect(unlinkProviderAction("discord")).rejects.toThrow(
      /NEXT_REDIRECT:\/settings\?oauth_error=ONLY_IDENTITY/
    );
  });
});
