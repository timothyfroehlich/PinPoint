import "server-only";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "~/server/db";
import { notificationPreferences, userProfiles } from "~/server/db/schema";
import { getDiscordConfig } from "~/lib/discord/config";
import { sendDm } from "~/lib/discord/client";
import { formatDiscordImprovementNotice } from "~/lib/discord/system-messages";
import { getSiteUrl } from "~/lib/url";
import { DISCORD_NOTICE_VERSION } from "~/lib/discord/onboarding";

export interface DiscordRolloutResult {
  eligible: number;
  sent: number;
  skippedDisabled: number;
  failed: number;
}

type SendNotice = (discordUserId: string) => Promise<boolean>;

async function createImprovementNoticeSender(): Promise<SendNotice | null> {
  const config = await getDiscordConfig();
  if (!config) return null;
  const content = formatDiscordImprovementNotice(getSiteUrl());
  return async (discordUserId) => {
    const result = await sendDm({
      botToken: config.botToken,
      discordUserId,
      content,
    });
    return result.ok;
  };
}

/**
 * Dry-run by default. In send mode, disabled members are marked current without
 * being contacted; successful sends are versioned so a rerun skips them, while
 * failed sends remain eligible for an explicit retry.
 */
export async function runDiscordImprovementNoticeRollout({
  send = false,
  sendNotice,
}: {
  send?: boolean | undefined;
  sendNotice?: SendNotice | undefined;
} = {}): Promise<DiscordRolloutResult> {
  const candidates = await db
    .select({
      userId: notificationPreferences.userId,
      discordEnabled: notificationPreferences.discordEnabled,
      discordUserId: userProfiles.discordUserId,
    })
    .from(notificationPreferences)
    .innerJoin(
      userProfiles,
      eq(userProfiles.id, notificationPreferences.userId)
    )
    .where(
      and(
        isNotNull(userProfiles.discordUserId),
        lt(notificationPreferences.discordNoticeVersion, DISCORD_NOTICE_VERSION)
      )
    );

  const result: DiscordRolloutResult = {
    eligible: candidates.length,
    sent: 0,
    skippedDisabled: 0,
    failed: 0,
  };
  const effectiveSendNotice =
    send && !sendNotice ? await createImprovementNoticeSender() : sendNotice;

  for (const candidate of candidates) {
    if (!candidate.discordEnabled) {
      result.skippedDisabled += 1;
      if (send) await markNoticeCurrent(candidate.userId);
      continue;
    }
    if (!send) continue;
    const delivered =
      candidate.discordUserId && effectiveSendNotice
        ? await effectiveSendNotice(candidate.discordUserId)
        : false;
    if (delivered) {
      await markNoticeCurrent(candidate.userId);
      result.sent += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

async function markNoticeCurrent(userId: string): Promise<void> {
  await db
    .update(notificationPreferences)
    .set({ discordNoticeVersion: DISCORD_NOTICE_VERSION })
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        lt(notificationPreferences.discordNoticeVersion, DISCORD_NOTICE_VERSION)
      )
    );
}
