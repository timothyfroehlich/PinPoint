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
import { loadDashboardData } from "~/lib/dashboard/queries";
import { formatDate } from "~/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { IssueCard } from "~/components/issues/IssueCard";
import { OrganizationBanner } from "~/components/dashboard/OrganizationBanner";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { EmptyState } from "~/components/ui/empty-state";

/**
 * Cached dashboard data fetcher (CORE-PERF-001)
 * Wraps all dashboard queries to prevent duplicate execution within a single request
 */
const getDashboardData = cache(async (userId?: string) =>
  loadDashboardData(db, userId)
);

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
    <PageContainer size="standard">
      <PageHeader title="Dashboard" />
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
                  <Card className="border-outline-variant bg-card hover:border-primary/50 hover:glow-primary transition-[color,background-color,border-color,box-shadow] duration-150 cursor-pointer h-full">
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
                <Link href="/m?status=needs_service,unplayable">
                  <Card className="border-outline-variant bg-card hover:border-primary/50 hover:glow-primary transition-[color,background-color,border-color,box-shadow] duration-150 cursor-pointer h-full">
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
                    <Card className="border-outline-variant bg-card hover:border-primary/50 hover:glow-primary transition-[color,background-color,border-color,box-shadow] duration-150 cursor-pointer h-full">
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
            <EmptyState
              icon={Sparkles}
              title="No machines yet"
              description="Machines will appear here once they are added to the collection."
            />
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              data-testid="newest-machines-list"
            >
              {newestMachines.map((machine) => (
                <Link key={machine.id} href={`/m/${machine.initials}`}>
                  <Card className="border-outline-variant bg-card hover:border-primary/50 hover:glow-primary transition-[color,background-color,border-color,box-shadow] duration-150 cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base text-foreground mb-1">
                            {machine.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Added {formatDate(machine.createdAt)}
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
            <EmptyState
              icon={CheckCircle2}
              title="No recently fixed machines"
              description="Machines will appear here once major or unplayable issues are resolved."
            />
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              data-testid="recently-fixed-machines-list"
            >
              {recentlyFixedMachines.map((machine) => (
                <Link key={machine.id} href={`/m/${machine.initials}`}>
                  <Card className="border-success/30 bg-success/10 hover:border-success hover:glow-success transition-[color,background-color,border-color,box-shadow] duration-150 cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base text-success mb-1">
                            {machine.name}
                          </CardTitle>
                          <p className="text-xs text-success/80">
                            {machine.fixedAt &&
                              `Fixed ${formatDate(machine.fixedAt)}`}
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
              <EmptyState
                icon={CheckCircle2}
                title="No issues assigned to you"
                description="Issues assigned to you will appear here."
              />
            ) : (
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                data-testid="assigned-issues-list"
              >
                {assignedIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
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
            <EmptyState
              icon={Clock}
              title="No issues reported yet"
              description="Issues will appear here once they are reported."
            />
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              data-testid="recent-issues-list"
            >
              {recentIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  machine={{ name: issue.machine.name }}
                  showReporter={true}
                  dataTestId="recent-issue-card"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
