"use client";

import type React from "react";
import { RouteTabStrip } from "~/components/layout/RouteTabStrip";
import { useListReturnHref } from "~/components/list-view/use-list-return-href";
import type { MachineStatus } from "~/lib/machines/status";
import { cn } from "~/lib/utils";

interface CollectionTabStripProps {
  /** e.g. `/c/123e4567-...` */
  basePath: string;
  openIssueCount: number;
  /** Worst derived status across the collection — drives the badge color. */
  status: MachineStatus;
  /** The page actions, at the right end of the row (collections-and-tags 4.10). */
  actions?: React.ReactNode;
  className?: string | undefined;
}

/**
 * A Machine Group page's tab row: Overview, Issues, and Timeline, then the
 * page actions at its right end (collections-and-tags 4.1, 4.10). The
 * actions take the room the tabs leave and drop their labels, then fold
 * into ⋯ (list-views §8.11, §8.12). They never give up a lone ⋯: its
 * minimum width is one icon button plus the 16px fit tolerance (§8.7,
 * FIT_TOLERANCE), so when the tabs and that ⋯ do not fit, the tabs move
 * into their own menu from the right, keeping the current tab (§8.13).
 */
export function CollectionTabStrip({
  basePath,
  openIssueCount,
  status,
  actions,
  className,
}: CollectionTabStripProps): React.JSX.Element {
  // Overview is the group's machine list and Issues its issue list:
  // returning to either reopens its last view this tab session (list-views
  // §11.1).
  const overviewHref = useListReturnHref(basePath);
  const issuesHref = useListReturnHref(`${basePath}/issues`);
  return (
    <div
      data-testid="collection-tab-row"
      className={cn(
        // On phones the row runs edge to edge, like the list box below it
        // (list-views §7.7).
        "flex items-stretch gap-2 border-b border-outline-variant max-md:-mx-4 max-md:px-1 sm:max-md:-mx-8",
        className
      )}
    >
      <RouteTabStrip
        basePath={basePath}
        ariaLabel="Collection sections"
        testIdPrefix="collection-tab"
        sharesRow
        tabs={[
          { slug: "", label: "Overview", href: overviewHref },
          {
            slug: "issues",
            label: "Issues",
            href: issuesHref,
            badge: { count: openIssueCount, status },
          },
          { slug: "timeline", label: "Timeline" },
        ]}
      />
      {actions ? (
        // One icon button (2.75rem, 2.25rem from md) plus FIT_TOLERANCE.
        <div className="flex min-w-[calc(2.75rem+16px)] flex-1 md:min-w-[calc(2.25rem+16px)]">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
