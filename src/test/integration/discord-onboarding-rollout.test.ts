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

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise = (): void => {
    throw new Error("deferred promise was not initialized");
  };
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

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

  it("atomically claims a recipient across overlapping send runs", async () => {
    const db = await getTestDb();
    const [user] = await db
      .insert(userProfiles)
      .values(createTestUser({ discordUserId: "discord-overlap" }))
      .returning();
    await db.insert(notificationPreferences).values({ userId: user.id });

    const sendStarted = createDeferred();
    const finishSend = createDeferred();
    const firstSender = vi.fn(async () => {
      sendStarted.resolve();
      await finishSend.promise;
      return true;
    });
    const secondSender = vi.fn(() => Promise.resolve(true));

    const firstRun = runDiscordImprovementNoticeRollout({
      send: true,
      sendNotice: firstSender,
    });
    await sendStarted.promise;

    await expect(
      runDiscordImprovementNoticeRollout({
        send: true,
        sendNotice: secondSender,
      })
    ).resolves.toEqual({
      eligible: 0,
      sent: 0,
      skippedDisabled: 0,
      failed: 0,
    });
    expect(secondSender).not.toHaveBeenCalled();

    finishSend.resolve();
    await expect(firstRun).resolves.toMatchObject({ sent: 1, failed: 0 });
    expect(firstSender).toHaveBeenCalledOnce();

    const preferences = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });
    expect(preferences).toMatchObject({
      discordNoticeVersion: DISCORD_NOTICE_VERSION,
      discordNoticeLeaseId: null,
      discordNoticeLeaseExpiresAt: null,
    });
  });

  it("reports a delivered notice as failed when its lease was reclaimed", async () => {
    const db = await getTestDb();
    const [user] = await db
      .insert(userProfiles)
      .values(createTestUser({ discordUserId: "discord-reclaimed" }))
      .returning();
    await db.insert(notificationPreferences).values({ userId: user.id });

    await expect(
      runDiscordImprovementNoticeRollout({
        send: true,
        sendNotice: async () => {
          await db
            .update(notificationPreferences)
            .set({
              discordNoticeLeaseId: "00000000-0000-4000-8000-000000000001",
            })
            .where(eq(notificationPreferences.userId, user.id));
          return true;
        },
      })
    ).resolves.toMatchObject({ eligible: 1, sent: 0, failed: 1 });

    const preferences = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, user.id),
    });
    expect(preferences?.discordNoticeVersion).toBeLessThan(
      DISCORD_NOTICE_VERSION
    );
  });
});
