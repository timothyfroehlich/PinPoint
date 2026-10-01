import type React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IssueCard, type IssueCardIssue } from "~/components/issues/IssueCard";

/** How many of the machine's other open issues the list shows (§10.5). */
export const OTHER_ISSUES_LIMIT = 5;

interface OtherIssuesProps {
  /** The newest open issues on the machine other than this one, newest first. */
  issues: IssueCardIssue[];
  machineName: string;
  machineInitials: string;
}

/**
 * The machine's other open issues (spec issue-detail §10), as the same compact
 * cards the machine page's Open Issues card uses. The heading shows on desktop
 * only; on mobile the Other issues tab names the list.
 */
export function OtherIssues({
  issues,
  machineName,
  machineInitials,
}: OtherIssuesProps): React.JSX.Element {
  const seeAllHref = `/issues?machine=${encodeURIComponent(machineInitials)}&status=all&include_inactive_machines=true`;

  return (
    <section
      aria-labelledby="other-issues-heading"
      className="space-y-3"
      data-testid="other-issues"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="other-issues-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground max-md:sr-only"
        >
          Other issues
        </h2>
        <Link
          href={seeAllHref}
          className="-my-2 ml-auto inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary transition-colors duration-150 hover:text-primary/80 md:min-h-0"
          data-testid="other-issues-see-all"
        >
          See all
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {issues.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-outline-variant px-4 py-3 text-sm text-muted-foreground"
          data-testid="other-issues-empty"
        >
          No other open issues
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              machine={{ name: machineName }}
              variant="compact"
              badgeLayout="strip"
              showMachineName={false}
              capNarrowBadges
            />
          ))}
        </div>
      )}
    </section>
  );
}
