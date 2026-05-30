import {
  Award,
  CircleDot,
  Eye,
  History,
  Package,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  RESERVED_TAGS,
  type ReservedTag,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";

/**
 * Icon + badge-color decoration for user-selectable tags on comment rows.
 *
 * The keyset is `UserTag = Exclude<TimelineTag, ReservedTag>` — every tag
 * a user can pick when filing a comment. Reserved tags (`lifecycle`,
 * `issue`) never appear on a comment pill because the user comment
 * composer only offers user tags.
 *
 * Design-layer config (design bible §1 exception): the choice of lucide
 * shape and the semantic-token badge color IS the design decision. Comment
 * row code reads `USER_TAG_DECORATION[tag]` and renders; no per-call-site
 * styling.
 *
 * Color families:
 *   - warning amber → hands-on work       (maintenance, adjustment, parts)
 *   - primary green → active improvement  (upgrade)
 *   - secondary teal → care               (cleaning)
 *   - success green → notable moment      (highlight)
 *   - muted         → quiet observation   (inspection, note)
 */
export type UserTag = Exclude<TimelineTag, (typeof RESERVED_TAGS)[number]>;

export const USER_TAG_DECORATION: Record<
  UserTag,
  { Icon: LucideIcon; badgeClass: string }
> = {
  maintenance: {
    Icon: Wrench,
    badgeClass: "border-warning/40 bg-warning/15 text-warning",
  },
  adjustment: {
    Icon: SlidersHorizontal,
    badgeClass: "border-warning/40 bg-warning/15 text-warning",
  },
  parts: {
    Icon: Package,
    badgeClass: "border-warning/40 bg-warning/15 text-warning",
  },
  upgrade: {
    Icon: Wand2,
    badgeClass: "border-primary/40 bg-primary/15 text-primary",
  },
  cleaning: {
    Icon: Sparkles,
    badgeClass: "border-secondary/40 bg-secondary/15 text-secondary",
  },
  inspection: {
    Icon: Eye,
    badgeClass:
      "border-outline-variant bg-surface-variant/30 text-muted-foreground",
  },
  note: {
    Icon: StickyNote,
    badgeClass:
      "border-outline-variant bg-surface-variant/30 text-muted-foreground",
  },
  highlight: {
    Icon: Award,
    badgeClass: "border-success/40 bg-success/15 text-success",
  },
};

/**
 * Type-narrow predicate — returns true if a tag is a user-tag (and the
 * lookup into `USER_TAG_DECORATION` is safe). A row carrying a reserved
 * tag on a comment is a data-integrity bug, but rendering should still be
 * defensive.
 */
export function isUserTag(tag: TimelineTag): tag is UserTag {
  return !(RESERVED_TAGS as readonly string[]).includes(tag);
}

/**
 * Decoration for the two reserved (system-emitted) tags. They never appear
 * on the comment composer, but the timeline filter dropdown lists every
 * tag — so it needs an icon + color for these too.
 *
 *   - lifecycle → machine history (added / renamed / owner / presence)
 *   - issue     → issue activity, matches the `issue_opened` event icon
 */
const RESERVED_TAG_DECORATION: Record<
  ReservedTag,
  { Icon: LucideIcon; badgeClass: string }
> = {
  lifecycle: {
    Icon: History,
    badgeClass:
      "border-outline-variant bg-surface-variant/30 text-muted-foreground",
  },
  issue: {
    Icon: CircleDot,
    badgeClass: "border-secondary/40 bg-secondary/15 text-secondary",
  },
};

/**
 * Icon + color for EVERY tag (reserved + user). The filter dropdown renders
 * the whole tag list, so it reads from here rather than `USER_TAG_DECORATION`
 * (which intentionally omits the reserved tags).
 */
export const TAG_DECORATION: Record<
  TimelineTag,
  { Icon: LucideIcon; badgeClass: string }
> = {
  ...RESERVED_TAG_DECORATION,
  ...USER_TAG_DECORATION,
};

/** The `text-*` color class from a decoration's `badgeClass`, if any. */
export function tagTextColor(badgeClass: string): string | undefined {
  return badgeClass.split(" ").find((c) => c.startsWith("text-"));
}
