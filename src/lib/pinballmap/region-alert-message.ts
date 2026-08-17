import { sanitizeDiscordText } from "~/lib/discord/messages";
import { pinballmapLocationUrl } from "./public-url";

/**
 * Discord copy for the "new machines in the Austin region" alert (PP-o355.18).
 *
 * Pure formatting, no IO — the diff and the send live in `./region-alerts`.
 *
 * Two constraints shape the output:
 * - Discord hard-rejects a message over 2000 characters with a 400, which the
 *   client classifies as transient and would retry forever. So the body is capped
 *   by line count first and by length second.
 * - Every venue and title in here was typed by a stranger on pinballmap.com, so
 *   all of it goes through `sanitizeDiscordText` (mention + Markdown neutering).
 *   The only unsanitized text is our own literals and the URL we build ourselves.
 */

const DISCORD_MAX_MESSAGE_LENGTH = 2000;

/** Most entries listed individually; the rest collapse into a count. */
export const REGION_ALERT_MAX_LINES = 10;

export interface RegionAlertEntry {
  locationId: number;
  locationName: string | null;
  machineName: string | null;
  pinballmapMachineId: number;
}

export interface RegionAlertMessageInput {
  /** Every entry being announced — including the ones past the line cap. */
  entries: RegionAlertEntry[];
  /** Human label for the region, e.g. "Austin". */
  regionLabel: string;
}

/**
 * One line per new machine: title, venue, and the venue's own PinballMap page.
 *
 * The link is a LOCATION deep link, built by `pinballmapLocationUrl()` — PBM's
 * attribution terms require pointing at the specific listing the data came from,
 * and a per-machine URL would be wrong anyway because the lmx id is ephemeral
 * (CORE-PBM-001).
 */
function formatEntry(entry: RegionAlertEntry): string {
  const machine =
    entry.machineName === null
      ? `PinballMap machine #${String(entry.pinballmapMachineId)}`
      : sanitizeDiscordText(entry.machineName);
  const venue =
    entry.locationName === null
      ? `location #${String(entry.locationId)}`
      : sanitizeDiscordText(entry.locationName);
  return `• ${machine} — ${venue}: ${pinballmapLocationUrl(entry.locationId)}`;
}

/**
 * Build the announcement, or null when there is nothing to announce.
 *
 * Singular and plural get their own headline because "1 new machines" reads as a
 * bug in a channel post.
 */
export function formatRegionAlertMessage(
  input: RegionAlertMessageInput
): string | null {
  const { entries, regionLabel } = input;
  if (entries.length === 0) return null;

  const region = sanitizeDiscordText(regionLabel);
  const headline =
    entries.length === 1
      ? `**New on Pinball Map in ${region}**`
      : `**${String(entries.length)} new machines on Pinball Map in ${region}**`;

  const shown = entries.slice(0, REGION_ALERT_MAX_LINES);
  const hidden = entries.length - shown.length;
  const lines = shown.map(formatEntry);
  if (hidden > 0) {
    lines.push(
      `• …and ${String(hidden)} more (see the map for the full picture)`
    );
  }
  // Attribution: the data is Pinball Map's, under CC BY-SA 4.0.
  lines.push("Data from Pinball Map (CC BY-SA 4.0).");

  const assembled = [headline, ...lines].join("\n");
  return assembled.length > DISCORD_MAX_MESSAGE_LENGTH
    ? assembled.slice(0, DISCORD_MAX_MESSAGE_LENGTH - 1) + "…"
    : assembled;
}
