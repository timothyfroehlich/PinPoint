"use client";

import type React from "react";
import { RouteTabStrip } from "~/components/layout/RouteTabStrip";
import { useListReturnHref } from "~/components/list-view/use-list-return-href";
import type { MachineStatus } from "~/lib/machines/status";

interface CollectionTabStripProps {
  /** e.g. `/c/owner/123e4567-...` */
  basePath: string;
  openIssueCount: number;
  /** Worst derived status across the collection — drives the badge color. */
  status: MachineStatus;
}

export function CollectionTabStrip({
  basePath,
  openIssueCount,
  status,
}: CollectionTabStripProps): React.JSX.Element {
  // Overview is the group's machine list: returning to it reopens its last
  // view this tab session (list-views §11.1).
  const overviewHref = useListReturnHref(basePath);
  return (
    <RouteTabStrip
      basePath={basePath}
      ariaLabel="Collection sections"
      testIdPrefix="collection-tab"
      tabs={[
        { slug: "", label: "Overview", href: overviewHref },
        {
          slug: "issues",
          label: "Issues",
          badge: { count: openIssueCount, status },
        },
        { slug: "timeline", label: "Timeline" },
      ]}
    />
  );
}
