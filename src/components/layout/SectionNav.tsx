"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export interface SectionNavItem {
  /** Fragment id of the section's anchor. */
  id: string;
  label: string;
  /** 2 indents the entry under the one before it. Default 1. */
  depth?: 1 | 2;
}

/**
 * How far down the scroll container the reading line sits. A section is "in
 * view" once its start has scrolled above this line. High enough that a jump
 * to a short section (Details is one row of fields) is not immediately
 * credited to the section after it, which lands inside the line too.
 */
const READING_LINE = 0.2;

/** The nearest scrolling ancestor — `<main>` in the app shell, else null. */
function scrollParentOf(element: Element): Element | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * The section in view: the last one whose anchor has scrolled above the
 * reading line, or the last one outright once the page is scrolled to its end
 * (a short final section never reaches the line).
 *
 * `IntersectionObserver` rather than a scroll listener (Baseline widely
 * available; `scroll-target-group` / `:target-current` would do this in CSS
 * but are Chromium-only). The observer's root is stretched far ABOVE the
 * scroll container and cut off at the reading line, so "above the line" is
 * simply "intersecting" — and a fast scroll that carries an anchor from below
 * the line to off the top in one frame still flips it, which a root limited to
 * the visible area would miss. The anchors are zero-height, so each crosses
 * the line at one instant.
 */
function useActiveSection(
  sections: readonly SectionNavItem[],
  endRef: React.RefObject<HTMLDivElement | null>
): string | null {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const idsKey = sections.map((section) => section.id).join("|");

  useEffect(() => {
    const ids = idsKey.split("|").filter((id) => id.length > 0);
    const anchors = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const end = endRef.current;
    const first = anchors[0];
    if (first === undefined || end === null) return;

    const root = scrollParentOf(first);
    const passed = new Map<string, boolean>();
    let atEnd = false;

    const recompute = (): void => {
      const scrolled = root !== null ? root.scrollTop > 0 : window.scrollY > 0;
      if (atEnd && scrolled) {
        setActive(ids[ids.length - 1] ?? null);
        return;
      }
      let current = ids[0] ?? null;
      for (const id of ids) {
        if (passed.get(id) === true) current = id;
      }
      setActive(current);
    };

    const lineObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          passed.set(entry.target.id, entry.isIntersecting);
        }
        recompute();
      },
      {
        root,
        rootMargin: `10000% 0px -${Math.round((1 - READING_LINE) * 100)}% 0px`,
      }
    );
    const endObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) atEnd = entry.isIntersecting;
        recompute();
      },
      { root }
    );
    for (const anchor of anchors) lineObserver.observe(anchor);
    endObserver.observe(end);
    return () => {
      lineObserver.disconnect();
      endObserver.disconnect();
    };
  }, [idsKey, endRef]);

  return active;
}

/**
 * The Manage tab's list of its sections (machine-editing 5.1–5.2).
 *
 * Desktop (`md:` up): an "On this page" list beside the form that stays in
 * view while the page scrolls, marks the section in view, and jumps on click.
 * Phone: one control pinned under the app header naming the section in view,
 * which opens the same list.
 *
 * Jumping is plain fragment navigation to each section's `SectionAnchor`, so
 * it needs no script and the unsaved-changes guard lets it through (same page).
 * Data-driven: the sections come from the page, in order.
 */
export function SectionNavLayout({
  sections,
  children,
}: {
  sections: readonly SectionNavItem[];
  children: React.ReactNode;
}): React.JSX.Element {
  const endRef = useRef<HTMLDivElement>(null);
  const active = useActiveSection(sections, endRef);
  const activeLabel =
    sections.find((section) => section.id === active)?.label ??
    sections[0]?.label ??
    "";

  return (
    <div className="md:flex md:items-start md:gap-10">
      <nav
        aria-label="On this page"
        data-testid="section-nav"
        className="hidden md:sticky md:top-4 md:flex md:w-44 md:shrink-0 md:flex-col md:gap-0.5 md:pt-2"
      >
        <span className="pb-2 pl-3.5 text-xs font-medium text-muted-foreground">
          On this page
        </span>
        {sections.map((section) => {
          const current = section.id === active;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={current ? "location" : undefined}
              className={cn(
                "border-l-2 px-3 py-1.5 text-sm transition-colors",
                section.depth === 2 && "pl-6",
                current
                  ? "border-primary font-semibold text-foreground"
                  : "border-outline-variant text-muted-foreground hover:text-foreground"
              )}
            >
              {section.label}
            </a>
          );
        })}
      </nav>

      {/* Pinned under the app header. The header sits outside the scrolling
          <main>, so `top-0` here IS directly under it. Bleeds to the page's
          side padding so content never shows past its edges while pinned. */}
      <nav
        aria-label="On this page"
        className="sticky top-0 z-10 -mx-4 mb-4 border-b border-outline-variant bg-background px-4 py-2 sm:-mx-8 sm:px-8 md:hidden"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="section-jump"
              className="flex h-10 w-full items-center gap-2 rounded-lg border border-outline-variant bg-card px-3 text-left text-sm text-foreground"
            >
              <span className="text-muted-foreground">Jump to</span>
              <span className="font-semibold">{activeLabel}</span>
              <ChevronDown
                aria-hidden="true"
                className="ml-auto size-4 text-muted-foreground"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width)"
          >
            {sections.map((section) => (
              <DropdownMenuItem key={section.id} asChild>
                <a
                  href={`#${section.id}`}
                  aria-current={section.id === active ? "location" : undefined}
                  className={cn(
                    section.depth === 2 && "pl-5",
                    section.id === active && "font-semibold"
                  )}
                >
                  {section.label}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* `relative` is load-bearing: the section anchors are absolutely
          positioned, and without a positioned ancestor inside the scrolling
          <main> their containing block is the viewport — they would neither
          scroll with the page nor ever cross the reading line. */}
      <div className="relative min-w-0 max-w-4xl flex-1">
        {children}
        <div ref={endRef} aria-hidden="true" className="h-px" />
      </div>
    </div>
  );
}
