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

export interface RouteTab {
  /** URL slug appended to `basePath`; "" is the index tab. */
  slug: string;
  label: string;
  /**
   * Optional count badge (e.g. open issues). The badge is hidden when
   * `count` is 0, so callers can pass it unconditionally.
   */
  badge?: { count: number; status: MachineStatus };
}

interface RouteTabStripProps {
  /** Route prefix the tabs hang off, e.g. `/m/GZ` or `/c/owner/<id>`. */
  basePath: string;
  tabs: readonly RouteTab[];
  /** Accessible name for the `<nav>` landmark. */
  ariaLabel: string;
  /** `data-testid` prefix, e.g. "machine-tab" → "machine-tab-info". */
  testIdPrefix: string;
}

/**
 * Route-driven tab strip shared by the per-machine and collection pages (and
 * future collection sources like `/c/tag/[slug]`). Owns the horizontal
 * overflow-scroll, the right-edge fade, and active-tab centering; callers
 * supply only their tab list + badge config.
 *
 * Route-driven navigation, not a stateful tabs widget. Per design bible §5
 * ("No shadcn `<Tabs>`") and the WAI-ARIA Tabs pattern's prerequisites (roving
 * tabindex, aria-controls, panel relationships, keyboard handling) — use
 * `<nav>` + `aria-current="page"` for the active route instead.
 */
export function RouteTabStrip({
  basePath,
  tabs,
  ariaLabel,
  testIdPrefix,
}: RouteTabStripProps): React.JSX.Element {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Return the matching slug only when the path matches a tab exactly —
  // sub-routes (e.g. `/m/[initials]/i/[issueNumber]`) should highlight no tab
  // (don't misleadingly mark the index tab active when reading a sub-route).
  const activeSlug = ((): string | null => {
    if (pathname === basePath) return "";
    if (!pathname.startsWith(`${basePath}/`)) return null;
    const rest = pathname.slice(basePath.length + 1);
    const first = rest.split("/")[0] ?? "";
    return tabs.some((t) => t.slug !== "" && t.slug === first) ? first : null;
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
    <nav
      className="relative border-b border-outline-variant"
      aria-label={ariaLabel}
    >
      <div ref={scrollerRef} className="flex overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.slug === activeSlug;
          const href = tab.slug ? `${basePath}/${tab.slug}` : basePath;
          // Index tab (slug "") keys off its label so testids stay stable
          // per strip ("info", "overview"); other tabs key off their slug.
          const key = tab.slug || tab.label.toLowerCase();
          const badge =
            tab.badge && tab.badge.count > 0 ? tab.badge : undefined;
          return (
            <Link
              key={key}
              href={href}
              ref={isActive ? activeTabRef : undefined}
              aria-current={isActive ? "page" : undefined}
              data-testid={`${testIdPrefix}-${key}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              )}
            >
              {tab.label}
              {badge && (
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    getMachineStatusStyles(badge.status)
                  )}
                  title={`${String(badge.count)} open — ${getMachineStatusLabel(badge.status)}`}
                  aria-label={`${String(badge.count)} open issues, status ${getMachineStatusLabel(badge.status)}`}
                >
                  {badge.count}
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
