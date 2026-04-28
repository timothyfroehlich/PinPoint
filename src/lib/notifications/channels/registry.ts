import { getDiscordConfig } from "~/lib/discord/config";
import { log } from "~/lib/logger";
import { createDiscordChannel } from "./discord-channel";
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
 *
 * The Discord config is fetched once here and bound into the channel via a
 * factory closure, so a fan-out delivery to N recipients makes one Vault
 * round-trip total — not N+1.
 *
 * If Discord config fails to load for any reason (missing admin env vars,
 * Vault RPC error, transient Supabase failure), Discord is silently
 * skipped and a warning is logged. Email + in-app still deliver.
 */
export async function getChannels(): Promise<readonly NotificationChannel[]> {
  const channels: NotificationChannel[] = [inAppChannel, emailChannel];
  try {
    const discord = await getDiscordConfig();
    if (discord) channels.push(createDiscordChannel(discord));
  } catch (err) {
    log.warn(
      {
        err,
        action: "getChannels.discord",
      },
      "Discord channel registration skipped — getDiscordConfig threw"
    );
  }
  return channels;
}
