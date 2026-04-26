import { getDiscordConfig } from "~/lib/discord/config";
import { discordChannel } from "./discord-channel";
import { emailChannel } from "./email-channel";
import { inAppChannel } from "./in-app-channel";
import type { NotificationChannel } from "./types";

/**
 * Returns the list of active notification channels.
 *
 * Order is fixed for test determinism:
 *   in_app → email → discord
 *
 * Discord is appended only when getDiscordConfig() returns a usable config
 * (see spec decision #18: missing token / disabled toggle → channel not
 * registered, no UI advertising the feature).
 */
export async function getChannels(): Promise<readonly NotificationChannel[]> {
  const channels: NotificationChannel[] = [inAppChannel, emailChannel];
  const discord = await getDiscordConfig();
  if (discord) channels.push(discordChannel);
  return channels;
}
