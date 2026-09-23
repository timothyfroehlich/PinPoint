import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { RecentIssueData } from "~/app/(app)/report/actions";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { STATUS_CONFIG } from "~/lib/issues/status";

interface QuickRecentIssuesProps {
  headingId: string;
  machineInitials: string;
  issues: RecentIssueData[];
  isLoading: boolean;
  isError: boolean;
}

export function QuickRecentIssues({
  headingId,
  machineInitials,
  issues,
  isLoading,
  isError,
}: QuickRecentIssuesProps): React.JSX.Element {
  const displayIssues = issues.slice(0, 3);

  return (
    <aside aria-labelledby={headingId}>
      <Separator />
      <div className="space-y-1 py-2">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <h2 id={headingId} className="text-sm font-semibold">
            Already reported?{" "}
            <span className="ml-1.5 font-normal text-muted-foreground">
              Leave a comment
            </span>
          </h2>
          {machineInitials &&
          !isLoading &&
          !isError &&
          displayIssues.length > 0 ? (
            <Link
              href={`/m/${machineInitials}/i`}
              className="inline-flex min-h-12 shrink-0 items-center gap-1 px-1 text-xs font-medium text-link outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              All issues
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {!machineInitials ? (
          <p className="py-2 text-sm text-muted-foreground">
            Select a machine to see recent issues.
          </p>
        ) : isLoading ? (
          <ul aria-label="Loading recent issues" className="space-y-1">
            {Array.from({ length: 3 }, (_, index) => (
              <li
                key={index}
                className="flex min-h-10 items-center justify-between gap-3 px-1"
              >
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <p
            role="status"
            className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground"
          >
            <AlertCircle aria-hidden="true" className="size-4" />
            Could not load recent issues.
          </p>
        ) : displayIssues.length === 0 ? (
          <p className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
            No open issues for this machine.
          </p>
        ) : (
          <ul className="space-y-1">
            {displayIssues.map((issue) => {
              const status = STATUS_CONFIG[issue.status];
              const StatusIcon = status.icon;

              return (
                <li key={issue.id}>
                  <Link
                    href={`/m/${machineInitials}/i/${issue.issueNumber}`}
                    className="group flex min-h-11 items-center justify-between gap-3 rounded-sm px-1 py-1 outline-none hover:bg-surface-container-low focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label={`${issue.title}, ${status.label}`}
                  >
                    <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium group-hover:text-primary">
                      {issue.title}
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${status.iconColor}`}
                    >
                      <StatusIcon aria-hidden="true" className="size-3.5" />
                      {status.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Separator />
    </aside>
  );
}
