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

interface MachineTabStripProps {
  initials: string;
  /** Open-issue count + derived status for the Maintenance tab badge. */
  maintenance: {
    openCount: number;
    status: MachineStatus;
  };
}

interface TabSpec {
  slug: string;
  label: string;
}

// URL slug is kept as `maintenance` (folder name + existing routes/tests)
// while the visible label is "Service" — shorter, matches the `needs_service`
// status vocabulary used elsewhere in the app.
const TABS: readonly TabSpec[] = [
  { slug: "", label: "Info" },
  { slug: "maintenance", label: "Service" },
  { slug: "timeline", label: "Timeline" },
] as const;

export function MachineTabStrip({
  initials,
  maintenance,
}: MachineTabStripProps): React.JSX.Element {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const base = `/m/${initials}`;

  // Return the matching slug only when the path matches a tab exactly —
  // sub-routes like `/m/[initials]/i/[issueNumber]` should highlight no tab
  // (don't misleadingly mark Info active when the user is reading an issue).
  const activeSlug = ((): string | null => {
    if (pathname === base) return "";
    if (!pathname.startsWith(`${base}/`)) return null;
    const rest = pathname.slice(base.length + 1);
    const first = rest.split("/")[0] ?? "";
    return TABS.some((t) => t.slug !== "" && t.slug === first) ? first : null;
  })();

  // Track whether more tab content exists to the right of the visible scroll
  // window. We listen to scroll + ResizeObserver so the fade reflects both
  // viewport changes and user scroll. With only two tabs this evaluates to
  // false on every realistic viewport, so the gradient stays hidden.
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
      aria-label="Machine sections"
    >
      <div ref={scrollerRef} className="flex overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const isActive = tab.slug === activeSlug;
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const showBadge =
            tab.slug === "maintenance" && maintenance.openCount > 0;
          return (
            <Link
              key={tab.slug || "info"}
              href={href}
              ref={isActive ? activeTabRef : undefined}
              aria-current={isActive ? "page" : undefined}
              data-testid={`machine-tab-${tab.slug || "info"}`}
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
                    getMachineStatusStyles(maintenance.status)
                  )}
                  title={`${String(maintenance.openCount)} open — ${getMachineStatusLabel(maintenance.status)}`}
                  aria-label={`${String(maintenance.openCount)} open issues, status ${getMachineStatusLabel(maintenance.status)}`}
                >
                  {maintenance.openCount}
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
