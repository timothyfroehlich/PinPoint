import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  AlertTriangleIcon,
  PlusIcon,
  ArrowRightIcon,
  WrenchIcon,
  BarChart3Icon,
} from "lucide-react";
import { getRequestAuthContext } from "~/lib/organization-context";
import { getIssuesForOrg } from "~/lib/dal/issues";
import {
  getOrganizationStats,
} from "~/lib/dal/organizations";
import { IssuesListServer } from "~/components/issues/issues-list-server";
import { DashboardStats } from "~/components/dashboard/dashboard-stats";

export async function generateMetadata(): Promise<Metadata> {
  // Generic metadata to avoid auth race conditions - org-specific title set at page level
  return {
    title: "Dashboard - PinPoint",
    description: "Issue management dashboard for monitoring and tracking maintenance issues",
  };
}

export default async function DashboardPage(): Promise<React.JSX.Element> {
  // Single authentication resolution for entire request
  const authContext = await getRequestAuthContext();
  const { user } = authContext;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user.name ?? user.email.split("@")[0] ?? "User"}
        </p>
      </div>

      {/* Organization Statistics */}
      <Suspense fallback={<StatsLoadingSkeleton />}>
        <DashboardStatsWithData />
      </Suspense>

      {/* Dashboard Actions */}
      <DashboardQuickActions />

      {/* Recent Issues */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Recent Issues</h2>
          <Button variant="outline" asChild>
            <Link href="/issues">
              View All Issues
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        <Suspense fallback={<RecentIssuesLoadingSkeleton />}>
          <RecentIssuesWithData />
        </Suspense>
      </div>
    </div>
  );
}

// Dashboard-specific Quick Actions (focused on task creation and management)
function DashboardQuickActions(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="default"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/issues/create">
              <PlusIcon className="h-5 w-5" />
              <span className="text-xs">Report Issue</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/issues?status=open">
              <AlertTriangleIcon className="h-5 w-5" />
              <span className="text-xs">View Open Issues</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/machines?status=needs-attention">
              <WrenchIcon className="h-5 w-5" />
              <span className="text-xs">Maintenance Alerts</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            asChild
            className="h-auto p-4 flex-col gap-2"
          >
            <Link href="/analytics">
              <BarChart3Icon className="h-5 w-5" />
              <span className="text-xs">View Analytics</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Server Component for dashboard statistics
async function DashboardStatsWithData(): Promise<React.JSX.Element> {
  const stats = await getOrganizationStats();

  // Transform to match DashboardStats component interface
  const dashboardStats = {
    totalIssues: stats.issues.total,
    openIssues: stats.issues.new,
    closedIssues: stats.issues.resolved,
    totalMachines: stats.machines.total,
    inProgressIssues: stats.issues.inProgress,
  };

  return <DashboardStats stats={dashboardStats} />;
}

// Server Component for recent issues
async function RecentIssuesWithData(): Promise<React.JSX.Element> {
  const auth = await getRequestAuthContext();
  const issues = await getIssuesForOrg(auth.organization.id);
  const recentIssues = issues.slice(0, 5);

  if (recentIssues.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangleIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No issues yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by creating your first issue report.
          </p>
          <Button asChild className="mt-4">
            <Link href="/issues/create">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Issue
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <IssuesListServer issues={recentIssues} limit={5} />

      {issues.length > 5 && (
        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            Showing 5 of {issues.length} total issues
          </p>
        </div>
      )}
    </div>
  );
}

// Loading Skeletons

function StatsLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-4 bg-muted rounded w-20 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted rounded w-12 animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentIssuesLoadingSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
