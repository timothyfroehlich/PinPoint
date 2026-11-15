"use client";

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import { formatCompactAgeAgo, formatSpokenAgeAgo } from "~/lib/dates";
import { cn } from "~/lib/utils";

/*
 * The parts both List Hosts' rows draw the same way (issues-list §3,
 * machine-views §5.9): the leading dot, the initials avatar, and an age with
 * its icon.
 */

/**
 * A dot's shape, so color is never the only cue (issues-list §3.8,
 * machine-views §5.11): a ring, a filled circle, or a diamond. Issue status
 * groups and Playability map their values onto the same three.
 */
export type ListRowDotShape = "ring" | "filled" | "diamond";

const DOT_SHAPES: Record<ListRowDotShape, string> = {
  ring: "size-2.5 rounded-full border-2 border-current",
  filled: "size-2.5 rounded-full bg-current",
  diamond: "size-1.75 rotate-45 rounded-[1px] bg-current",
};

/**
 * A row's leading dot: an image named `label`, drawn in `colorClass` (a text
 * color). Every shape sits in the same 10px box.
 */
export function ListRowDot({
  shape,
  colorClass,
  label,
  testId,
}: {
  shape: ListRowDotShape;
  colorClass: string;
  label: string;
  testId?: string | undefined;
}): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-2.5 shrink-0 items-center justify-center",
        colorClass
      )}
      data-testid={testId}
    >
      <span aria-hidden="true" className={DOT_SHAPES[shape]} />
    </span>
  );
}

/**
 * A display name's initials: "Priya Shah" → "PS", "Priya" → "P". A name
 * that is a single word of two or three capitals is already initials, so it
 * shows whole: "APC" → "APC".
 */
export function nameInitials(name: string): string {
  const trimmed = name.trim();
  if (/^[A-Z]{2,3}$/.test(trimmed)) return trimmed;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * A person's initials in a 20px circle, or an empty dashed circle when there
 * is nobody (issues-list §3.7, machine-views §5.9). The image is named
 * `label`. Names only, never email addresses (CORE-SEC-007).
 */
export function InitialsAvatar({
  name,
  label,
  testId,
}: {
  name: string | null;
  label: string;
  testId?: string | undefined;
}): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-bold",
        name === null
          ? "border border-dashed border-muted-foreground/60"
          : "bg-outline text-foreground"
      )}
      data-testid={testId}
    >
      {name === null ? null : nameInitials(name)}
    </span>
  );
}

/**
 * The short age a row shows, such as "2d ago"; empty until the shared
 * ticker's first tick, and during SSR. Rows key their line 2 measurement on
 * it.
 */
export function useRowAgeText(date: Date | string | null): string {
  const now = useRelativeNow();
  if (date === null || now === null) return "";
  return formatCompactAgeAgo(date, now);
}

/**
 * An age, with its icon when it has one: "2d ago" at every width, or with a
 * `prefix`, such as "added 2d ago". Screen readers hear it spelled out, as
 * `spoken("2 days ago")`. With no date it shows `empty`, such as a machine
 * that was never serviced.
 */
export function RowAge({
  date,
  icon: Icon,
  prefix,
  spoken,
  empty,
  testId,
}: {
  date: Date | string | null;
  icon?: LucideIcon | undefined;
  /** Words before the short age, such as "added". */
  prefix?: string | undefined;
  /** The spoken words from the spelled-out age, such as "Updated 2 days ago". */
  spoken: (age: string) => string;
  /** What shows, and what screen readers hear, with no date. */
  empty?: { short: string; spoken: string } | undefined;
  testId?: string | undefined;
}): React.JSX.Element {
  // Null during SSR and before the shared ticker's first tick.
  const now = useRelativeNow();
  const shown = useRowAgeText(date);
  const body = (
    <>
      {Icon === undefined ? null : (
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span aria-hidden="true">
        {date === null
          ? empty?.short
          : prefix === undefined || shown === ""
            ? shown
            : `${prefix} ${shown}`}
      </span>
      <span className="sr-only">
        {date === null
          ? empty?.spoken
          : now === null
            ? ""
            : spoken(formatSpokenAgeAgo(date, now))}
      </span>
    </>
  );
  if (date === null) {
    return (
      <span className="inline-flex items-center gap-1" data-testid={testId}>
        {body}
      </span>
    );
  }
  return (
    <time
      dateTime={new Date(date).toISOString()}
      className="inline-flex items-center gap-1"
      data-testid={testId}
    >
      {body}
    </time>
  );
}
