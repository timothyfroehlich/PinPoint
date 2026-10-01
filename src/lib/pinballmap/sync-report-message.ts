import { sanitizeDiscordText } from "~/lib/discord/messages";
import { getMachinePresenceLabel } from "~/lib/machines/presence";
import type {
  LineupComparison,
  LineupOutOfSyncTag,
  LineupReady,
} from "./lineup-comparison";
import { pinballmapLocationUrl } from "./public-url";

/**
 * Discord copy for the weekly Pinball Map sync report (pinballmap-sync-report
 * spec §4). Pure formatting, no IO — the schedule, claim, and send live in
 * `./sync-report`. The approved copy is recorded on bead PP-5qwx.
 *
 * Every title and machine name passes through `sanitizeDiscordText`: Pinball
 * Map titles are typed by strangers, and the report never mentions anyone
 * (§4.10). The only unsanitized text is our own literals and the URLs we build.
 */

const DISCORD_MAX_MESSAGE_LENGTH = 2000;

/** Most names a list shows before collapsing the rest into a count (§4.4). */
export const SYNC_REPORT_MAX_LIST_ITEMS = 10;

/** Past this, a single name is trimmed — only reached by pathological titles. */
const TRUNCATED_NAME_CODE_POINTS = 60;

const TAG_LABEL: Record<LineupOutOfSyncTag, string> = {
  to_add: "To add",
  to_remove: "To remove",
  to_update: "To update",
};
const TAG_ORDER: readonly LineupOutOfSyncTag[] = [
  "to_add",
  "to_remove",
  "to_update",
];

export interface SyncReportMessageInput {
  comparison: LineupComparison;
  /** The tracked location, for the attribution link-back (pinballmap §9.1). */
  locationId: number;
  /** PinPoint's absolute origin, for the lineup page link. */
  siteUrl: string;
  /**
   * The date of the stored lineup, formatted for display, when the most recent
   * refresh failed (§4.6); null when it succeeded.
   */
  staleLineupDate: string | null;
}

const HEADING = "**Pinball Map sync report**";

/**
 * Build the report, or null when nothing should post (Not configured, §4.7).
 * Link previews are suppressed by the caller's message flag; the `<…>` link
 * wrappers suppress them a second way.
 */
export function formatSyncReportMessage(
  input: SyncReportMessageInput
): string | null {
  const { comparison } = input;
  if (comparison.status === "not_configured") return null;

  const footer = [
    `[Review the lineup](<${input.siteUrl}/m/pinball-map>)`,
    `*Lineup data from [Pinball Map](<${pinballmapLocationUrl(input.locationId)}>) (CC BY-SA 4.0).*`,
  ].join("\n");

  if (comparison.status === "waiting") {
    return [
      `${HEADING}\nThe Pinball Map lineup has not loaded yet.`,
      footer,
    ].join("\n\n");
  }

  const stale =
    input.staleLineupDate === null
      ? null
      : `The last Pinball Map refresh failed. This report uses the lineup from ${input.staleLineupDate}.`;

  for (let cap = SYNC_REPORT_MAX_LIST_ITEMS; cap >= 1; cap -= 1) {
    const content = render(comparison, stale, footer, cap, false);
    if (content.length <= DISCORD_MAX_MESSAGE_LENGTH) return content;
  }
  // Only pathologically long titles reach here; trim each name so the report
  // still posts rather than failing every week.
  return render(comparison, stale, footer, 1, true).slice(
    0,
    DISCORD_MAX_MESSAGE_LENGTH
  );
}

function render(
  comparison: LineupReady,
  stale: string | null,
  footer: string,
  cap: number,
  truncate: boolean
): string {
  const name = (raw: string): string =>
    sanitizeDiscordText(truncate ? truncateName(raw) : raw);
  const intro = [HEADING, ...(stale === null ? [] : [stale])];

  if (comparison.toReview === 0) {
    const titles = comparison.inSync.length;
    intro.push(
      `Nothing to review. PinPoint and Pinball Map agree on all ${String(titles)} ${titles === 1 ? "title" : "titles"}.`
    );
    return [intro.join("\n"), footer].join("\n\n");
  }

  intro.push(`${String(comparison.toReview)} to review`);
  const blocks = [intro.join("\n")];
  const { sections } = comparison;

  if (sections.out_of_sync.length > 0) {
    const lines = TAG_ORDER.flatMap((tag) => {
      const titles = sections.out_of_sync
        .filter((row) => row.tag === tag)
        .map((row) => name(row.title.name));
      return titles.length === 0
        ? []
        : [`${TAG_LABEL[tag]}: ${inlineList(titles, cap)}`];
    });
    blocks.push(section("Out of sync", sections.out_of_sync.length, lines));
  }

  if (sections.pinpoint_only.length > 0) {
    blocks.push(
      section("In PinPoint, not linked", sections.pinpoint_only.length, [
        inlineList(
          sections.pinpoint_only.map((row) => name(row.machine.name)),
          cap
        ),
      ])
    );
  }

  if (sections.pinball_map_only.length > 0) {
    blocks.push(
      section("On Pinball Map, not linked", sections.pinball_map_only.length, [
        inlineList(
          sections.pinball_map_only.map((row) => name(row.title.name)),
          cap
        ),
      ])
    );
  }

  if (sections.availability_conflict.length > 0) {
    const lines = sections.availability_conflict.map(
      (row) =>
        `${row.tag === "alert" ? "Alert" : "Note"}: ${name(row.title.name)} (${getMachinePresenceLabel(row.machine.presenceStatus)})`
    );
    blocks.push(
      section(
        "Availability conflict",
        sections.availability_conflict.length,
        lineList(lines, cap)
      )
    );
  }

  blocks.push(footer);
  return blocks.join("\n\n");
}

function section(title: string, count: number, lines: string[]): string {
  return [`**${title}: ${String(count)}**`, ...lines].join("\n");
}

/** "A, B, C" — or "A, B, … and 3 more" past the cap. */
function inlineList(names: string[], cap: number): string {
  if (names.length <= cap) return names.join(", ");
  const more = names.length - cap;
  return `${names.slice(0, cap).join(", ")}, … and ${String(more)} more`;
}

/** One line per item, with a closing "… and N more" line past the cap. */
function lineList(lines: string[], cap: number): string[] {
  if (lines.length <= cap) return lines;
  return [...lines.slice(0, cap), `… and ${String(lines.length - cap)} more`];
}

/** Bound an untrusted label without splitting a Unicode code point. */
function truncateName(value: string): string {
  const codePoints = [...value];
  if (codePoints.length <= TRUNCATED_NAME_CODE_POINTS) return value;
  return `${codePoints.slice(0, TRUNCATED_NAME_CODE_POINTS - 1).join("")}…`;
}
