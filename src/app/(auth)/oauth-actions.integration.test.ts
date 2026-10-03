import { describe, expect, it, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { UserIdentity } from "@supabase/supabase-js";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { userProfiles } from "~/server/db/schema";
import { createTestUser } from "~/test/helpers/factories";
import { runUnlinkProvider } from "./oauth-actions-core";
import { unlinkProviderAction } from "./oauth-actions";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const mockGetUser = vi.fn();
const mockGetUserIdentities = vi.fn();
const mockUnlinkIdentity = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        getUserIdentities: mockGetUserIdentities,
        unlinkIdentity: mockUnlinkIdentity,
      },
    })
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

function makeIdentity(provider: string, userId: string): UserIdentity {
  return {
    identity_id: `id-${provider}`,
    id: `row-${provider}`,
    user_id: userId,
    identity_data: {},
    provider,
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("OAuth actions integration (PGlite)", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DISCORD_CLIENT_ID = "abc";
    process.env.DISCORD_CLIENT_SECRET = "def";
  });

  it("unlinkProviderAction clears discordUserId in real database upon successful unlink", async () => {
    const db = await getTestDb();
    const userId = randomUUID();

    await db.insert(userProfiles).values(
      createTestUser({
        id: userId,
        email: "discord-user@example.com",
        discordUserId: "discord-snowflake-12345",
      })
    );

    const identities = [
      makeIdentity("email", userId),
      makeIdentity("discord", userId),
    ];

    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockGetUserIdentities.mockResolvedValue({
      data: { identities },
      error: null,
    });
    mockUnlinkIdentity.mockResolvedValue({ error: null });

    await expect(unlinkProviderAction("discord")).rejects.toThrow(
      "NEXT_REDIRECT:/settings?oauth_status=unlinked"
    );

    const updated = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
    });
    expect(updated?.discordUserId).toBeNull();
  });

  it("refuses second unlink once user is back to one identity", async () => {
    const userId = randomUUID();
    let identities = [
      makeIdentity("email", userId),
      makeIdentity("discord", userId),
    ];

    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mockGetUserIdentities.mockImplementation(() =>
      Promise.resolve({
        data: { identities },
        error: null,
      })
    );
    mockUnlinkIdentity.mockImplementation((idToUnlink: UserIdentity) => {
      identities = identities.filter((i) => i.provider !== idToUnlink.provider);
      return Promise.resolve({ error: null });
    });

    const first = await runUnlinkProvider("discord");
    expect(first.ok).toBe(true);
    expect(identities.map((i) => i.provider)).toEqual(["email"]);

    const second = await runUnlinkProvider("discord");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("NOT_LINKED");
  });
});
