import type React from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";

import { Button } from "~/components/ui/button";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { cn } from "~/lib/utils";
import { formatIssueId } from "~/lib/issues/utils";
import {
  SEVERITY_STYLES,
  STATUS_STYLES,
  getIssueSeverityLabel,
  getIssueStatusLabel,
} from "~/lib/issues/status";
import {
  getMachineStatusLabel,
  SEVERITY_RANK,
  type MachineStatus,
} from "~/lib/machines/status";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { IssueStatus, IssueSeverity } from "~/lib/types";

/** Minimal open-issue shape the known-issues peek renders. */
export interface HeroPeekIssue {
  id: string;
  issueNumber: number;
  title: string;
  status: IssueStatus;
  severity: IssueSeverity;
}

/** Number of open issues surfaced in the hero peek before "View all". */
const PEEK_LIMIT = 3;

/** Solid dot color per derived machine status (semantic tokens only). */
const STATUS_DOT: Record<MachineStatus, string> = {
  operational: "bg-success",
  needs_service: "bg-warning",
  unplayable: "bg-destructive",
};

/**
 * InfoHero — the QR-scanning player's whole answer on the Info tab: machine
 * health (derived status + presence), a prominent "Report a problem" button
 * routing to the report page, and a peek at the open issues with a link to the
 * Service tab for the full list. Reading-order position: directly below the
 * Description card.
 */
export function InfoHero({
  machineInitials,
  machineStatus,
  presenceStatus,
  openIssues,
  reportHref,
  serviceHref,
}: {
  machineInitials: string;
  machineStatus: MachineStatus;
  presenceStatus: MachinePresenceStatus;
  openIssues: HeroPeekIssue[];
  reportHref: string;
  serviceHref: string;
}): React.JSX.Element {
  const openCount = openIssues.length;
  // Worst severity first so the most urgent issue leads the peek.
  const peek = [...openIssues]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, PEEK_LIMIT);

  return (
    <section
      aria-label="Machine health and reporting"
      data-testid="machine-info-hero"
      className="rounded-xl border border-primary/40 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 text-lg font-bold text-foreground"
            data-testid="machine-info-hero-status"
          >
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                STATUS_DOT[machineStatus]
              )}
              aria-hidden="true"
            />
            {getMachineStatusLabel(machineStatus)}
          </span>
          <MachinePresenceBadge status={presenceStatus} size="sm" />
        </div>

        <Button
          asChild
          size="lg"
          className="w-full font-bold md:ml-auto md:w-auto"
        >
          <Link href={reportHref} data-testid="machine-info-report-link">
            <CircleAlert className="size-4" aria-hidden="true" />
            Report a problem
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 border-t border-outline-variant pt-4">
        {openCount === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
            No open issues — this machine is healthy.
          </p>
        ) : (
          <>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Known issues · {openCount} open
            </h3>
            <ul className="flex flex-col">
              {peek.map((issue) => (
                <li
                  key={issue.id}
                  className="border-b border-dashed border-outline-variant/60 last:border-b-0"
                >
                  <Link
                    href={`/m/${machineInitials}/i/${issue.issueNumber}`}
                    className="flex items-center gap-2.5 py-2 text-sm transition-colors duration-150 hover:text-primary"
                  >
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatIssueId(machineInitials, issue.issueNumber)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {issue.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        STATUS_STYLES[issue.status]
                      )}
                    >
                      {getIssueStatusLabel(issue.status)}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        SEVERITY_STYLES[issue.severity]
                      )}
                    >
                      {getIssueSeverityLabel(issue.severity)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={serviceHref}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all on Service
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
