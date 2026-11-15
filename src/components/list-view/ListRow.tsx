"use client";

import * as React from "react";
import Link from "next/link";
import { useMeasuredWidths } from "~/components/list-view/use-measured-widths";
import { fitLineParts, type LineFitPart } from "~/lib/list-view/overflow";
import { cn } from "~/lib/utils";

/*
 * The two-line row both List Hosts use at every width (issues-list §3,
 * machine-views §5.3, §5.9). It owns the layout every row shares, so spacing,
 * alignment, and the fit of line 2 cannot drift between the lists: the dot
 * column, line 1, line 2 and its measurement, the whole-row link, and the
 * row's padding and divider. Each host's row file supplies the content.
 *
 * Stacking: the row is its own stacking context (`isolate`). The title link's
 * `::after` overlay covers the row on layer 0 and makes the whole row the
 * link. A link or control inside the row draws above it with
 * `LIST_ROW_RAISED`; a link's enlarged hit area may sit on layer 1, beneath
 * every raised visible text.
 */

/** Raises a link's or control's visible box above the row link's overlay. */
export const LIST_ROW_RAISED = "relative z-[2]";

/** The gap between line 2's leading parts and separators (`gap-1.5`). */
const LEADING_GAP = 6;
/** The gap between line 2's trailing parts (`gap-2`). */
const TRAILING_GAP = 8;
/** The least room between line 2's groups (`pl-3`). */
const GROUP_GAP = 12;
/** The measurement key of the "·" separator. */
const SEPARATOR_KEY = "·";

/**
 * The rows' list. Desktop draws a line between rows inside the list's box;
 * phones draw one under every row (list-views §7.7).
 */
export function ListRows({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ul aria-label={label} className="md:divide-y md:divide-border">
      {children}
    </ul>
  );
}

export interface ListRowProps {
  /** The leading dot (`ListRowDot`), in a 10px column 10px from the content. */
  dot?: React.ReactNode;
  /** Line 1: the title (a `ListRowTitleLink`) and what follows it. */
  title: React.ReactNode;
  /** Line 1's right-side slot, which never shrinks. */
  titleEnd?: React.ReactNode;
  /** Line 2 (`ListRowDetails`). */
  details: React.ReactNode;
  /** A control at the row's end, raised above the row link. */
  action?: React.ReactNode;
  testId?: string | undefined;
  /** Data attributes for the row, such as `data-issue-id`. */
  data?: Readonly<Record<`data-${string}`, string>> | undefined;
}

/**
 * One row: the dot in its own column, then line 1 and line 2 sharing the
 * content column beside it, so line 2 lines up under the title.
 */
export function ListRow({
  dot,
  title,
  titleEnd,
  details,
  action,
  testId,
  data,
}: ListRowProps): React.JSX.Element {
  return (
    <li
      data-testid={testId}
      {...data}
      className="group/row relative isolate px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none max-md:border-b max-md:border-border sm:max-md:px-8"
    >
      <div className="flex items-start gap-2.5">
        {/* Centered on line 1's first line: (22px - 10px) / 2. An empty
            column keeps line 2's indent when a row has no dot. */}
        <span className="mt-1.5 flex size-2.5 shrink-0">{dot}</span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2 text-[15px] leading-[22px]">
            <div className="min-w-0 flex-1">{title}</div>
            {titleEnd === undefined ? null : (
              <div className="shrink-0">{titleEnd}</div>
            )}
          </div>
          {details}
        </div>
        {action === undefined ? null : (
          <div className={cn(LIST_ROW_RAISED, "shrink-0 self-center")}>
            {action}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The row's title link. Its `::after` overlay makes the whole row the link
 * (the row is its containing block); its text draws above any enlarged hit
 * area on line 2.
 */
export function ListRowTitleLink({
  href,
  onClick,
  title,
  truncate = false,
  className,
  testId,
  children,
}: {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement> | undefined;
  /** A tooltip, for a title that truncates. */
  title?: string | undefined;
  /** Truncate to one line instead of wrapping. */
  truncate?: boolean;
  className?: string | undefined;
  testId?: string | undefined;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      title={title}
      {...(onClick === undefined ? {} : { onClick })}
      className={cn(
        "font-semibold text-foreground transition-colors duration-150 group-hover/row:text-primary after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset motion-reduce:transition-none",
        truncate ? "block min-w-0 truncate" : "break-words",
        className
      )}
      data-testid={testId}
    >
      <span className={LIST_ROW_RAISED}>{children}</span>
    </Link>
  );
}

/** One part of line 2. */
export interface ListRowPart<Key extends string> {
  key: Key;
  /** The part as it shows on the line. */
  node: React.ReactNode;
  /**
   * The part as the hidden measurement lane draws it, at the same width;
   * defaults to `node`. A part with links or test IDs passes a plain copy,
   * so the lane never duplicates them.
   */
  measure?: React.ReactNode;
  /** Plain text: a "·" separates it from a plain-text neighbor. */
  text?: boolean;
  /** A part that never drops and shrinks, truncating, when space runs out. */
  truncate?: boolean;
}

/**
 * Line 2: one line at every width, never wrapping, in two groups. The
 * leading group's plain text shares one baseline; its pills and avatars, and
 * the right-anchored trailing group, center on the line. A "·" separates two
 * plain-text parts that show side by side, and nothing else.
 *
 * When the line does not fit, the parts in `dropOrder` drop one at a time,
 * in that order; the rest never drop, and a `truncate` part truncates once
 * every droppable part is gone. Each part is measured at its full width in a
 * hidden lane and planned with `fitLineParts`. A dropped part is hidden from
 * view but stays readable to screen readers, so they hear the whole line.
 */
export function ListRowDetails<Key extends string>({
  leading,
  trailing = [],
  dropOrder,
  contentKey,
  testId,
}: {
  leading: readonly ListRowPart<Key>[];
  trailing?: readonly ListRowPart<Key>[];
  dropOrder: readonly Key[];
  /**
   * Changes whenever a part's content changes, such as an age's text, so the
   * lane is measured again without waiting on a ResizeObserver callback
   * (which a background tab may never deliver).
   */
  contentKey: string;
  testId?: string | undefined;
}): React.JSX.Element {
  const lineRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const measured = useMeasuredWidths(lineRef, laneRef, contentKey);
  const allParts = [...leading, ...trailing];
  const toFit = (parts: readonly ListRowPart<Key>[]): LineFitPart<Key>[] =>
    parts.map((part) => ({
      key: part.key,
      width: measured?.widths[part.key] ?? 0,
      text: part.text === true,
    }));
  // Until the line is measured everything shows, clipped to one line; the
  // first measurement lands before the browser paints.
  const shown: ReadonlySet<Key> =
    measured && measured.available > 0
      ? fitLineParts({
          available: measured.available,
          leading: toFit(leading),
          trailing: toFit(trailing),
          dropOrder,
          gap: LEADING_GAP,
          trailingGap: TRAILING_GAP,
          groupGap: GROUP_GAP,
          separatorWidth: measured.widths[SEPARATOR_KEY] ?? 0,
        })
      : new Set(allParts.map((part) => part.key));
  const trailingShows = trailing.some((part) => shown.has(part.key));

  function renderGroup(parts: readonly ListRowPart<Key>[]): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let previousText = false;
    for (const part of parts) {
      const visible = shown.has(part.key);
      if (visible && part.text === true && previousText) {
        nodes.push(
          <span key={`${part.key}-separator`} aria-hidden="true">
            ·
          </span>
        );
      }
      // A dropped part is `sr-only`: a 1px clipped box, but its contents keep
      // their full width inside it. Left at its static position in the
      // right-anchored group, that content would run past the row's right
      // edge, so `left-0` pins the box to the row's start.
      nodes.push(
        <span
          key={part.key}
          data-part={part.key}
          className={cn(
            !visible && "sr-only left-0",
            visible && (part.truncate === true ? "flex min-w-0" : "shrink-0"),
            visible && part.text !== true && "flex self-center"
          )}
        >
          {part.node}
        </span>
      );
      if (visible) previousText = part.text === true;
    }
    return nodes;
  }

  return (
    <>
      {/* Not positioned, so the row link's overlay covers it and a tap on
          line 2 opens the row; `overflow-x-clip` keeps an unplanned overflow
          (before the first measurement) inside the row without clipping a
          link's taller hit area. */}
      <div
        ref={lineRef}
        data-row-line=""
        data-testid={testId}
        className="mt-0.5 flex min-w-0 items-center overflow-x-clip text-[13px] leading-5 whitespace-nowrap text-muted-foreground"
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          {renderGroup(leading)}
        </span>
        {trailing.length === 0 ? null : (
          <span
            className={cn(
              "ml-auto flex shrink-0 items-center gap-2",
              trailingShows && "pl-3"
            )}
          >
            {renderGroup(trailing)}
          </span>
        )}
      </div>

      {/* Each part and the separator at full width, out of the accessibility
          tree and the tab order, clipped so it never widens the page. It
          anchors to the row, which is positioned. */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden text-[13px] leading-5 whitespace-nowrap"
      >
        <span data-measure={SEPARATOR_KEY} className="absolute w-max">
          ·
        </span>
        {allParts.map((part) => (
          <span
            key={part.key}
            data-measure={part.key}
            className="absolute flex w-max"
          >
            {part.measure ?? part.node}
          </span>
        ))}
      </div>
    </>
  );
}
