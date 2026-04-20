//
// STUB scaffolded by PR 1. NOT registered by getChannels() in this PR.
// PR 4 (bead PP-2n5) fills in sendDm, reads discord_user_id from ctx,
// and adds this channel to the registry when getDiscordConfig().enabled.
import type {
  NotificationChannel,
  NotificationPreferencesRow,
  ChannelContext,
  DeliveryResult,
} from "./types";
import type { NotificationType } from "~/lib/notifications/dispatch";

export const discordChannel: NotificationChannel = {
  key: "discord",
  shouldDeliver(
    _prefs: NotificationPreferencesRow,
    _type: NotificationType
  ): boolean {
    // Intentionally unreachable in PR 1 — channel is not registered.
    return false;
  },
  // eslint-disable-next-line @typescript-eslint/require-await -- stub throws synchronously in PR 1; PR 4 adds await on Discord API client
  async deliver(_ctx: ChannelContext): Promise<DeliveryResult> {
    throw new Error(
      "discordChannel.deliver() invoked in PR 1 — not yet implemented. See PP-2n5."
    );
  },
};
