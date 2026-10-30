import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";

/**
 * The Discord integration's singleton settings row as the Integrations page
 * shows it, or undefined when the row does not exist yet. The token itself is
 * never read: `botTokenVaultId` only says whether one is stored.
 * `cache()`-wrapped per request.
 */
export const getDiscordIntegrationSettings = cache(async () =>
  db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
    columns: {
      guildId: true,
      inviteLink: true,
      botTokenVaultId: true,
      summaryChannelId: true,
      summaryIntervalHours: true,
      summaryStartHour: true,
      summaryEvents: true,
      summaryStatus: true,
      summaryStatusDetail: true,
      summaryLastPostAt: true,
    },
  })
);
