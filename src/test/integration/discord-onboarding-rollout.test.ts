import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { notificationPreferences, userProfiles } from "~/server/db/schema";
import { createTestUser } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { DISCORD_NOTICE_VERSION, syncDiscordIdentityAndClaimOnboarding } =
  await import("~/lib/discord/onboarding");
const { runDiscordImprovementNoticeRollout } =
  await import("~/lib/discord/improvement-rollout");

describe("Discord first-link onboarding and rollout", () => {
  setupTestDb();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies first-link defaults exactly once and preserves relink choices", async () => {
    const db = await getTestDb();
    const [user] = await db
      .insert(userProfiles)
      .values(createTestUser({ discordUserId: null }))
      .returning();
    await db.insert(notificationPreferences).values({
      userId: user.id,
      discordEnabled: false,
      discordNotifyOnAssigned: false,
      discordNotifyOnStatusChange: false,
      discordNotifyOnNewComment: false,
      discordNotifyOnMentioned: false,
      discordNotifyOnNewIssue: false,
      discordWatchNewIssuesGlobal: true,
      suppressOwnActions: false,
    });

    await expect(
      syncDiscordIdentityAndClaimOnboarding(user.id, "discord-first")
    ).resolves.toBe(true);
    const first = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });
    expect(first).toMatchObject({
      discordEnabled: true,
      discordNotifyOnAssigned: true,
      discordNotifyOnStatusChange: true,
      discordNotifyOnNewComment: true,
      discordNotifyOnMentioned: true,
      discordNotifyOnNewIssue: true,
      discordWatchNewIssuesGlobal: false,
      suppressOwnActions: true,
      discordNoticeVersion: DISCORD_NOTICE_VERSION,
    });
    expect(first?.discordOnboardedAt).toBeInstanceOf(Date);

    await db
      .update(notificationPreferences)
      .set({ discordNotifyOnNewComment: false })
      .where(eq(notificationPreferences.userId, user.id));
    await expect(
      syncDiscordIdentityAndClaimOnboarding(user.id, "discord-relinked")
    ).resolves.toBe(false);
    const relinked = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });
    expect(relinked?.discordNotifyOnNewComment).toBe(false);
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    expect(profile?.discordUserId).toBe("discord-relinked");
  });

  it("is dry-run by default and sends only to enabled linked members", async () => {
    const db = await getTestDb();
    const [enabled, disabled] = await db
      .insert(userProfiles)
      .values([
        createTestUser({ discordUserId: "discord-enabled" }),
        createTestUser({
          email: "disabled@example.com",
          discordUserId: "discord-disabled",
        }),
      ])
      .returning();
    await db.insert(notificationPreferences).values([
      { userId: enabled.id, discordEnabled: true },
      { userId: disabled.id, discordEnabled: false },
    ]);
    const sendNotice = vi.fn(() => Promise.resolve(true));

    await expect(
      runDiscordImprovementNoticeRollout({ sendNotice })
    ).resolves.toEqual({
      eligible: 2,
      sent: 0,
      skippedDisabled: 1,
      failed: 0,
    });
    expect(sendNotice).not.toHaveBeenCalled();

    await expect(
      runDiscordImprovementNoticeRollout({ send: true, sendNotice })
    ).resolves.toEqual({
      eligible: 2,
      sent: 1,
      skippedDisabled: 1,
      failed: 0,
    });
    expect(sendNotice).toHaveBeenCalledOnce();
    expect(sendNotice).toHaveBeenCalledWith("discord-enabled");

    await expect(
      runDiscordImprovementNoticeRollout({ send: true, sendNotice })
    ).resolves.toEqual({
      eligible: 0,
      sent: 0,
      skippedDisabled: 0,
      failed: 0,
    });
    expect(sendNotice).toHaveBeenCalledOnce();
  });

  it("leaves failed sends eligible for an explicit retry", async () => {
    const db = await getTestDb();
    const [user] = await db
      .insert(userProfiles)
      .values(createTestUser({ discordUserId: "discord-retry" }))
      .returning();
    await db.insert(notificationPreferences).values({ userId: user.id });

    await expect(
      runDiscordImprovementNoticeRollout({
        send: true,
        sendNotice: () => Promise.resolve(false),
      })
    ).resolves.toMatchObject({ eligible: 1, sent: 0, failed: 1 });
    await expect(runDiscordImprovementNoticeRollout()).resolves.toMatchObject({
      eligible: 1,
    });
  });
});
