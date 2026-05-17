import { z } from "zod";

export const TIMELINE_TAGS = [
  "lifecycle",
  "issue",
  "maintenance",
  "event",
  "cleaning",
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
  event: "Event",
  cleaning: "Cleaning",
};

export function getTagLabel(tag: TimelineTag): string {
  return TAG_LABELS[tag];
}
