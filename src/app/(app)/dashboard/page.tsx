import type React from "react";
import { cache } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { desc, eq, sql, and, ne } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  getIssueStatusStyles,
  getIssueSeverityStyles,
  getIssueStatusLabel,
  getIssueSeverityLabel,
  isIssueStatus,
  isIssueSeverity,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";

/**
 * Cached dashboard data fetcher (CORE-PERF-001)
 * Wraps all dashboard queries to prevent duplicate execution within a single request
 */
const getDashboardData = cache(async (userId?: string) => {
  // Query 1: User Profile
  // Fetch user profile to ensure existence or display name (parallelized)
  const userProfilePromise = userId
    ? db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),
        columns: {
          id: true,
          name: true,
        },
      })
    : Promise.resolve(undefined);

  // Query 2: Issues assigned to current user (with machine relation)
  // Run this conditionally if userId is present, otherwise return empty array
  const assignedIssuesPromise = userId
    ? db.query.issues.findMany({
        where: and(
          eq(issues.assignedTo, userId),
          ne(issues.status, "resolved")
        ),
        orderBy: desc(issues.createdAt),
        limit: 10,
        with: {
          machine: {
            columns: {
              id: true,
              name: true,
              initials: true,
            },
          },
        },
        columns: {
          id: true,
          title: true,
          status: true,
          severity: true,
          machineInitials: true,
          issueNumber: true,
          createdAt: true,
        },
      })
    : Promise.resolve([]);

  // Query 2b: Count of issues assigned to current user (Fixes capped count bug & optimizes)
  const assignedIssuesCountPromise = userId
    ? db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(
          and(eq(issues.assignedTo, userId), ne(issues.status, "resolved"))
        )
    : Promise.resolve([{ count: 0 }]);

  // Query 3: Recently reported issues (last 10, with machine and reporter)
  const recentIssuesPromise = db.query.issues.findMany({
    orderBy: desc(issues.createdAt),
    limit: 10,
    with: {
      machine: {
        columns: {
          id: true,
          name: true,
          initials: true,
        },
      },
      reportedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    columns: {
      id: true,
      title: true,
      status: true,
      severity: true,
      machineInitials: true,
      issueNumber: true,
      createdAt: true,
    },
  });

  // Query 4: Unplayable machines (database-level filtering for efficiency - PERF-002)
  // Get machines with at least one open unplayable issue using JOIN and GROUP BY
  const unplayableMachinesPromise = db
    .select({
      id: machines.id,
      name: machines.name,
      initials: machines.initials,
      unplayableIssuesCount: sql<number>`count(*)::int`,
    })
    .from(machines)
    .innerJoin(issues, eq(issues.machineInitials, machines.initials))
    .where(
      and(eq(issues.severity, "unplayable"), ne(issues.status, "resolved"))
    )
    .groupBy(machines.id, machines.name, machines.initials);

  // Query 5: Total open issues count
  const totalOpenIssuesPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(issues)
    .where(ne(issues.status, "resolved"));

  // Query 6: Machines needing service (machines with at least one open issue)
  // Optimized to use count(distinct) instead of fetching all IDs
  const machinesNeedingServicePromise = db
    .select({ count: sql<number>`count(distinct ${machines.id})::int` })
    .from(machines)
    .innerJoin(issues, eq(issues.machineInitials, machines.initials))
    .where(ne(issues.status, "resolved"));

  // Execute all queries in parallel
  const [
    userProfile,
    assignedIssues,
    assignedIssuesCountResult,
    recentIssues,
    unplayableMachines,
    totalOpenIssuesResult,
    machinesNeedingServiceResult,
  ] = await Promise.all([
    userProfilePromise,
    assignedIssuesPromise,
    assignedIssuesCountPromise,
    recentIssuesPromise,
    unplayableMachinesPromise,
    totalOpenIssuesPromise,
    machinesNeedingServicePromise,
  ]);

  const totalOpenIssues = totalOpenIssuesResult[0]?.count ?? 0;
  const machinesNeedingService = machinesNeedingServiceResult[0]?.count ?? 0;
  const myIssuesCount = assignedIssuesCountResult[0]?.count ?? 0;

  return {
    userProfile,
    assignedIssues,
    recentIssues,
    unplayableMachines,
    totalOpenIssues,
    machinesNeedingService,
    myIssuesCount,
  };
});

/**
 * Member Dashboard Page (Public Route)
 *
 * Displays:
 * - Issues assigned to current user (Member only)
 * - Recently reported issues (last 10)
 * - Unplayable machines (machines with unplayable issues)
 * - Quick stats (total open issues, machines needing service, issues assigned to me)
 */
export default async function DashboardPage(): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all dashboard data with caching (public allowed)
  const data = await getDashboardData(user?.id);

  const {
    assignedIssues,
    recentIssues,
    unplayableMachines,
    totalOpenIssues,
    machinesNeedingService,
    myIssuesCount,
  } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats Section */}
        <div className="lg:col-span-3" data-testid="quick-stats">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Quick Stats
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Open Issues */}
            <Card className="border-primary/20 bg-card glow-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Open Issues
                  </CardTitle>
                  <AlertTriangle className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold text-foreground"
                  data-testid="stat-open-issues-value"
                >
                  {totalOpenIssues}
                </div>
              </CardContent>
            </Card>

            {/* Machines Needing Service */}
            <Card className="border-primary/20 bg-card glow-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Machines Needing Service
                  </CardTitle>
                  <Wrench className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold text-foreground"
                  data-testid="stat-machines-needing-service-value"
                >
                  {machinesNeedingService}
                </div>
              </CardContent>
            </Card>

            {/* Issues Assigned to Me */}
            {user && (
              <Card className="border-primary/20 bg-card glow-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Assigned to Me
                    </CardTitle>
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="text-3xl font-bold text-foreground"
                    data-testid="stat-assigned-to-me-value"
                  >
                    {myIssuesCount}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Issues Assigned to Me Section */}
        {user && (
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Issues Assigned to Me
            </h2>
            {assignedIssues.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <p className="text-lg text-muted-foreground">
                    No issues assigned to you
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="assigned-issues-list">
                {assignedIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
                  >
                    <Card
                      className={cn(
                        "transition-all h-full cursor-pointer",
                        issue.status === "resolved"
                          ? "border-border/40 bg-muted/30 opacity-60 hover:opacity-100 grayscale hover:grayscale-0"
                          : "border-primary/20 bg-card hover:border-primary hover:glow-primary"
                      )}
                      data-testid="assigned-issue-card"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardTitle className="text-base text-foreground mb-1">
                              <span className="text-muted-foreground font-mono mr-2">
                                {formatIssueId(
                                  issue.machineInitials,
                                  issue.issueNumber
                                )}
                              </span>{" "}
                              {issue.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {issue.machine.name}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {/* Status Badge */}
                            {isIssueStatus(issue.status) && (
                              <Badge
                                className={cn(
                                  "px-2 py-1 text-xs font-semibold",
                                  getIssueStatusStyles(issue.status)
                                )}
                              >
                                {getIssueStatusLabel(issue.status)}
                              </Badge>
                            )}
                            {/* Severity Badge */}
                            {isIssueSeverity(issue.severity) && (
                              <Badge
                                className={cn(
                                  "px-2 py-1 text-xs font-semibold",
                                  getIssueSeverityStyles(issue.severity)
                                )}
                              >
                                {getIssueSeverityLabel(issue.severity)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unplayable Machines Section */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Unplayable Machines
          </h2>
          {unplayableMachines.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  All machines are playable
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="unplayable-machines-list">
              {unplayableMachines.map((machine) => (
                <Link key={machine.id} href={`/m/${machine.initials}`}>
                  <Card
                    className="border-destructive/30 bg-destructive/10 hover:border-destructive transition-all glow-destructive cursor-pointer"
                    data-testid="unplayable-machine-card"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base text-destructive mb-1">
                            {machine.name}
                          </CardTitle>
                          <p className="text-xs text-destructive/80">
                            {machine.unplayableIssuesCount} unplayable{" "}
                            {machine.unplayableIssuesCount === 1
                              ? "issue"
                              : "issues"}
                          </p>
                        </div>
                        <XCircle className="size-5 text-destructive" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recently Reported Issues Section */}
        <div className="lg:col-span-3">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Recently Reported Issues
          </h2>
          {recentIssues.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-12 text-center">
                <Clock className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  No issues reported yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              data-testid="recent-issues-list"
            >
              {recentIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
                >
                  <Card
                    className={cn(
                      "transition-all h-full cursor-pointer",
                      issue.status === "resolved"
                        ? "border-border/40 bg-muted/30 opacity-60 hover:opacity-100 grayscale hover:grayscale-0"
                        : "border-secondary/20 bg-card hover:border-secondary hover:glow-secondary"
                    )}
                    data-testid="recent-issue-card"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-base text-foreground mb-1">
                            <span className="text-muted-foreground font-mono mr-2">
                              {formatIssueId(
                                issue.machineInitials,
                                issue.issueNumber
                              )}
                            </span>{" "}
                            {issue.title}
                          </CardTitle>
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            <span>{issue.machine.name}</span>
                            <span>
                              Reported by{" "}
                              {issue.reportedByUser?.name ??
                                "Anonymous Reporter"}{" "}
                              • {new Date(issue.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {/* Status Badge */}
                          {isIssueStatus(issue.status) && (
                            <Badge
                              className={cn(
                                "px-2 py-1 text-xs font-semibold",
                                getIssueStatusStyles(issue.status)
                              )}
                            >
                              {getIssueStatusLabel(issue.status)}
                            </Badge>
                          )}
                          {/* Severity Badge */}
                          {isIssueSeverity(issue.severity) && (
                            <Badge
                              className={cn(
                                "px-2 py-1 text-xs font-semibold",
                                getIssueSeverityStyles(issue.severity)
                              )}
                            >
                              {getIssueSeverityLabel(issue.severity)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
