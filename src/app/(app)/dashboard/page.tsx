import type React from "react";
import { cache } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Sparkles,
} from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issues, machines, userProfiles } from "~/server/db/schema";
import {
  desc,
  eq,
  sql,
  and,
  notInArray,
  inArray,
  not,
  exists,
} from "drizzle-orm";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { Issue } from "~/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { IssueCard } from "~/components/issues/IssueCard";
import { OrganizationBanner } from "~/components/dashboard/OrganizationBanner";

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
          notInArray(issues.status, [...CLOSED_STATUSES])
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
          priority: true,
          frequency: true,
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
          and(
            eq(issues.assignedTo, userId),
            notInArray(issues.status, [...CLOSED_STATUSES])
          )
        )
    : Promise.resolve([{ count: 0 }]);

  // Query 3: Recently reported issues (last 10, with machine and all reporter types)
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
      invitedReporter: {
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
      priority: true,
      frequency: true,
      machineInitials: true,
      issueNumber: true,
      createdAt: true,
      reporterName: true,
    },
  });

  // Query 4: Newest machines (3 most recently added)
  const newestMachinesPromise = db.query.machines.findMany({
    orderBy: desc(machines.createdAt),
    limit: 3,
    columns: {
      id: true,
      name: true,
      initials: true,
      createdAt: true,
    },
  });

  // Query 4b: Recently fixed machines
  // Machines that had major/unplayable issues but now have none
  // Ordered by when the last major/unplayable issue was closed
  const recentlyFixedMachinesPromise = db
    .select({
      id: machines.id,
      name: machines.name,
      initials: machines.initials,
      fixedAt: sql<Date>`max(${issues.updatedAt})`.as("fixed_at"),
    })
    .from(machines)
    .innerJoin(issues, eq(issues.machineInitials, machines.initials))
    .where(
      and(
        // Issue was major or unplayable
        inArray(issues.severity, ["major", "unplayable"]),
        // Issue is now closed
        inArray(issues.status, [...CLOSED_STATUSES]),
        // Machine has NO open major/unplayable issues currently
        not(
          exists(
            db
              .select({ one: sql`1` })
              .from(issues)
              .where(
                and(
                  eq(issues.machineInitials, machines.initials),
                  inArray(issues.severity, ["major", "unplayable"]),
                  notInArray(issues.status, [...CLOSED_STATUSES])
                )
              )
          )
        )
      )
    )
    .groupBy(machines.id, machines.name, machines.initials)
    .orderBy(sql`max(${issues.updatedAt}) DESC`)
    .limit(3);

  // Query 5: Total open issues count
  const totalOpenIssuesPromise = db
    .select({ count: sql<number>`count(*)::int` })
    .from(issues)
    .where(notInArray(issues.status, [...CLOSED_STATUSES]));

  // Query 6: Machines needing service (machines with `major` or `unplayable` open issues)
  // Optimized to use count(distinct) on issues table, removing unnecessary JOIN with machines
  const machinesNeedingServicePromise = db
    .select({
      count: sql<number>`count(distinct ${issues.machineInitials})::int`,
    })
    .from(issues)
    .where(
      and(
        notInArray(issues.status, [...CLOSED_STATUSES]),
        inArray(issues.severity, ["major", "unplayable"])
      )
    );

  // Execute all queries in parallel
  const [
    userProfile,
    assignedIssues,
    assignedIssuesCountResult,
    recentIssues,
    newestMachines,
    recentlyFixedMachines,
    totalOpenIssuesResult,
    machinesNeedingServiceResult,
  ] = await Promise.all([
    userProfilePromise,
    assignedIssuesPromise,
    assignedIssuesCountPromise,
    recentIssuesPromise,
    newestMachinesPromise,
    recentlyFixedMachinesPromise,
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
    newestMachines,
    recentlyFixedMachines,
    totalOpenIssues,
    machinesNeedingService,
    myIssuesCount,
  };
});

/**
 * Member Dashboard Page (Public Route)
 *
 * Displays:
 * - Quick stats (total open issues, machines needing service, issues assigned to me)
 * - Newest games (3 most recently added machines)
 * - Recently fixed games (machines that went from major/unplayable issues to none)
 * - Issues assigned to current user (Member only)
 * - Recently reported issues (last 10)
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
    newestMachines,
    recentlyFixedMachines,
    totalOpenIssues,
    machinesNeedingService,
    myIssuesCount,
  } = data;

  return (
    <div className="py-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats + Organization Banner Row */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-stretch">
            {/* Quick Stats Section */}
            <div data-testid="quick-stats">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Quick Stats
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Open Issues */}
                <Link href="/issues?status=new,confirmed,in_progress,need_parts,need_help,wait_owner">
                  <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
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
                </Link>

                {/* Machines Needing Service */}
                <Link href="/m?status=unplayable,needs_service">
                  <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
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
                </Link>

                {/* Issues Assigned to Me */}
                {user && (
                  <Link
                    href={`/issues?assignee=${user.id}&status=new,confirmed,in_progress,need_parts,need_help,wait_owner`}
                  >
                    <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
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
                  </Link>
                )}
              </div>
            </div>

            {/* Organization Banner */}
            <div className="hidden lg:block w-64">
              <OrganizationBanner />
            </div>
          </div>
        </div>

        {/* Newest Games Section */}
        <div className="lg:col-span-3">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Newest Games
          </h2>
          {newestMachines.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-12 text-center">
                <Sparkles className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">No machines yet</p>
              </CardContent>
            </Card>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              data-testid="newest-machines-list"
            >
              {newestMachines.map((machine) => (
                <Link key={machine.id} href={`/m/${machine.initials}`}>
                  <Card className="border-primary/20 bg-card hover:border-primary transition-all glow-primary cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base text-foreground mb-1">
                            {machine.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Added{" "}
                            {new Date(machine.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                          {machine.initials}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recently Fixed Games Section */}
        <div className="lg:col-span-3">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Recently Fixed Games
          </h2>
          {recentlyFixedMachines.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                  No recently fixed machines
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              data-testid="recently-fixed-machines-list"
            >
              {recentlyFixedMachines.map((machine) => (
                <Link key={machine.id} href={`/m/${machine.initials}`}>
                  <Card className="border-success/30 bg-success/10 hover:border-success transition-all glow-success cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base text-success mb-1">
                            {machine.name}
                          </CardTitle>
                          <p className="text-xs text-success/80">
                            Fixed{" "}
                            {new Date(machine.fixedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <CheckCircle2 className="size-5 text-success" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Issues Assigned to Me Section */}
        {user && (
          <div className="lg:col-span-3">
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
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                data-testid="assigned-issues-list"
              >
                {assignedIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue as unknown as Issue}
                    machine={{ name: issue.machine.name }}
                    variant="compact"
                    dataTestId="assigned-issue-card"
                  />
                ))}
              </div>
            )}
          </div>
        )}

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
                <IssueCard
                  key={issue.id}
                  issue={issue as unknown as Issue}
                  machine={{ name: issue.machine.name }}
                  showReporter={true}
                  dataTestId="recent-issue-card"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
