import type { DiscordChannelStatus } from "~/lib/discord/channel-check";

/** The saved activity summary settings the form starts from. */
export interface ActivitySummaryViewState {
  channelId: string | null;
  /** Null is Disabled. */
  intervalHours: number | null;
  /** US Central hour, 0–23. */
  startHour: number;
  events: readonly string[];
  status: DiscordChannelStatus;
  statusDetail: string | null;
  lastPostAtIso: string | null;
}
