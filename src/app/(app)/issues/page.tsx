import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, machines } from "~/server/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { IssueFilters } from "~/components/IssueFilters";

/**
 * Issues List Page (Protected Route)
 *
 * Shows all issues with filtering by:
 * - machineId (from URL param)
 * - status (from URL param)
 * - severity (from URL param)
 * - assignedTo (from URL param)
 */
export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    machineId?: string;
    status?: string;
    severity?: string;
    assignedTo?: string;
  }>;
}): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get search params (Next.js 16: searchParams is a Promise)
  const params = await searchParams;
  const { machineId, status, severity, assignedTo } = params;

  // Build where conditions for filtering
  const conditions = [];
  if (machineId) conditions.push(eq(issues.machineId, machineId));
  if (
    status &&
    (status === "new" || status === "in_progress" || status === "resolved")
  ) {
    conditions.push(eq(issues.status, status));
  }
  if (
    severity &&
    (severity === "minor" ||
      severity === "playable" ||
      severity === "unplayable")
  ) {
    conditions.push(eq(issues.severity, severity));
  }
  if (assignedTo === "unassigned") {
    conditions.push(isNull(issues.assignedTo));
  } else if (assignedTo) {
    conditions.push(eq(issues.assignedTo, assignedTo));
  }

  // Query issues with filters
  const allIssues = await db.query.issues.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(issues.createdAt),
    with: {
      machine: {
        columns: {
          id: true,
          name: true,
        },
      },
      reportedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      assignedToUser: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Fetch all machines and users for filter dropdowns
  const allMachines = await db.query.machines.findMany({
    orderBy: desc(machines.name),
    columns: {
      id: true,
      name: true,
    },
  });

  const allUsers = await db.query.userProfiles.findMany({
    columns: {
      id: true,
      name: true,
    },
  });

  // Get current machine name if filtering by machine
  const currentMachine = machineId
    ? allMachines.find((m) => m.id === machineId)
    : null;

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-on-surface">Issues</h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                {currentMachine
                  ? `Issues for ${currentMachine.name}`
                  : "View and manage all issues"}
              </p>
            </div>
            <Button
              asChild
              className="bg-primary text-on-primary hover:bg-primary/90"
            >
              <Link href="/issues/new">
                <Plus className="mr-2 size-4" />
                Report Issue
              </Link>
            </Button>
          </div>

          {/* Filters */}
          <IssueFilters machines={allMachines} users={allUsers} />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {allIssues.length === 0 ? (
          // Empty state
          <Card className="border-outline-variant">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-4 size-12 text-on-surface-variant" />
              <p className="text-lg text-on-surface-variant mb-4">
                {machineId || status || severity || assignedTo
                  ? "No issues match the selected filters"
                  : "No issues reported yet"}
              </p>
              <Button
                asChild
                className="bg-primary text-on-primary hover:bg-primary/90"
              >
                <Link href="/issues/new">
                  <Plus className="mr-2 size-4" />
                  Report First Issue
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Issue list
          <div className="space-y-3">
            {allIssues.map((issue) => (
              <Link key={issue.id} href={`/issues/${issue.id}`}>
                <Card
                  data-testid={`issue-card-${issue.id}`}
                  className="border-outline-variant hover:border-primary transition-colors cursor-pointer"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl text-on-surface mb-2">
                          {issue.title}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                          <span>{issue.machine.name}</span>
                          <span>•</span>
                          <span>
                            Reported by{" "}
                            {issue.reportedByUser?.name ??
                              issue.reporterName ??
                              "Anonymous"}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(issue.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* Status Badge */}
                        <Badge
                          className={`px-2 py-1 text-xs font-semibold ${
                            issue.status === "resolved"
                              ? "bg-green-100 text-green-800 border-green-300"
                              : issue.status === "in_progress"
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : "bg-gray-100 text-gray-800 border-gray-300"
                          }`}
                        >
                          {issue.status === "in_progress"
                            ? "In Progress"
                            : issue.status.charAt(0).toUpperCase() +
                              issue.status.slice(1)}
                        </Badge>
                        {/* Severity Badge */}
                        <Badge
                          className={`px-2 py-1 text-xs font-semibold ${
                            issue.severity === "unplayable"
                              ? "bg-red-100 text-red-800 border-red-300"
                              : issue.severity === "playable"
                                ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                : "bg-blue-100 text-blue-800 border-blue-300"
                          }`}
                        >
                          {issue.severity.charAt(0).toUpperCase() +
                            issue.severity.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  {(issue.description != null ||
                    issue.assignedToUser != null) && (
                    <CardContent>
                      {issue.description && (
                        <p className="text-sm text-on-surface-variant line-clamp-2 mb-2">
                          {issue.description}
                        </p>
                      )}
                      {issue.assignedToUser && (
                        <p className="text-xs text-on-surface-variant">
                          Assigned to: {issue.assignedToUser.name}
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
