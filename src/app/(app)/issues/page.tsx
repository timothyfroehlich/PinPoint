import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { eq, inArray, and, isNull, type SQL } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { IssuesList } from "~/components/issues/IssuesList";
import { readFlash } from "~/lib/flash";

/**
 * Issues Page (Protected Route)
 *
 * Displays all issues across all machines with filtering.
 * Filters are applied via URL query params (status, severity, assignee, machineId).
 */
export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    severity?: string;
    assignee?: string;
    machineId?: string;
  }>;
}): Promise<React.JSX.Element> {
  // Auth guard (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read flash message (if any)
  const flash = await readFlash();

  // Await searchParams (Next.js 15+ requirement)
  const params = await searchParams;

  // Build filter conditions
  const conditions: SQL[] = [];

  // Status filter (can be comma-separated for multiple values)
  if (params.status) {
    const statuses = params.status.split(",").filter(Boolean);
    if (statuses.length > 0) {
      conditions.push(
        inArray(
          issues.status,
          statuses as ("new" | "in_progress" | "resolved")[]
        )
      );
    }
  }

  // Severity filter (can be comma-separated for multiple values)
  if (params.severity) {
    const severities = params.severity.split(",").filter(Boolean);
    if (severities.length > 0) {
      conditions.push(
        inArray(
          issues.severity,
          severities as ("minor" | "playable" | "unplayable")[]
        )
      );
    }
  }

  // Assignee filter (can be comma-separated for multiple values, or "unassigned")
  if (params.assignee) {
    const assignees = params.assignee.split(",").filter(Boolean);
    if (assignees.length > 0) {
      const assigneeConditions = assignees.map((assignee) =>
        assignee === "unassigned"
          ? isNull(issues.assignedTo)
          : eq(issues.assignedTo, assignee)
      );
      conditions.push(
        assigneeConditions.length === 1
          ? assigneeConditions[0]!
          : inArray(
              issues.assignedTo,
              assignees.filter((a) => a !== "unassigned")
            )
      );
    }
  }

  // Machine filter (single value)
  if (params.machineId) {
    conditions.push(eq(issues.machineId, params.machineId));
  }

  // Query issues with relations (direct Drizzle query - no DAL)
  const issuesData = await db.query.issues.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      machine: true,
      reportedByUser: true,
      assignedToUser: true,
    },
    orderBy: (issues, { desc }) => [desc(issues.createdAt)],
  });

  // Query all users for the assignee filter
  const users = await db.query.userProfiles.findMany({
    columns: {
      id: true,
      name: true,
    },
  });

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className="size-8 text-primary"
                strokeWidth={2.5}
              />
              <div>
                <h1 className="text-3xl font-bold text-on-surface">Issues</h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  View and manage all pinball machine issues
                </p>
              </div>
            </div>
            <Link href="/issues/new">
              <Button className="bg-primary text-on-primary hover:bg-primary/90">
                <Plus className="mr-2 size-4" />
                Report Issue
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Flash message */}
          {flash && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                flash.type === "error"
                  ? "bg-error-container text-on-error-container"
                  : "bg-primary-container text-on-primary-container"
              }`}
              role="alert"
            >
              {flash.message}
            </div>
          )}

          {/* Issues List Card */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-2xl text-on-surface">
                All Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IssuesList
                issues={issuesData}
                users={users}
                showFilters={true}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
