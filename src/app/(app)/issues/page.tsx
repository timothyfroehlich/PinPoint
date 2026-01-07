import type React from "react";
import { type Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { IssueRow } from "~/components/issues/IssueRow";
import { AlertTriangle } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { redirect } from "next/navigation";

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

  const params = await searchParams;
  const { status, severity, priority, machine } = params;

  // Safe type casting for filters
  // Default to Open issues (new + in_progress) if no status is specified
  // If status is 'resolved', show resolved issues
  // If specific status (new/in_progress) is requested, respect it
  let statusFilter: string[] | undefined;

  if (status === "resolved") {
    statusFilter = ["resolved"];
  } else if (status === "new" || status === "in_progress") {
    statusFilter = [status];
  } else {
    // Default case: Show all Open issues
    statusFilter = ["new", "in_progress"];
  }

  const severityFilter =
    severity && ["minor", "playable", "unplayable"].includes(severity)
      ? (severity as "minor" | "playable" | "unplayable")
      : undefined;

  const priorityFilter =
    priority && ["low", "medium", "high", "critical"].includes(priority)
      ? (priority as "low" | "medium" | "high" | "critical")
      : undefined;

  // Execute independent queries in parallel
  const [allMachines, issuesList] = await Promise.all([
    // Fetch machines for filter dropdown
    db.query.machines.findMany({
      orderBy: (machines, { asc }) => [asc(machines.name)],
      columns: { initials: true, name: true },
    }),
    // Fetch Issues based on filters
    db.query.issues.findMany({
      where: and(
        inArray(
          issues.status,
          statusFilter as ("new" | "in_progress" | "resolved")[]
        ),
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
      },
      limit: 100, // Reasonable limit for now
    }),
  ]);

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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <AlertTriangle className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No issues found</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                We couldn&apos;t find any issues matching your current filters.
                Try adjusting or clearing them.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
