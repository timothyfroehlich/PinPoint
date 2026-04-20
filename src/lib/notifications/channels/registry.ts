import { emailChannel } from "./email-channel";
import { inAppChannel } from "./in-app-channel";
import type { NotificationChannel } from "./types";

/**
 * Returns the list of active notification channels.
 *
 * A function (not a const) so later PRs (see PP-2n5) can register
 * the Discord channel conditionally on `getDiscordConfig().enabled`.
 * See spec decision #18 (missing bot token → channel not registered).
 *
 * Order matters for test determinism — in-app first, then email,
 * matches the historical ordering in the monolithic dispatcher.
 */
export function getChannels(): readonly NotificationChannel[] {
  return [inAppChannel, emailChannel];
}
