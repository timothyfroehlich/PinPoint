import type React from "react";
import { IssueCard, type IssueCardIssue } from "~/components/issues/IssueCard";
import { MachineEmptyState } from "~/components/machines/MachineEmptyState";
import { MachineIssuesMenu } from "~/components/machines/MachineIssuesMenu";

export type MachineIssuesView = "open" | "all";

interface MachineIssuesCardProps {
  /** The list to render — already filtered to the active view by the caller. */
  issues: IssueCardIssue[];
  machineName: string;
  machineInitials: string;
  /** Which view is active — drives the heading + the menu's active toggle. */
  view: MachineIssuesView;
}

/**
 * Open Issues card — the primary Service-tab surface (design §4). Defaults to
 * the **Open** view; the only control is the ⋯ menu (Open/All toggle, View-all
 * link, Export) — no inline filter bar / search / sort. Rows reuse `IssueCard`.
 */
export function MachineIssuesCard({
  issues,
  machineName,
  machineInitials,
  view,
}: MachineIssuesCardProps): React.JSX.Element {
  const heading = view === "all" ? "All Issues" : "Open Issues";

  return (
    <section
      className="rounded-xl border border-outline-variant bg-card p-4"
      data-testid="issues-section"
      aria-labelledby="machine-issues-heading"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="machine-issues-heading"
          className="text-lg font-semibold text-foreground"
        >
          {heading} ({issues.length})
        </h2>
        <MachineIssuesMenu machineInitials={machineInitials} view={view} />
      </div>

      {issues.length === 0 ? (
        <MachineEmptyState machineInitials={machineInitials} />
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              machine={{ name: machineName }}
              variant="compact"
              badgeLayout="strip"
            />
          ))}
        </div>
      )}
    </section>
  );
}
