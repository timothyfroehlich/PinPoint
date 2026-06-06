"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import {
  getMachineStatusLabel,
  getMachineStatusStyles,
  type MachineStatus,
} from "~/lib/machines/status";

interface CollectionTabStripProps {
  /** e.g. `/c/owner/123e4567-...` */
  basePath: string;
  openIssueCount: number;
  /** Worst derived status across the collection — drives the badge color. */
  status: MachineStatus;
}

interface TabSpec {
  slug: string;
  label: string;
}

const TABS: readonly TabSpec[] = [
  { slug: "", label: "Overview" },
  { slug: "issues", label: "Issues" },
  { slug: "timeline", label: "Timeline" },
] as const;

export function CollectionTabStrip({
  basePath,
  openIssueCount,
  status,
}: CollectionTabStripProps): React.JSX.Element {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Return the matching slug only when the path matches a tab exactly —
  // future sub-routes under the collection should highlight no tab.
  const activeSlug = ((): string | null => {
    if (pathname === basePath) return "";
    if (!pathname.startsWith(`${basePath}/`)) return null;
    const rest = pathname.slice(basePath.length + 1);
    const first = rest.split("/")[0] ?? "";
    return TABS.some((t) => t.slug !== "" && t.slug === first) ? first : null;
  })();

  // Track whether more tab content exists to the right of the visible scroll
  // window. We listen to scroll + ResizeObserver so the fade reflects both
  // viewport changes and user scroll.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const update = (): void => {
      const overflow =
        scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft;
      setCanScrollRight(overflow > 1);
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  // Center the active tab on mount if the strip overflows. CSS handles the
  // visual layout — JS is only used to nudge scroll position on entry so the
  // active tab isn't hidden off-screen on a deep-link.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeTabRef.current;
    if (!scroller || !active) return;
    if (scroller.scrollWidth <= scroller.clientWidth) return;
    active.scrollIntoView({
      behavior: "auto",
      inline: "center",
      block: "nearest",
    });
  }, [activeSlug]);

  return (
    // Route-driven navigation, not a stateful tabs widget. Per design bible
    // §5 ("No shadcn `<Tabs>`") and the WAI-ARIA Tabs pattern's prerequisites
    // (roving tabindex, aria-controls, panel relationships, keyboard handling)
    // — use `<nav>` + `aria-current="page"` for the active route instead.
    <nav
      className="relative border-b border-outline-variant"
      aria-label="Collection sections"
    >
      <div ref={scrollerRef} className="flex overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const isActive = tab.slug === activeSlug;
          const href = tab.slug ? `${basePath}/${tab.slug}` : basePath;
          const showBadge = tab.slug === "issues" && openIssueCount > 0;
          return (
            <Link
              key={tab.slug || "overview"}
              href={href}
              ref={isActive ? activeTabRef : undefined}
              aria-current={isActive ? "page" : undefined}
              data-testid={`collection-tab-${tab.slug || "overview"}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              )}
            >
              {tab.label}
              {showBadge && (
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    getMachineStatusStyles(status)
                  )}
                  title={`${String(openIssueCount)} open — ${getMachineStatusLabel(status)}`}
                  aria-label={`${String(openIssueCount)} open issues, status ${getMachineStatusLabel(status)}`}
                >
                  {openIssueCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Right-edge fade — rendered only when the strip can scroll further
          right. The gradient sits above the scroller; pointer-events:none
          lets clicks pass through to tabs beneath. */}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent"
        />
      )}
    </nav>
  );
}
