import { sanitizeDiscordText } from "~/lib/discord/messages";
import { pinballmapLocationUrl } from "./public-url";

/**
 * Discord copy for added and removed machines in a Pinball Map region.
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
  eventType: "added" | "removed";
  locationId: number;
  locationName: string;
  machineName: string;
}

export interface RegionAlertMessageInput {
  /** Every entry being announced — including the ones past the line cap. */
  entries: RegionAlertEntry[];
  /** Human label for the region, e.g. "Austin". */
  regionLabel: string;
}

export interface FormattedRegionAlertMessage {
  content: string;
  /** Leading entries represented by individual lines in this message. */
  renderedEntries: number;
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
 * Both names are required at the type boundary because Discord posts are immutable;
 * unresolved events remain queued until the catalog and location cache can name them.
 */
/**
 * Render a candidate set of entries into the formatted Discord message.
 *
 * Preserves the order in which locations and machines appear in `renderedEntries`.
 * Location header: masked link to location on Pinball Map.
 * Machine lines: `• ❇️ <Machine>` for added, `• ❌ <Machine>` for removed.
 */
function renderMessage(
  renderedEntries: RegionAlertEntry[],
  totalCount: number,
  regionLabel: string
): string {
  const region = sanitizeDiscordText(regionLabel);
  const headline = `**Pinball Map changes in ${region}**`;
  const attribution = "*Data from Pinball Map (CC BY-SA 4.0).*";

  const groups = new Map<
    number,
    {
      locationName: string;
      machines: { eventType: "added" | "removed"; machineName: string }[];
    }
  >();

  for (const entry of renderedEntries) {
    let group = groups.get(entry.locationId);
    if (!group) {
      group = {
        locationName: entry.locationName,
        machines: [],
      };
      groups.set(entry.locationId, group);
    }
    group.machines.push({
      eventType: entry.eventType,
      machineName: entry.machineName,
    });
  }

  const sections: string[] = [headline];

  for (const [locationId, group] of groups) {
    const venue = sanitizeDiscordText(group.locationName);
    const header = `**[${venue}](${pinballmapLocationUrl(locationId)})**`;
    const lines = group.machines.map((m) => {
      const badge = m.eventType === "added" ? "❇️" : "❌";
      const name = sanitizeDiscordText(m.machineName);
      return `• ${badge} ${name}`;
    });
    sections.push([header, ...lines].join("\n"));
  }

  const omitted = totalCount - renderedEntries.length;
  if (omitted > 0) {
    sections.push(
      `• …and ${String(omitted)} more changes (see the map for the full picture)`
    );
  }

  sections.push(attribution);
  return sections.join("\n\n");
}

/**
 * Build one announcement batch, or null when there is nothing to announce.
 *
 * Groups machine changes under their location header (with masked Pinball Map
 * deep link) and lists each machine with a status badge (❇️ for added, ❌ for
 * removed).
 *
 * A stable headline lets one digest carry both transition types in detection
 * order without implying that a mixed post contains additions only. The caller
 * must settle only `renderedEntries`; everything omitted by the line/length cap
 * remains queued for a later digest.
 */
export function formatRegionAlertMessage(
  input: RegionAlertMessageInput
): FormattedRegionAlertMessage | null {
  const { entries, regionLabel } = input;
  if (entries.length === 0) return null;

  const maxCandidates = Math.min(entries.length, REGION_ALERT_MAX_LINES);

  for (let k = maxCandidates; k >= 1; k -= 1) {
    const candidateSlice = entries.slice(0, k);
    const content = renderMessage(candidateSlice, entries.length, regionLabel);
    if (content.length <= DISCORD_MAX_MESSAGE_LENGTH) {
      return {
        content,
        renderedEntries: k,
      };
    }
  }

  // If even a single entry exceeds the budget, it must be due to pathological names.
  // Bound both names of the first entry so the queued event is not stranded forever.
  const first = entries[0];
  if (first !== undefined) {
    const compacted: RegionAlertEntry = {
      ...first,
      locationName: truncateName(first.locationName),
      machineName: truncateName(first.machineName),
    };
    const content = renderMessage([compacted], entries.length, regionLabel);
    if (content.length <= DISCORD_MAX_MESSAGE_LENGTH) {
      return {
        content,
        renderedEntries: 1,
      };
    }
  }

  return null;
}

/** Bound untrusted labels without splitting a Unicode code point. */
function truncateName(name: string, maxCodePoints = 80): string {
  const codePoints = [...name];
  if (codePoints.length <= maxCodePoints) return name;
  return `${codePoints.slice(0, maxCodePoints - 1).join("")}…`;
}
