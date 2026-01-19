import type React from "react";
import { type Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueRow } from "~/components/issues/IssueRow";
import { CheckCircle2, Search } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";
import type {
  Issue,
  IssueStatus,
  IssueSeverity,
  IssuePriority,
} from "~/lib/types";
import { OPEN_STATUSES, CLOSED_STATUSES } from "~/lib/issues/status";

export const metadata: Metadata = {
  title: "Issues | PinPoint",
  description: "View and filter all pinball machine issues.",
};

interface IssuesPageProps {
  searchParams: Promise<{
    status?: string;
    severity?: string;
    priority?: string;
    machine?: string;
  }>;
}

export default async function IssuesPage({
  searchParams,
}: IssuesPageProps): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fissues");
  }

  // 1. Start independent queries immediately
  const machinesPromise = db.query.machines.findMany({
    orderBy: (machines, { asc }) => [asc(machines.name)],
    columns: { initials: true, name: true },
  });

  const params = await searchParams;
  const { status, severity, priority, machine } = params;

  // Safe type casting for filters using imported constants from single source of truth
  // Based on _issue-status-redesign/README.md - Final design with 11 statuses
  let statusFilter: IssueStatus[];

  if (status === "closed") {
    statusFilter = [...CLOSED_STATUSES];
  } else if (
    (OPEN_STATUSES as readonly IssueStatus[]).includes(status as IssueStatus)
  ) {
    statusFilter = [status as IssueStatus];
  } else if (
    (CLOSED_STATUSES as readonly IssueStatus[]).includes(status as IssueStatus)
  ) {
    statusFilter = [status as IssueStatus];
  } else {
    // Default case: Show all Open issues
    statusFilter = [...OPEN_STATUSES];
  }

  const severityFilter: IssueSeverity | undefined =
    severity && ["cosmetic", "minor", "major", "unplayable"].includes(severity)
      ? (severity as IssueSeverity)
      : undefined;

  const priorityFilter: IssuePriority | undefined =
    priority && ["low", "medium", "high"].includes(priority)
      ? (priority as IssuePriority)
      : undefined;

  // 2. Fetch Issues based on filters (depends on params)
  // Type assertion needed because Drizzle infers status as string, not IssueStatus
  const issuesPromise = db.query.issues.findMany({
    where: and(
      inArray(issues.status, statusFilter),
      severityFilter ? eq(issues.severity, severityFilter) : undefined,
      priorityFilter ? eq(issues.priority, priorityFilter) : undefined,
      machine ? eq(issues.machineInitials, machine) : undefined
    ),
    orderBy: desc(issues.createdAt),
    with: {
      machine: {
        columns: { name: true },
      },
      reportedByUser: {
        columns: { name: true },
      },
      invitedReporter: {
        columns: { name: true },
      },
    },
    columns: {
      id: true,
      createdAt: true,
      machineInitials: true,
      issueNumber: true,
      title: true,
      status: true,
      severity: true,
      priority: true,
      consistency: true,
      reporterName: true,
      reporterEmail: true,
    },
    limit: 100, // Reasonable limit for now
  });

  // 3. Await all promises in parallel
  // This reduces TTFB by fetching machines and issues concurrently
  const [allMachines, issuesListRaw] = await Promise.all([
    machinesPromise,
    issuesPromise,
  ]);

  const issuesList = issuesListRaw as (Pick<
    Issue,
    | "id"
    | "createdAt"
    | "machineInitials"
    | "issueNumber"
    | "title"
    | "status"
    | "severity"
    | "priority"
    | "consistency"
    | "reporterName"
    | "reporterEmail"
  > & {
    machine: { name: string } | null;
    reportedByUser: { name: string } | null;
    invitedReporter: { name: string } | null;
  })[];

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Issues</h1>
          <p className="text-muted-foreground">
            Track and manage reported problems across the collection.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <IssueFilters machines={allMachines} />
        </div>

        {/* Issues List */}
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          {issuesList.length > 0 ? (
            <div className="divide-y divide-border">
              {issuesList.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-300">
              {status !== "closed" && !severity && !priority && !machine ? (
                <>
                  <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <CheckCircle2 className="size-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium">All Clear!</h3>
                  <p className="text-muted-foreground max-w-sm mt-2">
                    There are no open issues. The machines are running
                    perfectly.
                  </p>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Search className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No matches found</h3>
                  <p className="text-muted-foreground max-w-sm mt-2">
                    We couldn&apos;t find any issues matching your current
                    filters. Try adjusting or clearing them.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
