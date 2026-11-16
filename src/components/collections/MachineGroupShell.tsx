import type React from "react";
import { PageContainer } from "~/components/layout/PageContainer";
import type { Crumb } from "~/components/collections/GroupBreadcrumb";
import { GroupPageHeader } from "~/components/collections/GroupPageHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
import type { CollectionMachine } from "~/lib/collections/types";
import { summarizeCollection } from "~/lib/collections/summary";
import { getMachineViewHealth } from "~/lib/machines/view/queries";
import { db } from "~/server/db";

interface MachineGroupShellProps {
  title: string;
  /** Where the group lives (spec collections-and-tags 4.8); empty for none. */
  breadcrumb: readonly Crumb[];
  machines: CollectionMachine[];
  /** Route prefix the tabs hang off, e.g. `/c/<id>`. */
  basePath: string;
  /** The page actions, at the right end of the tab row (4.10). */
  actions?: React.ReactNode;
  /**
   * A Collection's description, shown in the header on every tab. Only a
   * Collection passes one (4.7).
   */
  description?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The header and Overview / Issues / Timeline tab row shared by every
 * machine group page: Collections and tags (spec collections-and-tags
 * 4.1–4.13). Below 390px the space above the title and below the tabs
 * tightens from 12px to 4px (4.13, list-views §8.23), and the header sits
 * directly on the tabs.
 */
export async function MachineGroupShell({
  title,
  breadcrumb,
  machines,
  basePath,
  actions,
  description,
  children,
}: MachineGroupShellProps): Promise<React.JSX.Element> {
  const health = await getMachineViewHealth(
    db,
    machines.map((machine) => machine.initials)
  );
  // The header shows no counts (4.2); the Issues tab carries the open-issue
  // count, colored by the group's worst status.
  const summary = summarizeCollection(machines, health);
  const worstStatus =
    summary.unplayable > 0
      ? "unplayable"
      : summary.needsService > 0
        ? "needs_service"
        : "operational";

  return (
    // The two phone ranges don't overlap, so neither depends on CSS order.
    <PageContainer
      size="standard"
      className="max-[390px]:pt-1 min-[390px]:max-md:pt-3"
    >
      <div>
        <GroupPageHeader
          title={title}
          breadcrumb={breadcrumb}
          description={description}
        />
        <CollectionTabStrip
          basePath={basePath}
          openIssueCount={summary.openIssues}
          status={worstStatus}
          actions={actions}
          className="mt-2 max-[390px]:mt-0 md:mt-3"
        />
        <div className="mt-3 max-[390px]:mt-1">{children}</div>
      </div>
    </PageContainer>
  );
}
