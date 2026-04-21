import { describe, expect, it, vi, beforeEach } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";

import type * as OAuthCoreModule from "./oauth-actions-core";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

async function loadCore(): Promise<typeof OAuthCoreModule> {
  vi.resetModules();
  return import("./oauth-actions-core");
}

function makeIdentity(provider: string): UserIdentity {
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

describe("link -> unlink round-trip", () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = "abc";
    process.env.DISCORD_CLIENT_SECRET = "def";
  });

  it("refuses second unlink once user is back to one identity", async () => {
    const state = {
      identities: [makeIdentity("email"), makeIdentity("discord")],
    };

    const { createClient } = await import("~/lib/supabase/server");
    const fakeClient = {
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: { id: "u1" } },
            error: null,
          }),
        getUserIdentities: () =>
          Promise.resolve({
            data: { identities: [...state.identities] },
            error: null,
          }),
        unlinkIdentity: (identity: UserIdentity) => {
          state.identities = state.identities.filter(
            (i) => i.provider !== identity.provider
          );
          return Promise.resolve({ error: null });
        },
      },
    };
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fakeClient);

    const { runUnlinkProvider } = await loadCore();

    const first = await runUnlinkProvider("discord");
    expect(first.ok).toBe(true);
    expect(state.identities.map((i) => i.provider)).toEqual(["email"]);

    const second = await runUnlinkProvider("discord");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("NOT_LINKED");
  });
});
