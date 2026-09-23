import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { notificationPreferences, userProfiles } from "~/server/db/schema";
import { getDiscordConfig } from "~/lib/discord/config";
import { sendDm } from "~/lib/discord/client";
import { formatDiscordWelcomeMessage } from "~/lib/discord/system-messages";
import { getSiteUrl } from "~/lib/url";
import { log } from "~/lib/logger";

export const DISCORD_NOTICE_VERSION = 1;

/**
 * Mirror the provider identity and atomically claim first-link onboarding.
 * No Discord I/O occurs in this transaction; the boolean tells the route
 * whether to schedule the welcome after commit.
 */
export async function syncDiscordIdentityAndClaimOnboarding(
  userId: string,
  discordUserId: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .update(userProfiles)
      .set({ discordUserId })
      .where(eq(userProfiles.id, userId));

    await tx
      .insert(notificationPreferences)
      .values({ userId })
      .onConflictDoNothing();

    const [claimed] = await tx
      .update(notificationPreferences)
      .set({
        discordEnabled: true,
        discordNotifyOnAssigned: true,
        discordNotifyOnStatusChange: true,
        discordNotifyOnNewComment: true,
        discordNotifyOnMentioned: true,
        discordNotifyOnNewIssue: true,
        discordWatchNewIssuesGlobal: false,
        suppressOwnActions: true,
        discordOnboardedAt: new Date(),
        discordNoticeVersion: DISCORD_NOTICE_VERSION,
      })
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          isNull(notificationPreferences.discordOnboardedAt)
        )
      )
      .returning({ userId: notificationPreferences.userId });

    return claimed !== undefined;
  });
}

export async function sendDiscordWelcome(discordUserId: string): Promise<void> {
  const config = await getDiscordConfig();
  if (!config) {
    log.warn(
      { action: "discord.onboarding.welcome" },
      "Discord welcome skipped because the integration is not configured"
    );
    return;
  }
  const result = await sendDm({
    botToken: config.botToken,
    discordUserId,
    content: formatDiscordWelcomeMessage(getSiteUrl()),
  });
  if (!result.ok) {
    log.warn(
      { reason: result.reason, action: "discord.onboarding.welcome" },
      "Discord welcome delivery failed"
    );
  }
}
