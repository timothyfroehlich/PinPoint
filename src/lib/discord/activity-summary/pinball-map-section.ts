import {
  sanitizeDiscordText,
  truncateDiscordLabel,
} from "~/lib/discord/messages";
import { getMachinePresenceLabel } from "~/lib/machines/presence";
import {
  LINEUP_SECTIONS,
  type LineupComparison,
  type LineupOutOfSyncTag,
  type LineupReady,
} from "~/lib/pinballmap/lineup-comparison";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";

/**
 * The activity summary's Pinball Map section (discord-activity-summary spec
 * §5.5–§5.11): the lineup page's rows to review at the post time. Pure
 * formatting over the stored comparison — producing it never calls Pinball
 * Map (§5.12, CORE-PBM-001).
 *
 * Ported from the retired weekly sync report's formatter (PP-5qwx). Every
 * title and machine name passes through `sanitizeDiscordText`: Pinball Map
 * titles are typed by strangers (§6.11).
 */

/** Most names a list shows before collapsing the rest into a count (§5.7). */
export const PINBALL_MAP_MAX_LIST_ITEMS = 10;

/** Past this, a single name is trimmed — only reached by pathological titles. */
const TRUNCATED_NAME_CODE_POINTS = 60;

const HEADING = "### 📍 Pinball Map";

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

/**
 * A stable key per row to review, sorted, for telling whether the rows changed
 * between two periods (§5.11). Null while there is no comparison to key — Not
 * configured or Waiting — so those states never read as a change.
 */
export function pinballMapReviewKeys(
  comparison: LineupComparison
): string[] | null {
  if (comparison.status !== "ready") return null;
  return LINEUP_SECTIONS.flatMap((section) =>
    comparison.sections[section].map((row) => `${section}:${row.key}`)
  ).sort();
}

/**
 * Whether the rows to review changed during the period (§5.11): a row was
 * added or resolved. The first period has no stored set, so it sets the
 * baseline rather than reporting everything as new.
 */
export function pinballMapReviewChanged(
  stored: readonly string[] | null,
  current: readonly string[] | null
): boolean {
  if (stored === null || current === null) return false;
  if (stored.length !== current.length) return true;
  const sorted = [...stored].sort();
  return sorted.some((key, index) => key !== current[index]);
}

export interface PinballMapSectionInput {
  comparison: LineupComparison;
  /** The tracked location, for the attribution link-back (pinballmap §9.1). */
  locationId: number;
  /** PinPoint's absolute origin, for the lineup page link. */
  siteUrl: string;
  /**
   * The date of the stored lineup, formatted for display, when the most recent
   * refresh failed (§5.8); null when it succeeded.
   */
  staleLineupDate: string | null;
  /** The longest the section may be, so it fits in one message (§7.1). */
  maxLength: number;
}

/**
 * The section's text, or null while Pinball Map is not configured (§5.11).
 * Link previews are suppressed by the caller's message flag; the `<…>` link
 * wrappers suppress them a second way.
 */
export function formatPinballMapSection(
  input: PinballMapSectionInput
): string | null {
  const { comparison } = input;
  if (comparison.status === "not_configured") return null;

  const footer = [
    `[Review the lineup](<${input.siteUrl}/m/pinball-map>)`,
    `*Lineup data from [Pinball Map](<${pinballmapLocationUrl(input.locationId)}>) (CC BY-SA 4.0).*`,
  ].join("\n");

  if (comparison.status === "waiting") {
    return [HEADING, "The Pinball Map lineup has not loaded yet.", footer].join(
      "\n"
    );
  }

  const stale =
    input.staleLineupDate === null
      ? null
      : `The last Pinball Map refresh failed. This summary uses the lineup from ${input.staleLineupDate}.`;

  for (let cap = PINBALL_MAP_MAX_LIST_ITEMS; cap >= 1; cap -= 1) {
    const content = render(comparison, stale, footer, cap, false);
    if (content.length <= input.maxLength) return content;
  }
  // Only pathologically long titles reach here; trim each name so the section
  // still fits. If even that is too long, cut the body — never the footer,
  // which carries the attribution (§5.10).
  const full = render(comparison, stale, footer, 1, true);
  if (full.length <= input.maxLength) return full;
  const body = full.slice(0, full.length - footer.length - 1);
  const room = input.maxLength - footer.length - 1;
  return `${body.slice(0, Math.max(0, room - 1))}…\n${footer}`;
}

function render(
  comparison: LineupReady,
  stale: string | null,
  footer: string,
  cap: number,
  truncate: boolean
): string {
  const name = (raw: string): string =>
    sanitizeDiscordText(
      truncate ? truncateDiscordLabel(raw, TRUNCATED_NAME_CODE_POINTS) : raw
    );
  const lines = [HEADING, ...(stale === null ? [] : [stale])];

  if (comparison.toReview === 0) {
    const titles = comparison.inSync.length;
    lines.push(
      `Nothing to review. PinPoint and Pinball Map agree on all ${String(titles)} ${titles === 1 ? "title" : "titles"}.`,
      footer
    );
    return lines.join("\n");
  }

  lines.push(`${String(comparison.toReview)} to review`);
  const { sections } = comparison;

  // Sections in the lineup page's order (§5.5), names per §5.6.
  if (sections.out_of_sync.length > 0) {
    lines.push(
      sectionLine("Out of sync", sections.out_of_sync.length),
      ...TAG_ORDER.flatMap((tag) => {
        const titles = sections.out_of_sync
          .filter((row) => row.tag === tag)
          .map((row) => name(row.title.name));
        return titles.length === 0
          ? []
          : [`${TAG_LABEL[tag]}: ${inlineList(titles, cap)}`];
      })
    );
  }

  if (sections.pinpoint_only.length > 0) {
    lines.push(
      sectionLine("In PinPoint, not linked", sections.pinpoint_only.length),
      inlineList(
        sections.pinpoint_only.map((row) => name(row.machine.name)),
        cap
      )
    );
  }

  if (sections.pinball_map_only.length > 0) {
    lines.push(
      sectionLine(
        "On Pinball Map, not linked",
        sections.pinball_map_only.length
      ),
      inlineList(
        sections.pinball_map_only.map((row) => name(row.title.name)),
        cap
      )
    );
  }

  if (sections.availability_conflict.length > 0) {
    lines.push(
      sectionLine(
        "Availability conflict",
        sections.availability_conflict.length
      ),
      ...lineList(
        sections.availability_conflict.map(
          (row) =>
            `${row.tag === "alert" ? "Alert" : "Note"}: ${name(row.title.name)} (${getMachinePresenceLabel(row.machine.presenceStatus)})`
        ),
        cap
      )
    );
  }

  lines.push(footer);
  return lines.join("\n");
}

function sectionLine(title: string, count: number): string {
  return `**${title}: ${String(count)}**`;
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
