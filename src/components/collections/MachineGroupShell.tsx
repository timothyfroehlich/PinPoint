import type React from "react";
import { PageContainer } from "~/components/layout/PageContainer";
import { CollectionHeader } from "~/components/collections/CollectionHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
import type { CollectionMachine } from "~/lib/collections/owner";
import { summarizeCollection } from "~/lib/collections/summary";
import { getMachineViewHealth } from "~/lib/machines/view/queries";
import { db } from "~/server/db";

interface MachineGroupShellProps {
  title: string;
  /** Small line above the title, e.g. a tag's type linking to the tag browse. */
  eyebrow?: React.ReactNode;
  machines: CollectionMachine[];
  /** Route prefix the tabs hang off, e.g. `/c/owner/<id>`. */
  basePath: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The header and Overview / Issues / Timeline tab strip shared by every
 * machine group page: Collections, Owner Collections, and tags
 * (spec collections-and-tags 4.1–4.2).
 */
export async function MachineGroupShell({
  title,
  eyebrow,
  machines,
  basePath,
  action,
  children,
}: MachineGroupShellProps): Promise<React.JSX.Element> {
  const health = await getMachineViewHealth(
    db,
    machines.map((machine) => machine.initials)
  );
  const summary = summarizeCollection(machines, health);
  const worstStatus =
    summary.unplayable > 0
      ? "unplayable"
      : summary.needsService > 0
        ? "needs_service"
        : "operational";

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <CollectionHeader
          title={title}
          eyebrow={eyebrow}
          summary={summary}
          action={action}
        />
        <CollectionTabStrip
          basePath={basePath}
          openIssueCount={summary.openIssues}
          status={worstStatus}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}
