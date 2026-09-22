import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "~/server/db";
import { notificationPreferences, userProfiles } from "~/server/db/schema";
import { getDiscordConfig } from "~/lib/discord/config";
import { sendDm } from "~/lib/discord/client";
import { formatDiscordImprovementNotice } from "~/lib/discord/system-messages";
import { getSiteUrl } from "~/lib/url";
import { DISCORD_NOTICE_VERSION } from "~/lib/discord/onboarding";

const NOTICE_LEASE_MS = 5 * 60 * 1000;

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
  const now = new Date();
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
        lt(
          notificationPreferences.discordNoticeVersion,
          DISCORD_NOTICE_VERSION
        ),
        or(
          isNull(notificationPreferences.discordNoticeLeaseId),
          lt(notificationPreferences.discordNoticeLeaseExpiresAt, now)
        )
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
    if (!send) {
      if (!candidate.discordEnabled) result.skippedDisabled += 1;
      continue;
    }

    const leaseId = await claimNotice(candidate.userId);
    if (leaseId === null) continue;

    if (!candidate.discordEnabled) {
      const finalized = await markNoticeCurrent(candidate.userId, leaseId);
      if (finalized) {
        result.skippedDisabled += 1;
      } else {
        result.failed += 1;
      }
      continue;
    }
    let delivered: boolean;
    try {
      delivered =
        candidate.discordUserId && effectiveSendNotice
          ? await effectiveSendNotice(candidate.discordUserId)
          : false;
    } catch (error) {
      await releaseNoticeClaim(candidate.userId, leaseId);
      throw error;
    }
    if (delivered) {
      const finalized = await markNoticeCurrent(candidate.userId, leaseId);
      if (finalized) {
        result.sent += 1;
      } else {
        result.failed += 1;
      }
    } else {
      await releaseNoticeClaim(candidate.userId, leaseId);
      result.failed += 1;
    }
  }

  return result;
}

async function claimNotice(userId: string): Promise<string | null> {
  const now = new Date();
  const leaseId = randomUUID();
  const [claimed] = await db
    .update(notificationPreferences)
    .set({
      discordNoticeLeaseId: leaseId,
      discordNoticeLeaseExpiresAt: new Date(now.getTime() + NOTICE_LEASE_MS),
    })
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        lt(
          notificationPreferences.discordNoticeVersion,
          DISCORD_NOTICE_VERSION
        ),
        or(
          isNull(notificationPreferences.discordNoticeLeaseId),
          lt(notificationPreferences.discordNoticeLeaseExpiresAt, now)
        )
      )
    )
    .returning({ userId: notificationPreferences.userId });
  return claimed === undefined ? null : leaseId;
}

async function markNoticeCurrent(
  userId: string,
  leaseId: string
): Promise<boolean> {
  const [updated] = await db
    .update(notificationPreferences)
    .set({
      discordNoticeVersion: DISCORD_NOTICE_VERSION,
      discordNoticeLeaseId: null,
      discordNoticeLeaseExpiresAt: null,
    })
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.discordNoticeLeaseId, leaseId)
      )
    )
    .returning({ userId: notificationPreferences.userId });
  return updated !== undefined;
}

async function releaseNoticeClaim(
  userId: string,
  leaseId: string
): Promise<void> {
  await db
    .update(notificationPreferences)
    .set({
      discordNoticeLeaseId: null,
      discordNoticeLeaseExpiresAt: null,
    })
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.discordNoticeLeaseId, leaseId)
      )
    );
}
