"use client";

import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import {
  getMachineStatusLabel,
  getMachineStatusStyles,
  type MachineStatus,
} from "~/lib/machines/status";
import {
  planTabLayout,
  type TabLayoutPlan,
} from "~/components/layout/route-tab-strip-layout";

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
 * future collection sources like `/c/tag/[slug]`). Owns the adaptive overflow
 * menu; callers supply only their tab list + badge config.
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
  const containerRef = useRef<HTMLElement>(null);
  const measurementLaneRef = useRef<HTMLDivElement>(null);
  const triggerMeasurementRef = useRef<HTMLSpanElement>(null);
  const [layout, setLayout] = useState<TabLayoutPlan>(() => ({
    visibleIndices: tabs.map((_, index) => index),
    overflowIndices: [],
    activeClipped: false,
  }));
  const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState(false);

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
  const activeIndex = tabs.findIndex((tab) => tab.slug === activeSlug);
  const normalizedActiveIndex = activeIndex === -1 ? null : activeIndex;

  // CSS owns the row's presentation. Component-local observation is used only
  // to derive semantic menu membership, which CSS cannot expose to React (see
  // CORE-RESP-002). Observing the measured children also catches font, badge,
  // and localization changes without consulting the viewport.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const lane = measurementLaneRef.current;
    const trigger = triggerMeasurementRef.current;
    if (!container || !lane || !trigger) return;

    const measuredTabs = Array.from(
      lane.querySelectorAll<HTMLElement>("[data-tab-measure]")
    );
    if (measuredTabs.length !== tabs.length) return;

    const measure = (): void => {
      const nextLayout = planTabLayout({
        availableWidth: container.getBoundingClientRect().width,
        tabWidths: measuredTabs.map(
          (element) => element.getBoundingClientRect().width
        ),
        overflowTriggerWidth: trigger.getBoundingClientRect().width,
        activeIndex: normalizedActiveIndex,
      });
      setLayout((current) =>
        layoutsMatch(current, nextLayout) ? current : nextLayout
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(trigger);
    for (const measuredTab of measuredTabs) observer.observe(measuredTab);

    return () => {
      observer.disconnect();
    };
  }, [normalizedActiveIndex, tabs]);

  const hasOverflow = layout.overflowIndices.length > 0;
  const activeTab =
    normalizedActiveIndex === null ? undefined : tabs[normalizedActiveIndex];
  const moreLabel =
    layout.activeClipped && activeTab
      ? `More ${ariaLabel.toLowerCase()}, current section: ${activeTab.label}`
      : `More ${ariaLabel.toLowerCase()}`;

  useEffect(() => {
    if (!hasOverflow) setIsOverflowMenuOpen(false);
  }, [hasOverflow]);

  // The Manage form's unsaved-navigation guard runs on document capture and
  // intentionally stops propagation for an intercepted link. That prevents
  // Radix from receiving the click it normally uses to close this menu. A
  // document-capture listener on the same target is not stopped by
  // stopPropagation(), so close our controlled menu before the discard dialog
  // can supersede it.
  useEffect(() => {
    if (!isOverflowMenuOpen) return;

    const closeForOverflowNavigation = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-route-tab-overflow-item]")) {
        setIsOverflowMenuOpen(false);
      }
    };

    document.addEventListener("click", closeForOverflowNavigation, true);
    return () => {
      document.removeEventListener("click", closeForOverflowNavigation, true);
    };
  }, [isOverflowMenuOpen]);

  return (
    <nav
      ref={containerRef}
      className="relative min-h-12 border-b border-outline-variant"
      aria-label={ariaLabel}
      data-testid={`${testIdPrefix}-strip`}
    >
      <div className="flex min-w-0 overflow-hidden">
        {layout.visibleIndices.map((index) => {
          const tab = tabs[index];
          if (!tab) return null;
          const isActive = tab.slug === activeSlug;
          const key = getTabKey(tab);
          return (
            <Link
              key={key}
              href={getTabHref(basePath, tab)}
              aria-current={isActive ? "page" : undefined}
              data-testid={`${testIdPrefix}-${key}`}
              className={cn(
                tabControlClasses,
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary",
                layout.activeClipped &&
                  isActive &&
                  "min-w-0 max-w-full flex-1 shrink overflow-hidden"
              )}
            >
              <TabContent tab={tab} truncate={layout.activeClipped} />
            </Link>
          );
        })}
      </div>

      {hasOverflow && (
        <DropdownMenu
          open={isOverflowMenuOpen}
          onOpenChange={setIsOverflowMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-label={moreLabel}
              data-testid={`${testIdPrefix}-more`}
              className={cn(
                overflowTriggerClasses,
                layout.activeClipped
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              )}
            >
              <span aria-hidden="true">…</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {layout.overflowIndices.map((index) => {
              const tab = tabs[index];
              if (!tab) return null;
              const isActive = tab.slug === activeSlug;
              const key = getTabKey(tab);
              return (
                <DropdownMenuItem key={key} asChild>
                  <Link
                    href={getTabHref(basePath, tab)}
                    aria-current={isActive ? "page" : undefined}
                    data-route-tab-overflow-item=""
                    data-testid={`${testIdPrefix}-overflow-${key}`}
                    className="cursor-pointer"
                  >
                    <TabContent tab={tab} />
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Exact rendered widths without duplicate links or controls in the
          accessibility tree. Clipping prevents this intrinsic-width lane from
          contributing to page overflow. */}
      <div
        ref={measurementLaneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        {tabs.map((tab) => (
          <span
            key={getTabKey(tab)}
            data-tab-measure=""
            className={cn("absolute w-max", tabControlClasses)}
          >
            <TabContent tab={tab} />
          </span>
        ))}
        <span
          ref={triggerMeasurementRef}
          data-overflow-trigger-measure=""
          className={buttonVariants({
            variant: "ghost",
            className: cn("absolute w-max", overflowTriggerMeasurementClasses),
          })}
        >
          …
        </span>
      </div>
    </nav>
  );
}

const tabControlClasses =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors motion-reduce:transition-none";

const overflowTriggerMeasurementClasses =
  "h-full min-w-11 rounded-none border-b-2 px-4 py-3 text-lg leading-none motion-reduce:transition-none";

const overflowTriggerClasses = cn(
  overflowTriggerMeasurementClasses,
  "absolute inset-y-0 right-0 z-10 bg-background"
);

function getTabKey(tab: RouteTab): string {
  // Index tabs key off labels so test ids stay stable per strip ("info",
  // "overview"); route tabs key off their slugs.
  return tab.slug || tab.label.toLowerCase();
}

function getTabHref(basePath: string, tab: RouteTab): string {
  return tab.slug ? `${basePath}/${tab.slug}` : basePath;
}

function TabContent({
  tab,
  truncate = false,
}: {
  tab: RouteTab;
  truncate?: boolean;
}): React.JSX.Element {
  const badge = tab.badge && tab.badge.count > 0 ? tab.badge : undefined;
  return (
    <>
      <span className={cn(truncate && "min-w-0 truncate")}>{tab.label}</span>
      {badge && (
        <span
          className={cn(
            "shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            getMachineStatusStyles(badge.status)
          )}
          aria-label={`${String(badge.count)} open issues, status ${getMachineStatusLabel(badge.status)}`}
        >
          {badge.count}
        </span>
      )}
    </>
  );
}

function layoutsMatch(left: TabLayoutPlan, right: TabLayoutPlan): boolean {
  return (
    left.activeClipped === right.activeClipped &&
    indicesMatch(left.visibleIndices, right.visibleIndices) &&
    indicesMatch(left.overflowIndices, right.overflowIndices)
  );
}

function indicesMatch(
  left: readonly number[],
  right: readonly number[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
