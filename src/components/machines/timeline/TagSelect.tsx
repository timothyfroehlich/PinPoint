"use client";

import type React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import {
  RESERVED_TAGS,
  TIMELINE_TAGS,
  getTagLabel,
  type TimelineTag,
  userTagSchema,
} from "~/lib/timeline/machine-tags";
import {
  TAG_DECORATION,
  USER_TAG_DECORATION,
  isUserTag,
  tagTextColor,
} from "~/lib/timeline/user-tag-decoration";
import { cn } from "~/lib/utils";

/**
 * Canonical tag visuals for the machine timeline. Two states, one source of
 * truth, used everywhere a tag appears so they can never drift apart:
 *
 *   - "Option" state — inside a dropdown menu (filter, composer, edit form):
 *     `colored icon + colored label`, no background. Light + scannable.
 *     {@link TagOptionLabel} renders this so the filter (a DropdownMenu) and
 *     the composer/edit pickers (a Select) match.
 *   - "Applied" state — the committed tag (row badge + the picker trigger):
 *     {@link TagPill}, a tinted pill (bg + border + colored icon + label).
 *
 * Labels are always Title-case via `getTagLabel`. Icons come from
 * `TAG_DECORATION` (covers reserved + user tags).
 */

/** User-selectable tags (everything except the reserved system tags). */
export const USER_TAGS = TIMELINE_TAGS.filter(
  (t): t is Exclude<TimelineTag, (typeof RESERVED_TAGS)[number]> =>
    !(RESERVED_TAGS as readonly string[]).includes(t)
);

/**
 * "Applied" tag visual — a tinted pill. Used for the row badge and the
 * picker trigger. `size="sm"` is the row-badge scale; `size="md"` matches a
 * form control's text.
 */
export function TagPill({
  tag,
  size = "sm",
  className,
}: {
  tag: TimelineTag;
  size?: "sm" | "md";
  className?: string;
}): React.JSX.Element {
  const { Icon, badgeClass } = TAG_DECORATION[tag];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        badgeClass,
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={size === "sm" ? "size-3.5" : "size-4"}
      />
      {getTagLabel(tag)}
    </span>
  );
}

/**
 * "Option" tag visual — colored icon + colored label, no background. Shared
 * by every dropdown so the filter and the composer/edit pickers read the
 * same. The icon carries the color directly (not just the wrapping span) so
 * SelectItem's `[&_svg:not([class*='text-'])]` muted-svg rule can't strip it.
 */
export function TagOptionLabel({
  tag,
}: {
  tag: TimelineTag;
}): React.JSX.Element {
  const { Icon, badgeClass } = TAG_DECORATION[tag];
  const textColor = tagTextColor(badgeClass);
  return (
    <span className={cn("flex items-center gap-2", textColor)}>
      <Icon aria-hidden="true" className={cn("size-4", textColor)} />
      {getTagLabel(tag)}
    </span>
  );
}

interface TagSelectProps {
  value: TimelineTag | null;
  onChange: (next: TimelineTag) => void;
  disabled?: boolean;
}

/**
 * The tag picker used by both the composer and the comment edit form. The
 * trigger renders the chosen tag as a pill (via `badgeClass`); each option
 * uses {@link TagOptionLabel}. Sharing one component is what keeps "add a
 * tag" and "edit a tag" identical.
 *
 * `value === null` shows a dashed "Add tag" placeholder (composer's initial
 * state); the edit form always passes a concrete tag.
 */
export function TagSelect({
  value,
  onChange,
  disabled = false,
}: TagSelectProps): React.JSX.Element {
  const selected = value !== null && isUserTag(value) ? value : null;
  return (
    <Select
      // Always controlled (PP-ii3u #10): an empty string represents the "Add
      // tag" state. It matches no SelectItem, so Radix shows no selection while
      // our trigger renders the dashed placeholder. Conditionally spreading
      // `value` flipped the Select controlled↔uncontrolled, warning in React
      // and dropping the selection after a post reset.
      value={value ?? ""}
      disabled={disabled}
      onValueChange={(v) => {
        const parsed = userTagSchema.safeParse(v);
        if (parsed.success) onChange(parsed.data);
      }}
    >
      <SelectTrigger
        aria-label="Tag"
        className={cn(
          "h-9 w-36 justify-between gap-2 border text-sm font-medium",
          selected
            ? USER_TAG_DECORATION[selected].badgeClass
            : "border-dashed border-outline-variant text-muted-foreground"
        )}
      >
        {selected ? <TagOptionLabel tag={selected} /> : <span>Add tag</span>}
      </SelectTrigger>
      <SelectContent>
        {USER_TAGS.map((t) => (
          <SelectItem key={t} value={t}>
            <TagOptionLabel tag={t} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
