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
 *   by line count first and by length second. The line cap is what actually binds:
 *   a masked-link line carries the whole URL in the raw string (~60 chars of
 *   scaffolding plus the names), so ten of them plus the headline and footer land
 *   around 1000-1200 characters — comfortably inside the limit, with the length
 *   slice remaining a backstop against pathologically long venue names rather than
 *   a routine trim. Counting is against the RAW string, which is what Discord
 *   measures; the rendered line the reader sees is much shorter.
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
 * One line per new machine: the title, then the venue as a MASKED LINK to its
 * PinballMap page.
 *
 * The link is a LOCATION deep link, built by `pinballmapLocationUrl()` — PBM's
 * attribution terms require pointing at the specific listing the data came from,
 * and a per-machine URL would be wrong anyway because the lmx id is ephemeral
 * (CORE-PBM-001).
 *
 * **Masked rather than bare**, for two reasons. Discord stacks a link-preview
 * card under every bare URL it finds, which at hourly cadence — where most posts
 * are a single line — made each post several times taller than its own text. And
 * the venue name is the natural link text anyway.
 *
 * **The label is attacker-controlled.** Both the venue name and the machine title
 * were typed by strangers on pinballmap.com, and `[label](url)` gives a `]` inside
 * the label the power to close the mask and publish an arbitrary link under our
 * bot's name. `sanitizeDiscordText` escapes `[`, `]`, `(` and `)` for exactly this
 * reason — see its docstring. Never interpolate a PBM string into this line
 * without it, and never "simplify" by dropping the sanitize call because the value
 * looks like a plain name.
 *
 * The id fallbacks (`location #123`) are our own literals, and they take the label
 * position too so every line reads the same whether or not a name resolved.
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
  return `• ${machine} — [${venue}](${pinballmapLocationUrl(entry.locationId)})`;
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
  // Attribution: the data is Pinball Map's, under CC BY-SA 4.0. It is a licence
  // term, not a courtesy, so it is budgeted for rather than appended and hoped
  // for — trimming the assembled string from the end would drop THIS line first,
  // publishing PBM's data with the attribution cut off. Venue names are attacker-
  // adjacent free text (anyone can name a location on Pinball Map) and each line
  // already carries ~50 characters of URL scaffolding plus backslash escapes, so
  // exceeding 2000 needs no unusual luck.
  const attribution = "Data from Pinball Map (CC BY-SA 4.0).";
  const budget = DISCORD_MAX_MESSAGE_LENGTH - attribution.length - 1;

  const body = [headline, ...lines].join("\n");
  const trimmedBody =
    body.length > budget ? body.slice(0, budget - 1) + "…" : body;
  return `${trimmedBody}\n${attribution}`;
}
