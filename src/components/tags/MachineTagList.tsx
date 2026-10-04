"use client";

import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import { chipsThatFit } from "~/components/tags/chip-fit";
import { cn } from "~/lib/utils";

interface MachineTagListProps {
  /** Every tag the machine belongs to, automatic first (spec 7.4, 11.14). */
  tags: { name: string; href: string }[];
}

const COMPACT_CHIP =
  "inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-[18px]";
const CHIP_COLORS =
  "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80";
const MORE_CHIP = "bg-muted font-semibold text-foreground hover:bg-muted/80";

/**
 * The machine Info tab's tag links. Desktop wraps them. Below `md` they sit
 * on one line as smaller chips, and the ones that do not fit collapse into a
 * final "+N" chip that shows the rest (approved design, PP-wqit.3).
 *
 * Which chips fit depends on their rendered widths, which CSS cannot count,
 * so an invisible copy of the line is measured. This measures the element,
 * not the viewport: the breakpoint itself stays in CSS (design bible §4).
 */
export function MachineTagList({
  tags,
}: MachineTagListProps): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // Null until measured: every chip renders, so nothing is lost without JS.
  const [fit, setFit] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const measure = measureRef.current;
    if (!list || !measure) return;
    function update(): void {
      if (!list || !measure) return;
      const available = list.clientWidth;
      if (available === 0) return;
      const chips = [...measure.querySelectorAll("[data-chip]")];
      const more = measure.querySelector("[data-more]");
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
      setFit(
        chipsThatFit(
          chips.map((chip) => chip.getBoundingClientRect().width),
          more?.getBoundingClientRect().width ?? 0,
          gap,
          available
        )
      );
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    // Chip widths change once the web font loads.
    if ("fonts" in document) void document.fonts.ready.then(update);
    return () => observer.disconnect();
  }, [tags]);

  // Opening the rest moves focus to the first chip it revealed.
  useEffect(() => {
    if (focusIndex === null) return;
    linkRefs.current[focusIndex]?.focus();
    setFocusIndex(null);
  }, [focusIndex]);

  const visible = expanded || fit === null ? tags.length : fit;
  const hidden = tags.length - visible;

  return (
    <div className="relative">
      <ul
        ref={listRef}
        className={cn(
          "flex gap-1.5 md:flex-wrap md:gap-2",
          expanded
            ? "flex-wrap"
            : "overflow-hidden py-0.5 md:overflow-visible md:py-0"
        )}
      >
        {tags.map((tag, index) => (
          <li
            key={tag.href}
            className={cn(
              index === 0 ? "min-w-0" : "shrink-0",
              index >= visible && "max-md:hidden"
            )}
          >
            <Link
              ref={(element) => {
                linkRefs.current[index] = element;
              }}
              href={tag.href}
              className={cn(
                COMPACT_CHIP,
                CHIP_COLORS,
                "md:px-3 md:py-1 md:text-sm md:leading-5"
              )}
            >
              <span className="min-w-0 truncate">{tag.name}</span>
            </Link>
          </li>
        ))}
        {hidden > 0 ? (
          <li className="shrink-0 md:hidden">
            <button
              type="button"
              aria-label={`Show ${String(hidden)} more ${hidden === 1 ? "tag" : "tags"}`}
              onClick={() => {
                setExpanded(true);
                setFocusIndex(visible);
              }}
              className={cn(COMPACT_CHIP, MORE_CHIP)}
            >
              +{hidden}
            </button>
          </li>
        ) : null}
      </ul>
      {/* The measuring copy: every chip at its natural width, plus the widest
          "+N" chip. Invisible and out of the accessibility tree. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-1.5"
      >
        {tags.map((tag) => (
          <span key={tag.href} data-chip className={COMPACT_CHIP}>
            {tag.name}
          </span>
        ))}
        <span data-more className={cn(COMPACT_CHIP, "font-semibold")}>
          +{tags.length}
        </span>
      </div>
    </div>
  );
}
