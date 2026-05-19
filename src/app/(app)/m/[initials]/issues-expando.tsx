import type React from "react";
import { ExportButton } from "~/components/issues/ExportButton";
import { IssueCard, type IssueCardIssue } from "~/components/issues/IssueCard";
import { MachineEmptyState } from "~/components/machines/MachineEmptyState";

interface IssuesExpandoProps {
  /** Issues to display. Caller is responsible for any filtering — the
   *  Service tab currently passes open-only (to match the tab badge); a
   *  richer filter bar (bead PP-0kta) will let callers pass other subsets. */
  issues: IssueCardIssue[];
  machineName: string;
  machineInitials: string;
  watchButton?: React.ReactNode;
}

/**
 * IssuesExpando — issues section on the Maintenance tab.
 *
 * The expando wrapper was removed (YAGNI while this is the only section on
 * the tab). When the Timeline section lands as a sibling, this file will
 * likely become an AccordionItem inside an Accordion. The component name and
 * file name are kept for now to minimize churn during design iteration.
 */
export function IssuesExpando({
  issues,
  machineName,
  machineInitials,
  watchButton,
}: IssuesExpandoProps): React.JSX.Element {
  return (
    <section
      className="border-b border-outline-variant pb-4"
      data-testid="issues-section"
    >
      <div className="flex items-center justify-between gap-2 py-3">
        <h2 className="text-lg font-semibold text-foreground">
          Issues ({issues.length})
        </h2>
        <div className="flex items-center gap-2">
          {watchButton}
          <ExportButton machineInitials={machineInitials} />
        </div>
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
