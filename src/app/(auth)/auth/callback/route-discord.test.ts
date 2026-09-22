import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServerModule from "next/server";

const mocks = vi.hoisted(() => ({
  after: vi.fn<(task: () => Promise<void>) => void>(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  getUserIdentities: vi.fn(),
  claimOnboarding: vi.fn(),
  sendWelcome: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof NextServerModule>();
  return { ...actual, after: mocks.after };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
      getUserIdentities: mocks.getUserIdentities,
    },
  }),
}));

vi.mock("~/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({
    url: "http://supabase.test",
    publishableKey: "key",
  }),
}));

vi.mock("~/lib/url", () => ({
  getSiteUrl: () => "http://localhost:3000",
  isInternalUrl: (value: string) =>
    value.startsWith("/") && !value.startsWith("//"),
}));

vi.mock("~/lib/discord/onboarding", () => ({
  syncDiscordIdentityAndClaimOnboarding: mocks.claimOnboarding,
  sendDiscordWelcome: mocks.sendWelcome,
}));

vi.mock("~/lib/observability/report-error", () => ({
  reportError: mocks.reportError,
}));

const { NextRequest } = await import("next/server");
const { GET } = await import("./route");

describe("Discord auth callback onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          {
            provider: "discord",
            identity_data: { provider_id: "discord-1" },
          },
        ],
      },
      error: null,
    });
    mocks.claimOnboarding.mockResolvedValue(true);
    mocks.sendWelcome.mockResolvedValue(undefined);
  });

  it("schedules a welcome only when first-link onboarding is claimed", async () => {
    await GET(
      new NextRequest("http://localhost:3000/auth/callback?code=oauth-code")
    );

    expect(mocks.claimOnboarding).toHaveBeenCalledWith("user-1", "discord-1");
    expect(mocks.after).toHaveBeenCalledOnce();
    const task = mocks.after.mock.calls[0]?.[0];
    await task?.();
    expect(mocks.sendWelcome).toHaveBeenCalledWith("discord-1");

    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          {
            provider: "discord",
            identity_data: { provider_id: "discord-1" },
          },
        ],
      },
      error: null,
    });
    mocks.claimOnboarding.mockResolvedValue(false);

    await GET(
      new NextRequest("http://localhost:3000/auth/callback?code=oauth-code")
    );
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("reports a welcome failure without failing the successful callback", async () => {
    mocks.sendWelcome.mockRejectedValue(new Error("Discord unavailable"));
    const response = await GET(
      new NextRequest("http://localhost:3000/auth/callback?code=oauth-code")
    );
    expect(response.status).toBe(307);

    const task = mocks.after.mock.calls[0]?.[0];
    await expect(task?.()).resolves.toBeUndefined();
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        action: "auth.callback.discordWelcome",
        bestEffort: true,
      })
    );
  });

  it("does not run Discord onboarding for a non-Discord callback", async () => {
    mocks.getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          {
            provider: "google",
            identity_data: { provider_id: "google-1" },
          },
        ],
      },
      error: null,
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/auth/callback?code=oauth-code")
    );

    expect(response.status).toBe(307);
    expect(mocks.claimOnboarding).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
