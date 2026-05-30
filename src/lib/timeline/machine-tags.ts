import { z } from "zod";

/**
 * Tag enum for `timeline_events.tag`.
 *
 * Ordered by family so the dropdown reads coherently:
 *   - Reserved (system-emitted): lifecycle, issue
 *   - Hands-on work:             maintenance, adjustment, parts, upgrade
 *   - Care:                      cleaning
 *   - Observation:               inspection, note
 *   - Notable moment:            highlight
 *
 * `event` was retired in the PP-0x98 V2 design pass — too generic. Old
 * rows with `tag = 'event'` are silently dropped at the page read boundary
 * (validated against this enum via `tagSchema`).
 */
export const TIMELINE_TAGS = [
  "lifecycle",
  "issue",
  "maintenance",
  "adjustment",
  "parts",
  "upgrade",
  "cleaning",
  "inspection",
  "note",
  "highlight",
] as const;

export type TimelineTag = (typeof TIMELINE_TAGS)[number];

export const RESERVED_TAGS = [
  "lifecycle",
  "issue",
] as const satisfies readonly TimelineTag[];

export type ReservedTag = (typeof RESERVED_TAGS)[number];

export const tagSchema = z.enum(TIMELINE_TAGS);

export const userTagSchema = z
  .enum(TIMELINE_TAGS)
  .refine(
    (tag): tag is Exclude<TimelineTag, ReservedTag> =>
      !(RESERVED_TAGS as readonly string[]).includes(tag),
    { message: "Reserved tags cannot be applied to user comments" }
  );

const TAG_LABELS: Record<TimelineTag, string> = {
  lifecycle: "Lifecycle",
  issue: "Issue",
  maintenance: "Maintenance",
  adjustment: "Adjustment",
  parts: "Parts",
  upgrade: "Upgrade",
  cleaning: "Cleaning",
  inspection: "Inspection",
  note: "Note",
  highlight: "Highlight",
};

export function getTagLabel(tag: TimelineTag): string {
  return TAG_LABELS[tag];
}
